'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { Job } from '@/lib/jobs';

type Target = { id: number; group_name: string; name: string; description: string };
type Template = { id: number; title: string; body: string };
type Section = { id: number; heading: string; bullets: string[] };
type Scan = { scanned_on: string; sources: string } | null;

const STATUSES: [string, string][] = [
  ['', '— not started'],
  ['applied', 'Applied'],
  ['talking', 'In conversation'],
  ['offer', 'Offer'],
  ['pass', 'Passed / closed'],
];

const FILTERS = [
  'all', 'new', 'Berlin', 'Israel', 'Remote', 'Part-time', 'Freelance', 'Impact', 'Top fit',
] as const;
const STAT_FILTERS = ['applied', 'talking', 'offer'] as const;
type Filter = (typeof FILTERS)[number] | (typeof STAT_FILTERS)[number];

const FILTER_LABELS: Record<(typeof FILTERS)[number], string> = {
  all: 'All',
  new: 'New this week',
  Berlin: 'Berlin',
  Israel: 'Israel',
  Remote: 'Remote',
  'Part-time': 'Part-time',
  Freelance: 'Freelance',
  Impact: 'Impact',
  'Top fit': 'Top fit',
};

const TABS = [
  ['jobs', 'Openings'],
  ['targets', 'Direct targets'],
  ['outreach', 'Outreach'],
  ['play', 'Playbook'],
] as const;

