import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_STATE, transition, similarAnswers } from '../lib/hunter-model';
import { parseForm, publicAddress, webUrl, indexForm } from '../lib/form-index';

test('session caps skips, preserves skipped shortlist entries, and awards completion only once', () => {
  let s = structuredClone(EMPTY_STATE);
  for (const slug of ['a', 'b', 'c'])
    s = transition(s, { type: 'select', slug });
  s = transition(s, { type: 'start' });
  assert.throws(() => transition(s, { type: 'start' }));
  assert.throws(() => transition(s, { type: 'complete', slug: 'c' }));
  s = transition(s, { type: 'skip', slug: 'a' });
  s = transition(s, { type: 'skip', slug: 'b' });
  assert.throws(() => transition(s, { type: 'skip', slug: 'c' }));
  s = transition(s, { type: 'complete', slug: 'c' });
  assert.equal(s.completed.length, 1);
  assert.equal(s.session?.ended, true);
  assert.deepEqual(s.selected, ['a', 'b']);
  assert.deepEqual(transition(s, { type: 'complete', slug: 'c' }), s);
  assert.equal(transition(s, { type: 'start' }).session?.skipped.length, 0);
});
test('indexes question kinds, groups radio options, excludes hidden and search fields', () => {
  const result = parseForm(
    `<form action='/search'><input name='q'></form><form id='application'>
    <label for='name'>Full name</label><input id='name' required><input type='hidden' name='token'>
    <fieldset><legend>Work authorization?</legend><label for='yes'>Yes</label><input id='yes' name='authorized' type='radio' required><label for='no'>No</label><input id='no' name='authorized' type='radio'></fieldset>
    <label for='system'>Describe a complex system you built</label><textarea id='system'></textarea>
    <label>Resume<input type='file' name='resume'></label><select name='country'><option>Germany</option></select>
    <input name='disabled' disabled><input name='invisible' style='display: none'>
  </form>`,
    'https://example.org/apply',
  );
  assert.equal(result.fields.length, 5);
  assert.equal(result.fields[0].required, true);
  assert.deepEqual(result.fields[1].options, ['Yes', 'No']);
  assert.equal(result.fields[1].label, 'Work authorization?');
  assert.equal(result.fields.filter((f) => f.open).length, 1);
  assert.equal(result.status, 'partial');
  assert.ok(result.minutes! >= 5);
  assert.equal(
    parseForm('<div id="app"></div>', 'https://example.org').minutes,
    null,
  );
});
test('blocks internal network scraping and unsafe URLs', async () => {
  for (const ip of [
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    '192.168.1.1',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    '0.0.0.0',
  ])
    assert.equal(publicAddress(ip), false, ip);
  assert.equal(publicAddress('8.8.8.8'), true);
  assert.throws(() => webUrl('javascript:alert(1)'));
  assert.throws(() => webUrl('https://user:password@example.org'));
  assert.equal((await indexForm('http://127.0.0.1:443')).status, 'unknown');
});
test('answer matching returns relevant prior work without unrelated answers', () => {
  const answers = [
    {
      question: 'Describe a complex system you built',
      answer: 'A distributed ingestion pipeline',
      company: 'Example',
      slug: 'x',
      saved_at: '2026-09-10',
    },
    {
      question: 'What is your salary expectation?',
      answer: '100k',
      company: 'Other',
      slug: 'y',
      saved_at: '2026-09-09',
    },
  ];
  assert.equal(
    similarAnswers('Tell us about a complex system you built', answers)[0]
      .company,
    'Example',
  );
  assert.equal(similarAnswers('Available start date', answers).length, 0);
});

test('Greenhouse handles resume alternatives and hidden geolocation without double-counting', async () => {
  const { parseGreenhouse, greenhouseEndpoint } =
    await import('../lib/form-index');
  assert.equal(
    greenhouseEndpoint('https://job-boards.greenhouse.io/example/jobs/123'),
    'https://boards-api.greenhouse.io/v1/boards/example/jobs/123?questions=true',
  );
  assert.equal(
    greenhouseEndpoint('https://greenhouse.io.evil.org/example/jobs/123'),
    null,
  );
  const result = parseGreenhouse(
    {
      questions: [
        {
          label: 'Resume',
          required: true,
          fields: [
            { name: 'resume', type: 'input_file' },
            { name: 'resume_text', type: 'textarea' },
          ],
        },
        {
          label: 'Why this company?',
          fields: [{ name: 'why', type: 'textarea' }],
        },
      ],
      location_questions: [
        {
          label: 'Latitude',
          fields: [{ name: 'latitude', type: 'input_hidden' }],
        },
      ],
    },
    'https://example.org',
  );
  assert.equal(result.fields.length, 2);
  assert.equal(result.fields[0].kind, 'file');
  assert.equal(result.fields[1].open, true);
});
