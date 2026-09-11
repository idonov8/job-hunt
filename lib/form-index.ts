import { load } from 'cheerio';
import { lookup } from 'node:dns/promises';
import { Agent, fetch } from 'undici';
import ipaddr from 'ipaddr.js';
import type { Field, FormIndex } from './hunter-model';

export function publicAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === 'unicast';
  } catch {
    return false;
  }
}
export function webUrl(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > 4096)
    throw new Error('Use a valid http(s) URL');
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error('Use a public http(s) URL without credentials');
  return url.href;
}

async function publicPage(
  input: string,
  json = false,
): Promise<{ html: string; url: string }> {
  let url = new URL(webUrl(input)!);
  const signal = AbortSignal.timeout(15000);
  for (let redirect = 0; redirect < 5; redirect++) {
    signal.throwIfAborted();
    if (!['80', '443', ''].includes(url.port))
      throw new Error('Only public HTTP(S) ports are supported');
    const addresses = await Promise.race([
      lookup(url.hostname.replace(/^\[|\]$/g, ''), { all: true }),
      new Promise<never>((_, reject) =>
        signal.addEventListener(
          'abort',
          () => reject(new Error('Indexing timed out')),
          { once: true },
        ),
      ),
    ]);
    if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
      throw new Error('Private and reserved networks cannot be indexed');
    // Pin DNS for this connection; validate each redirect before making another request.
    const address = addresses[0];
    const dispatcher = new Agent({
      connect: {
        lookup: (_host, options, callback) => {
          if ((options as { all?: boolean }).all)
            callback(null, [address] as never);
          else callback(null, address.address, address.family);
        },
      },
    });
    try {
      const response = await fetch(url, {
        dispatcher,
        redirect: 'manual',
        signal,
        headers: {
          'user-agent': 'JobHunter/1.0 (application form indexer)',
          accept: json ? 'application/json' : 'text/html',
        },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) throw new Error('Redirect missing a location');
        url = new URL(webUrl(new URL(location, url).href)!);
        continue;
      }
      if (!response.ok)
        throw new Error(`Form site returned HTTP ${response.status}`);
      if (
        !response.headers
          .get('content-type')
          ?.includes(json ? 'application/json' : 'text/html')
      )
        throw new Error('The application URL did not return HTML');
      let size = 0;
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.body!) {
        size += chunk.length;
        if (size > 2_000_000) throw new Error('Form page exceeds 2 MB');
        chunks.push(chunk);
      }
      return { html: Buffer.concat(chunks).toString('utf8'), url: url.href };
    } finally {
      await dispatcher.destroy();
    }
  }
  throw new Error('Too many redirects');
}

export function parseForm(html: string, url: string): FormIndex {
  const $ = load(html);
  const fields: Field[] = [];
  const seen = new Set<string>();
  // Only inspect application forms; search/newsletter controls must not imply a quick application.
  const forms = $('form')
    .toArray()
    .filter((form) => {
      const el = $(form);
      return (
        /appl|resume|résumé|curriculum|cover.?letter|candidate/i.test(
          el.text() + ' ' + el.attr('id') + ' ' + el.attr('action'),
        ) || el.find('input[type=file]').length > 0
      );
    });
  for (const [formNumber, form] of forms.entries()) {
    $(form)
      .find('input, textarea, select, [role=combobox]')
      .each((i, node) => {
        const el = $(node);
        const kind =
          node.tagName === 'input'
            ? (el.attr('type') || 'text').toLowerCase()
            : node.tagName === 'textarea'
              ? 'textarea'
              : 'select';
        if (
          ['hidden', 'submit', 'button', 'reset', 'image'].includes(kind) ||
          el.is(':disabled') ||
          el.closest('[hidden], [aria-hidden=true]').length ||
          /display\s*:\s*none/.test(el.attr('style') || '')
        )
          return;
        const name = el.attr('name') || el.attr('id') || `field-${i}`;
        const key = `${formNumber}:${name}`;
        const group = kind === 'radio' || kind === 'checkbox';
        const labelId = el.attr('id');
        const explicit = labelId
          ? $('label')
              .filter((_, label) => $(label).attr('for') === labelId)
              .text()
          : '';
        const legend = group
          ? el.closest('fieldset').find('legend').first().text()
          : '';
        const label = (
          legend ||
          explicit ||
          el.closest('label').text() ||
          el.attr('aria-label') ||
          el.attr('placeholder') ||
          name
        )
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 1000);
        const options =
          kind === 'select'
            ? el
                .find('option')
                .map((_, o) => $(o).text().trim())
                .get()
                .filter(Boolean)
            : group
              ? [explicit || el.attr('value') || label]
              : [];
        if (seen.has(key) && group) {
          const existing = fields.find((f) => f.key === key)!;
          existing.options.push(...options);
          existing.required ||= el.is('[required],[aria-required=true]');
          return;
        }
        seen.add(key);
        fields.push({
          key,
          label,
          kind,
          required: el.is('[required],[aria-required=true]'),
          options: options.slice(0, 100),
          open:
            kind === 'textarea' ||
            (kind === 'text' &&
              /why|describe|tell us|experience|challenge|motivation|system|project/i.test(
                label,
              )),
        });
      });
  }
  const partial = fields.length > 0; // Static HTML cannot prove that later/conditional steps are absent.
  const seconds = fields.reduce(
    (sum, f) =>
      sum +
      (f.open
        ? 150
        : f.kind === 'file'
          ? 60
          : ['select', 'radio', 'checkbox'].includes(f.kind)
            ? 12
            : 15),
    60,
  );
  return {
    status: partial ? 'partial' : 'unknown',
    url,
    indexed_at: new Date().toISOString(),
    fields,
    minutes: partial ? Math.ceil(seconds / 60) : null,
    note: partial
      ? 'Estimate from visible HTML controls. Conditional and later steps may add questions.'
      : 'No application controls found. This page may need JavaScript, sign-in, or a direct application URL.',
  };
}
export function greenhouseEndpoint(input: string): string | null {
  const url = new URL(input);
  if (
    !['boards.greenhouse.io', 'job-boards.greenhouse.io'].includes(url.hostname)
  )
    return null;
  const match = url.pathname.match(/^\/([^/]+)\/jobs\/(\d+)/);
  const board = match?.[1] || url.searchParams.get('for');
  const id = match?.[2] || url.searchParams.get('token');
  return board && id && /^[a-zA-Z0-9_-]+$/.test(board) && /^\d+$/.test(id)
    ? `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${id}?questions=true`
    : null;
}