export default function Hq({
  jobs: initialJobs,
  targets,
  outreach,
  playbook,
  lastScan,
}: {
  jobs: Job[];
  targets: Target[];
  outreach: Template[];
  playbook: Section[];
  lastScan: Scan;
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('jobs');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [hideDone, setHideDone] = useState(false);
  const [saving, setSaving] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  async function patch(slug: string, changes: Partial<Job>) {
    const previous = jobs;
    setJobs((current) => current.map((job) => (job.slug === slug ? { ...job, ...changes } : job)));
    setSaving('Saving…');

    const response = await fetch(`/api/jobs/${encodeURIComponent(slug)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(changes),
    }).catch(() => null);

    if (response?.ok) {
      setSaving('Saved');
      setTimeout(() => setSaving(''), 1400);
    } else {
      setJobs(previous);
      setSaving(response?.status === 401 ? 'Session expired — reload' : 'Save failed');
    }
  }

  async function addJob(input: Record<string, unknown>): Promise<{ ok: true } | { ok: false; error: string }> {
    const response = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }).catch(() => null);

    if (!response) return { ok: false, error: 'Network error — try again.' };
    const data = await response.json().catch(() => ({}) as Record<string, unknown>);

    if (response.ok) {
      setJobs((current) => [data.job as Job, ...current]);
      setSaving('Saved');
      setTimeout(() => setSaving(''), 1400);
      return { ok: true };
    }
    if (response.status === 409) {
      return { ok: false, error: `Already tracked (as "${data.slug}") — edit that entry instead of adding a duplicate.` };
    }
    if (response.status === 401) return { ok: false, error: 'Session expired — reload.' };
    return { ok: false, error: String(data.message ?? data.error ?? 'Could not add the job.') };
  }

  async function logOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  const visible = useMemo(() => {
    const needle = query.toLowerCase().trim();
    return jobs.filter((job) => {
      if (hideDone && job.status === 'pass') return false;
      if (filter === 'new' && !job.fresh) return false;
      if (filter === 'Berlin' && job.city !== 'Berlin') return false;
      if (filter === 'Israel' && job.city !== 'Israel') return false;
      if (filter === 'Remote' && !job.remote && job.city !== 'Remote') return false;
      if (filter === 'Part-time' && job.employment !== 'Part-time') return false;
      if (filter === 'Freelance' && job.employment !== 'Freelance' && job.employment !== 'Contract') return false;
      if (filter === 'Impact' && !job.impact) return false;
      if (filter === 'Top fit' && !job.top_fit) return false;
      if (filter === 'applied' && job.status !== 'applied') return false;
      if (filter === 'talking' && job.status !== 'talking') return false;
      if (filter === 'offer' && job.status !== 'offer') return false;
      if (needle) {
        const hay = `${job.company} ${job.role} ${job.fit_note} ${job.my_notes} ${job.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [jobs, filter, query, hideDone]);

  const count = (status: string) => jobs.filter((job) => job.status === status).length;
  const stats: [number, string, Filter][] = [
    [jobs.length, 'tracked', 'all'],
    [jobs.filter((job) => job.fresh).length, 'new this week', 'new'],
    [count('applied'), 'applied', 'applied'],
    [count('talking'), 'in conversation', 'talking'],
    [count('offer'), 'offers', 'offer'],
    [jobs.filter((job) => job.top_fit).length, 'top fit', 'Top fit'],
  ];

  return (
    <div className="wrap">
      <div className="topline">
        <div>
          <h1>Job Hunt HQ</h1>
          <p className="sub">
            Full-stack / product engineer · Berlin + Israel · freelance, part-time and full-time. Status and
            notes save to the database.
          </p>
        </div>
        <div>
          <div className={saving.includes('fail') || saving.includes('expired') ? 'saving err' : 'saving'}>
            {saving}
          </div>
          <button className="linkbtn" onClick={logOut}>
            Log out
          </button>
        </div>
      </div>

      <div className="stats">
        {stats.map(([value, label, statFilter]) => (
          <button
            key={label}
            className={`stat${filter === statFilter ? ' on' : ''}`}
            onClick={() => {
              setTab('jobs');
              setFilter((current) => (current === statFilter ? 'all' : statFilter));
            }}
          >
            <b>{value}</b>
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="tabs">
        {TABS.map(([id, label]) => (
          <button key={id} className={`tab${tab === id ? ' on' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'jobs' && (
        <div>
          <div className="filters">
            {FILTERS.map((name) => (
              <button
                key={name}
                className={`chip${filter === name ? ' on' : ''}`}
                onClick={() => setFilter(name)}
              >
                {FILTER_LABELS[name]}
              </button>
            ))}
            <input
              className="search"
              placeholder="Search company, role, stack…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button className={`chip${hideDone ? ' on' : ''}`} onClick={() => setHideDone(!hideDone)}>
              Hide passed
            </button>
            <button className="addbtn" onClick={() => setShowAdd((current) => !current)}>
              {showAdd ? 'Cancel' : '+ Add job'}
            </button>
          </div>

          {showAdd && <AddJobForm onSubmit={addJob} onDone={() => setShowAdd(false)} />}

          {visible.length === 0 ? (
            <p style={{ color: 'var(--muted)', padding: '20px 0' }}>Nothing matches that filter.</p>
          ) : (
            visible.map((job) => <JobCard key={job.slug} job={job} onPatch={patch} />)
          )}
        </div>
      )}

      {tab === 'targets' && <Targets targets={targets} />}

      {tab === 'outreach' &&
        outreach.map((template) => (
          <div className="card" key={template.id}>
            <CopyButton text={template.body} />
            <h3>{template.title}</h3>
            <pre className="tpl">{template.body}</pre>
          </div>
        ))}

      {tab === 'play' &&
        playbook.map((section) => (
          <div className="card" key={section.id}>
            <h3>{section.heading}</h3>
            <ul>
              {section.bullets.map((bullet, index) => (
                <li key={index}>{bullet}</li>
              ))}
            </ul>
          </div>
        ))}

      <p className="foot">
        {lastScan
          ? `Last scan ${lastScan.scanned_on} (${lastScan.sources}). `
          : 'No scan recorded yet. '}
        Always confirm the role is still open on the company site before applying.
      </p>
    </div>
  );
}

type AddJobResult = { ok: true } | { ok: false; error: string };

const EMPTY_FORM = {
  company: '',
  role: '',
  url: '',
  city: '',
  employment: '',
  tags: '',
  fit_note: '',
  status: '' as Job['status'],
  top_fit: false,
  impact: false,
  remote: false,
  fresh: false,
};

function AddJobForm({
  onSubmit,
  onDone,
}: {
  onSubmit: (input: Record<string, unknown>) => Promise<AddJobResult>;
  onDone: () => void;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.company.trim() || !form.role.trim()) {
      setError('Company and role are required.');
      return;
    }
    setBusy(true);
    setError('');
    const result = await onSubmit({
      company: form.company.trim(),
      role: form.role.trim(),
      url: form.url.trim(),
      city: form.city.trim(),
      employment: form.employment,
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      fit_note: form.fit_note.trim(),
      status: form.status,
      top_fit: form.top_fit,
      impact: form.impact,
      remote: form.remote,
      fresh: form.fresh,
    });
    setBusy(false);
    if (result.ok) onDone();
    else setError(result.error);
  }

  return (
    <form className="card addform" onSubmit={submit}>
      <div className="addgrid">
        <input
          className="ain"
          placeholder="Company *"
          value={form.company}
          onChange={(event) => set('company', event.target.value)}
        />
        <input
          className="ain"
          placeholder="Role *"
          value={form.role}
          onChange={(event) => set('role', event.target.value)}
        />
        <input
          className="ain wide"
          placeholder="Job URL"
          value={form.url}
          onChange={(event) => set('url', event.target.value)}
        />
        <input
          className="ain"
          list="city-options"
          placeholder="City (Berlin / Israel / Remote)"
          value={form.city}
          onChange={(event) => set('city', event.target.value)}
        />
        <datalist id="city-options">
          <option value="Berlin" />
          <option value="Israel" />
          <option value="Remote" />
        </datalist>
        <select className="ain" value={form.employment} onChange={(event) => set('employment', event.target.value)}>
          <option value="">Employment…</option>
          <option value="Full-time">Full-time</option>
          <option value="Part-time">Part-time</option>
          <option value="Freelance">Freelance</option>
          <option value="Contract">Contract</option>
        </select>
        <select
          className="ain"
          value={form.status}
          onChange={(event) => set('status', event.target.value as Job['status'])}
        >
          {STATUSES.map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          className="ain wide"
          placeholder="Tags, comma separated"
          value={form.tags}
          onChange={(event) => set('tags', event.target.value)}
        />
        <textarea
          className="ain wide atext"
          placeholder="Fit note — why this is worth his time"
          value={form.fit_note}
          onChange={(event) => set('fit_note', event.target.value)}
        />
      </div>
      <div className="addflags">
        <label>
          <input type="checkbox" checked={form.top_fit} onChange={(event) => set('top_fit', event.target.checked)} />
          Top fit
        </label>
        <label>
          <input type="checkbox" checked={form.impact} onChange={(event) => set('impact', event.target.checked)} />
          Impact
        </label>
        <label>
          <input type="checkbox" checked={form.remote} onChange={(event) => set('remote', event.target.checked)} />
          Remote
        </label>
        <label>
          <input type="checkbox" checked={form.fresh} onChange={(event) => set('fresh', event.target.checked)} />
          New this week
        </label>
      </div>
      {error && <p className="adderr">{error}</p>}
      <div className="addactions">
        <button type="submit" className="addsave" disabled={busy}>
          {busy ? 'Adding…' : 'Add job'}
        </button>
      </div>
    </form>
  );
}

function JobCard({ job, onPatch }: { job: Job; onPatch: (slug: string, changes: Partial<Job>) => void }) {
  const [note, setNote] = useState(job.my_notes);

  return (
    <div className={`job${job.status === 'pass' ? ' done' : ''}`}>
      <div>
        <p className="jt">
          {job.url ? (
            <a href={job.url} target="_blank" rel="noopener noreferrer">
              {job.role}
            </a>
          ) : (
            job.role
          )}
        </p>
        <p className="jc">{job.company}</p>
        <p className="jn">{job.fit_note}</p>
        <div className="tags">
          {job.city && <span className="tag city">{job.city}</span>}
          {job.employment && <span className="tag type">{job.employment}</span>}
          {job.fresh && <span className="tag new">new</span>}
          {job.impact && <span className="tag impact">impact</span>}
          {job.top_fit && <span className="tag hot">top fit</span>}
          {job.tags.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div className="right">
        <select
          className="st"
          data-v={job.status}
          value={job.status}
          onChange={(event) => onPatch(job.slug, { status: event.target.value as Job['status'] })}
        >
          {STATUSES.map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
        <textarea
          className="note"
          placeholder="notes…"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => note !== job.my_notes && onPatch(job.slug, { my_notes: note })}
        />
      </div>
    </div>
  );
}

function Targets({ targets }: { targets: Target[] }) {
  const groups = targets.reduce<Record<string, Target[]>>((acc, target) => {
    (acc[target.group_name] ??= []).push(target);
    return acc;
  }, {});

  return (
    <>
      {Object.entries(groups).map(([heading, items]) => (
        <div className="card" key={heading}>
          <h3>{heading}</h3>
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <b>{item.name}</b> — {item.description}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

function CopyButton({ text }: { text: string }) {
  const [label, setLabel] = useState('Copy');

  return (
    <button
      className="copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setLabel('Copied');
        } catch {
          setLabel('Press ⌘C');
        }
        setTimeout(() => setLabel('Copy'), 1400);
      }}
    >
      {label}
    </button>
  );
}