type GreenhouseQuestion = {
  label?: string;
  required?: boolean;
  fields?: { name?: string; type?: string; values?: { label?: string }[] }[];
};
export function parseGreenhouse(
  data: {
    questions?: GreenhouseQuestion[];
    location_questions?: GreenhouseQuestion[];
    compliance?: GreenhouseQuestion[];
  },
  url: string,
): FormIndex {
  const fields: Field[] = [];
  for (const [i, q] of [
    ...(data.questions || []),
    ...(data.location_questions || []),
    ...(data.compliance || []),
  ].entries()) {
    // Greenhouse alternatives (upload OR paste resume) are one question, not two tasks.
    const alternatives = (q.fields || []).filter(
      (f) => f.type !== 'input_hidden',
    );
    if (!alternatives.length) continue;
    const field = alternatives[0];
    const kind =
      (
        {
          input_file: 'file',
          input_text: 'text',
          textarea: 'textarea',
          multi_value_single_select: 'select',
          multi_value_multi_select: 'checkbox',
        } as Record<string, string>
      )[field.type || ''] || 'text';
    const label = q.label || field.name || `Question ${i + 1}`;
    fields.push({
      key: field.name || String(i),
      label,
      kind,
      required: Boolean(q.required),
      options: (field.values || []).map((v) => v.label || ''),
      open:
        kind === 'textarea' ||
        (kind === 'text' &&
          /why|describe|tell us|experience|challenge|motivation|system|project/i.test(
            label,
          )),
    });
  }
  return {
    status: fields.length ? 'partial' : 'unknown',
    url,
    indexed_at: new Date().toISOString(),
    fields,
    minutes: fields.length
      ? Math.ceil(
          fields.reduce(
            (s, f) => s + (f.open ? 150 : f.kind === 'file' ? 60 : 15),
            60,
          ) / 60,
        )
      : null,
    note: 'Greenhouse public application questions. Upload/paste alternatives count once. Demographic, consent, conditional and later steps may add fields.',
  };
}
export async function indexForm(input: string): Promise<FormIndex> {
  try {
    const endpoint = greenhouseEndpoint(input);
    if (endpoint) {
      const page = await publicPage(endpoint, true);
      return parseGreenhouse(JSON.parse(page.html), input);
    }
    const page = await publicPage(input);
    const index = parseForm(page.html, page.url);
    if (index.fields.length) return index;
    const $ = load(page.html);
    const embedded = $('iframe[src]')
      .map((_, f) => $(f).attr('src'))
      .get()
      .find((src) => /greenhouse\.io|lever\.co|ashbyhq\.com/i.test(src));
    if (embedded) {
      const target = new URL(embedded, page.url).href;
      const api = greenhouseEndpoint(target);
      const nested = await publicPage(api || target, Boolean(api));
      return api
        ? parseGreenhouse(JSON.parse(nested.html), target)
        : parseForm(nested.html, nested.url);
    }
    return index;
  } catch (error) {
    return {
      status: 'unknown',
      url: input,
      indexed_at: new Date().toISOString(),
      fields: [],
      minutes: null,
      note:
        error instanceof Error ? error.message : 'Could not index this form',
    };
  }
}
