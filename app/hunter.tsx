'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Job } from '@/lib/jobs';
import {
  similarAnswers,
  type HunterState,
  type Action,
} from '@/lib/hunter-model';

export default function Hunter({
  initialJobs,
  initialState,
  lastScan,
}: {
  initialJobs: Job[];
  initialState: HunterState;
  lastScan: { scanned_on: string; sources: string } | null;
}) {
  const [jobs, setJobs] = useState(initialJobs);
  const [state, setState] = useState(initialState);
  const router = useRouter();
  const [tab, setTab] = useState('openings');
  const [filter, setFilter] = useState('all');
  const [city, setCity] = useState('');
  const [employment, setEmployment] = useState('');
  const [remote, setRemote] = useState(false);
  const [impact, setImpact] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('fit');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [adding, setAdding] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [question, setQuestion] = useState('');
  const [custom, setCustom] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const session = state.session;
  const active = session && !session.ended;
  const current = jobs.find((j) => j.slug === session?.queue[0]);
  const xp = state.completed.length * 100;
  const level = Math.floor(xp / 500) + 1;
  const selected = jobs.filter(
    (j) => !j.status && state.selected.includes(j.slug),
  );
  const queueMinutes = selected.reduce(
    (sum, j) => sum + (j.form_index?.minutes ?? 0),
    0,
  );
  const stats: [number, string, string][] = [
    [jobs.length, 'Tracked', 'tracked'],
    [jobs.filter((j) => j.fresh).length, 'New this week', 'new'],
    [jobs.filter((j) => j.status === 'applied').length, 'Applied', 'applied'],
    [
      jobs.filter((j) => j.status === 'talking').length,
      'In conversation',
      'talking',
    ],
    [jobs.filter((j) => j.status === 'offer').length, 'Offers', 'offer'],
    [jobs.filter((j) => j.top_fit).length, 'Top fit', 'top_fit'],
  ];
  const visible = jobs
    .filter((j) =>
      filter !== 'all'
        ? true
        : tab === 'queue'
          ? !j.status && state.selected.includes(j.slug)
          : tab === 'history'
            ? Boolean(j.status)
            : !j.status,
    )
    .filter((j) =>
      filter === 'new'
        ? j.fresh
        : filter === 'top_fit'
          ? j.top_fit
          : ['applied', 'talking', 'offer', 'pass'].includes(filter)
            ? j.status === filter
            : true,
    )
    .filter(
      (j) =>
        (!city || j.city === city) &&
        (!employment || j.employment === employment) &&
        (!remote || j.remote || j.city === 'Remote') &&
        (!impact || j.impact),
    )
    .filter((j) =>
      `${j.company} ${j.role} ${j.fit_note} ${j.my_notes} ${j.tags.join(' ')}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'time'
        ? (a.form_index?.minutes ?? Infinity) -
          (b.form_index?.minutes ?? Infinity)
        : Number(b.top_fit) - Number(a.top_fit) ||
          Number(b.fresh) - Number(a.fresh),
    );

  async function request(url: string, body?: unknown, method = 'POST') {
    const response = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data.message || data.error || 'Could not save. Try again.',
      );
    return data;
  }
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await work();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Something went wrong',
      );
    } finally {
      setBusy(false);
    }
  }
  function act(action: Action) {
    return run(async () => {
      const { state: next } = await request('/api/hunter', action);
      setState(next);
      if (['complete', 'skip', 'end'].includes(action.type)) {
        setDrafts({});
        setQuestion('');
        setCustom('');
        setConfirmed(false);
      }
      if (action.type === 'complete') {
        setJobs(
          jobs.map((j) =>
            j.slug === action.slug ? { ...j, status: 'applied' } : j,
          ),
        );
        setMessage('+100 XP · Application logged. Nice work.');
      }
    });
  }
  function patch(job: Job, changes: Partial<Job>) {
    return run(async () => {
      const { job: updated } = await request(
        `/api/jobs/${encodeURIComponent(job.slug)}`,
        changes,
        'PATCH',
      );
      setJobs(jobs.map((j) => (j.slug === job.slug ? updated : j)));
      if (changes.status) {
        const { state: next } = await request('/api/hunter', {
          type: 'remove',
          slug: job.slug,
        });
        setState(next);
      }
    });
  }
  const index = (job: Job) =>
    run(async () => {
      const { job: updated } = await request(
        `/api/jobs/${encodeURIComponent(job.slug)}/index`,
      );
      setJobs(jobs.map((j) => (j.slug === job.slug ? updated : j)));
    });
  const complete = () => {
    if (!current || !confirmed) return;
    const answers = Object.entries(drafts)
      .filter(([, answer]) => answer.trim())
      .map(([question, answer]) => ({ question, answer }));
    if (question.trim() && custom.trim())
      answers.push({ question, answer: custom });
    return act({ type: 'complete', slug: current.slug, answers });
  };

  return (
    <main className={`hunter ${active ? 'focus-mode' : ''}`}>
      <header className="hunter-header">
        <div>
          <h1 className="brand">
            <a href="/">Job Hunter</a>
          </h1>
          {!active && (
            <p className="header-note">
              Your jobs, applications, and next steps.
            </p>
          )}
        </div>
        <div className="level">
          <span className="level-badge">{level}</span>
          <div>
            <b>
              Level {level} ·{' '}
              {
                ['Explorer', 'Pathfinder', 'Trailblazer', 'Pioneer'][
                  Math.min(level - 1, 3)
                ]
              }
            </b>
            <progress
              aria-label="Experience toward next level"
              max={500}
              value={xp % 500}
            />
            <small>
              {xp % 500} / 500 XP to level {level + 1}
            </small>
          </div>
        </div>
        <button
          className="quiet-link"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await request('/api/auth/logout');
              router.replace('/login');
              router.refresh();
            })
          }
        >
          Log out
        </button>
      </header>
      <div className="notice" role="status" aria-live="polite">
        {busy ? 'Saving…' : message}
      </div>
      {active ? (
        <>
          <div className="session-heading">
            <div>
              <span className="eyebrow">FOCUS SESSION</span>
              <h1>One application. All your attention.</h1>
            </div>
            <button
              disabled={busy}
              onClick={() => {
                if (
                  (!Object.values(drafts).some(Boolean) && !custom) ||
                  window.confirm(
                    'End session and discard unsaved answer notes?',
                  )
                )
                  void act({ type: 'end' });
              }}
            >
              End session
            </button>
          </div>
          <div className="session-meter">
            <span>{session.done.length} completed</span>
            <progress
              aria-label="Session progress"
              max={
                session.done.length +
                session.skipped.length +
                session.queue.length
              }
              value={session.done.length}
            />
            <span>
              {session.queue.length} to go · {2 - session.skipped.length} skips
              left
            </span>
          </div>
          {current ? (
            <div className="focus-grid">
              <aside>
                <span className="eyebrow">YOUR NEXT MOVE</span>
                <h2>{current.role}</h2>
                <p className="company-name">{current.company}</p>
                <p>
                  {current.city} · {current.employment}
                </p>
                <section>
                  <h3>About the company</h3>
                  <p>
                    {current.company_summary ||
                      'No company summary yet. Your next scan can fill this in.'}
                  </p>
                </section>
                <section>
                  <h3>Why you fit</h3>
                  <p>{current.fit_note || 'No fit note yet.'}</p>
                </section>
                <section>
                  <h3>Your connection</h3>
                  <p>{current.connection_note || 'No connection recorded.'}</p>
                </section>
                <span className="time-tag">
                  {current.form_index?.minutes
                    ? `~${current.form_index.minutes} min · ${current.form_index.fields.length} fields`
                    : 'Time unknown'}
                </span>
              </aside>
              <div className="form-stage">
                <div className="form-toolbar">
                  <b>Application form</b>
                  {(current.application_url || current.url) && (
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      href={(current.application_url || current.url)!}
                    >
                      Open in new tab ↗
                    </a>
                  )}
                </div>
                <p className="frame-help">
                  If the form is blocked or sign-in fails here, use the new-tab
                  link. Return here when you’re done.
                </p>
                {current.application_url || current.url ? (
                  <iframe
                    key={current.slug}
                    title={`Application to ${current.company}`}
                    src={(current.application_url || current.url)!}
                    referrerPolicy="no-referrer"
                    sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                  />
                ) : (
                  <div className="empty">
                    Add the application link from the job card first.
                  </div>
                )}
                <div className="complete-bar">
                  <label>
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />{' '}
                    I submitted this application on the company’s site.
                  </label>
                  <div>
                    <button
                      disabled={busy || session.skipped.length >= 2}
                      onClick={() => {
                        if (
                          (!Object.values(drafts).some(Boolean) && !custom) ||
                          window.confirm(
                            'Skip and discard unsaved answer notes?',
                          )
                        )
                          void act({ type: 'skip', slug: current.slug });
                      }}
                    >
                      Skip ({2 - session.skipped.length} left)
                    </button>
                    <button
                      className="primary"
                      disabled={busy || !confirmed}
                      onClick={complete}
                    >
                      Log application · +100 XP ↗
                    </button>
                  </div>
                </div>
              </div>
              <aside className="answer-panel">
                <span className="eyebrow">YOUR ANSWER LIBRARY</span>
                <h2>Don’t start from scratch.</h2>
                <p>
                  Save the answers you actually submit. They’ll be here for the
                  next application.
                </p>
                {current.form_index?.fields
                  .filter((f) => f.open)
                  .map((f) => (
                    <section key={f.key}>
                      <label htmlFor={`answer-${f.key}`}>{f.label}</label>
                      <textarea
                        id={`answer-${f.key}`}
                        value={drafts[f.label] || ''}
                        onChange={(e) =>
                          setDrafts({ ...drafts, [f.label]: e.target.value })
                        }
                        placeholder="Your submitted answer…"
                      />
                      <Suggestions
                        question={f.label}
                        answers={state.answers}
                        onUse={(answer) =>
                          setDrafts({ ...drafts, [f.label]: answer })
                        }
                      />
                    </section>
                  ))}
                <section>
                  <label htmlFor="custom-question">Another question</label>
                  <input
                    id="custom-question"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="e.g. Describe a complex system you built"
                  />
                  <label htmlFor="custom-answer">Your answer</label>
                  <textarea
                    id="custom-answer"
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    placeholder="Paste what you submitted…"
                  />
                  <Suggestions
                    question={question}
                    answers={state.answers}
                    onUse={setCustom}
                  />
                  <button
                    disabled={!question.trim() || !custom.trim()}
                    onClick={() => {
                      setDrafts({ ...drafts, [question]: custom });
                      setQuestion('');
                      setCustom('');
                    }}
                  >
                    Keep this answer in session
                  </button>
                </section>
                {Object.entries(drafts)
                  .filter(
                    ([q]) =>
                      !current.form_index?.fields.some(
                        (f) => f.open && f.label === q,
                      ),
                  )
                  .map(([q, a]) => (
                    <section key={q}>
                      <label>
                        {q}
                        <textarea
                          value={a}
                          onChange={(e) =>
                            setDrafts({ ...drafts, [q]: e.target.value })
                          }
                        />
                      </label>
                    </section>
                  ))}
                <small>Answer notes save when you log the application.</small>
              </aside>
            </div>
          ) : (
            <div className="empty">
              This job is no longer available. End the session to refresh your
              queue.
            </div>
          )}
        </>
      ) : (
        <div className="board">
          <div className="board-layout">
            <div className="board-main">
              <div className="hq-stats" aria-label="Application overview">
            {stats.map(([value, label, key]) => (
              <button
                key={key}
                className={filter === key ? 'on' : ''}
                aria-pressed={filter === key}
                onClick={() => {
                  setTab(
                    ['applied', 'talking', 'offer'].includes(key)
                      ? 'history'
                      : 'openings',
                  );
                  setFilter(filter === key ? 'all' : key);
                  setCity('');
                  setEmployment('');
                  setRemote(false);
                  setImpact(false);
                  setQuery('');
                }}
              >
                <b>{value}</b>
                <span>{label}</span>
              </button>
            ))}
              </div>
              <a className="scan-setup-link" href="/scan">
                Set up automated job scan with your agent
              </a>
              <nav className="hunter-tabs" aria-label="Job views">
            {[
              ['openings', 'Openings'],
              ['queue', `Application Queue · ${selected.length}`],
              ['history', 'History'],
              ['answers', 'Answers'],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-current={tab === id ? 'page' : undefined}
                className={tab === id ? 'active' : ''}
                onClick={() => {
                  setTab(id);
                  setFilter('all');
                }}
              >
                {label}
              </button>
            ))}
              </nav>
              {tab === 'answers' ? (
            <div>
              {state.answers.length ? (
                state.answers.map((a, i) => (
                  <article className="opportunity" key={i}>
                    <span className="eyebrow">
                      {a.company} · {new Date(a.saved_at).toLocaleDateString()}
                    </span>
                    <h2>{a.question}</h2>
                    <p className="answer-text">{a.answer}</p>
                    <button
                      onClick={() =>
                        void run(async () => {
                          await navigator.clipboard.writeText(a.answer);
                          setMessage('Answer copied');
                        })
                      }
                    >
                      Copy answer
                    </button>
                  </article>
                ))
              ) : (
                <div className="empty">
                  <h2>Your answer library</h2>
                  <p>
                    Save answers during an application session to reuse them
                    next time.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="board-controls">
                <input
                  aria-label="Search jobs"
                  placeholder="Search company, role, notes, skills…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <select
                  aria-label="Sort jobs"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="fit">Best fit first</option>
                  <option value="time">Quickest applications</option>
                </select>
                <button onClick={() => setAdding(!adding)}>
                  {adding ? 'Cancel' : '+ Add job'}
                </button>
              </div>
              <div className="board-filters">
                <select
                  aria-label="Filter by location"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                >
                  <option value="">All locations</option>
                  {Array.from(
                    new Set(
                      jobs
                        .map((j) => j.city)
                        .filter((c): c is string => Boolean(c)),
                    ),
                  )
                    .sort()
                    .map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                </select>
                <select
                  aria-label="Filter by employment"
                  value={employment}
                  onChange={(e) => setEmployment(e.target.value)}
                >
                  <option value="">All employment</option>
                  {['Full-time', 'Part-time', 'Freelance', 'Contract'].map(
                    (t) => (
                      <option key={t}>{t}</option>
                    ),
                  )}
                </select>
                <label>
                  <input
                    type="checkbox"
                    checked={remote}
                    onChange={(e) => setRemote(e.target.checked)}
                  />
                  Remote
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={impact}
                    onChange={(e) => setImpact(e.target.checked)}
                  />
                  Impact
                </label>
              </div>
              {filter !== 'all' && (
                <p className="active-filter">
                  Showing{' '}
                  {stats.find(([, , key]) => key === filter)?.[1].toLowerCase()}{' '}
                  <button onClick={() => setFilter('all')}>Clear filter</button>
                </p>
              )}
              {adding && (
                <JobForm
                  busy={busy}
                  onSave={(data) =>
                    run(async () => {
                      const result = await request('/api/jobs', data);
                      setJobs([result.job, ...jobs]);
                      setAdding(false);
                    })
                  }
                />
              )}

              <p className="result-count">
                {visible.length} {visible.length === 1 ? 'job' : 'jobs'}
                {tab === 'queue' ? ' in queue' : ''}
              </p>
              {visible.map((job) => (
                <JobCard
                  key={job.slug}
                  job={job}
                  busy={busy}
                  queued={state.selected.includes(job.slug)}
                  completed={state.completed.some((c) => c.slug === job.slug)}
                  onPatch={(changes) => patch(job, changes)}
                  onIndex={() => index(job)}
                  onApply={() =>
                    act({
                      type: state.selected.includes(job.slug)
                        ? 'remove'
                        : 'select',
                      slug: job.slug,
                    })
                  }
                />
              ))}
              {!visible.length && (
                <div className="empty">
                  <h2>
                    {query || filter !== 'all'
                      ? 'No matching jobs'
                      : tab === 'queue'
                        ? 'Your application queue is empty'
                        : 'No jobs here yet'}
                  </h2>
                  <p>
                    {tab === 'queue'
                      ? 'Choose Apply on an opening to add it to your queue.'
                      : 'Add a job or ask your agent to run a scan.'}
                  </p>
                </div>
              )}
            </>
              )}
              {session?.ended && (
                <p className="session-recap">
                  Last session: {session.done.length} completed ·{' '}
                  {session.done.length * 100} XP · {session.skipped.length} skipped.
                  Skipped and unfinished jobs stay in your application queue.
                </p>
              )}
              <p className="foot">
                {lastScan
                  ? `Last scan ${lastScan.scanned_on}${lastScan.sources ? ` · ${lastScan.sources}` : ''}`
                  : 'No scan recorded yet.'}
              </p>
            </div>
            <aside className="overview-sidebar">
              <section className="sidebar-card session-card-light">
                <span className="eyebrow">YOUR NEXT SESSION</span>
                <div className="session-orbit" aria-hidden="true">↗</div>
                <h2>{selected.length ? 'You’ve got a plan.' : 'Make your first move.'}</h2>
                <p>{selected.length ? `${selected.length} ${selected.length === 1 ? 'role' : 'roles'} queued. One at a time.` : 'Apply to roles that interest you, then give each application your full attention.'}</p>
                <div className="sidebar-facts"><div><b>{selected.length}</b><span>in queue</span></div><div><b>~{queueMinutes}m</b><span>estimated time</span></div></div>
                <button className="primary sidebar-wide" disabled={busy || !selected.length} onClick={() => void act({ type: 'start' })}>Start applications ↗</button>
              </section>
              {session?.ended && <section className="sidebar-card"><span className="eyebrow">LAST SESSION</span><h3>{session.done.length * 100} XP earned</h3><p>{session.done.length} completed · {session.skipped.length} skipped</p><p>Skipped and unfinished roles stay in your application queue.</p></section>}
              <section className="sidebar-card"><span className="eyebrow">SMALL STEPS ADD UP</span><h3>{state.completed.length} applications logged</h3><p>{xp} total XP</p><div className="milestones">{[1, 5, 10].map(n => <span className={state.completed.length >= n ? 'earned' : ''} key={n}>{state.completed.length >= n ? '✦' : '◇'} {n === 1 ? 'First move' : `${n} applications`}</span>)}</div></section>
              <section className="sidebar-card assistant-card-light"><span className="eyebrow">LET YOUR AGENT SCOUT</span><h3>Fresh roles. Your criteria.</h3><p>Use your existing subscription to keep the openings board fresh.</p><a href="/scan">Set up automated job scan ↗</a></section>
            </aside>
          </div>
        </div>
      )}
    </main>
  );
}
function Suggestions({
  question,
  answers,
  onUse,
}: {
  question: string;
  answers: HunterState['answers'];
  onUse: (value: string) => void;
}) {
  return (
    <>
      {similarAnswers(question, answers).map((a, i) => (
        <details className="suggestion" key={i}>
          <summary>Previous answer · {a.company}</summary>
          <b>{a.question}</b>
          <p className="answer-text">{a.answer}</p>
          <button onClick={() => onUse(a.answer)}>Use as starting point</button>
        </details>
      ))}
    </>
  );
}

const JOB_STATUSES = [
  ['', 'Not started'],
  ['applied', 'Applied'],
  ['talking', 'In conversation'],
  ['offer', 'Offer'],
  ['pass', 'Passed / closed'],
];
function JobCard({
  job,
  busy,
  queued,
  completed,
  onPatch,
  onIndex,
  onApply,
}: {
  job: Job;
  busy: boolean;
  queued: boolean;
  completed: boolean;
  onPatch: (changes: Partial<Job>) => Promise<void>;
  onIndex: () => Promise<void>;
  onApply: () => Promise<void>;
}) {
  const [note, setNote] = useState(job.my_notes);
  return (
    <article
      className={`opportunity ${queued && !job.status ? 'is-selected' : ''} ${job.status === 'pass' ? 'passed' : ''}`}
    >
      <div className="job-summary">
        <div>
          <h2>
            {job.url || job.application_url ? (
              <a
                href={(job.url || job.application_url)!}
                target="_blank"
                rel="noopener noreferrer"
              >
                {job.role}
              </a>
            ) : (
              job.role
            )}
          </h2>
          <p className="company-name">{job.company}</p>
          <p>{job.fit_note || 'No fit note yet.'}</p>
          <div className="job-tags">
            {job.city && <span className="tag city">{job.city}</span>}
            {job.employment && (
              <span className="tag type">{job.employment}</span>
            )}
            {job.remote && <span className="tag">Remote</span>}
            {job.fresh && <span className="tag new">New</span>}
            {job.impact && <span className="tag impact">Impact</span>}
            {job.top_fit && <span className="tag hot">Top fit</span>}
            {job.tags.map((t) => (
              <span className="tag" key={t}>
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="job-actions">
          <span className="time-tag">
            {job.form_index?.minutes
              ? `~${job.form_index.minutes} min`
              : 'Time unknown'}
          </span>
          <label>
            Status
            <select
              aria-label={`Status for ${job.company} ${job.role}`}
              value={job.status}
              disabled={busy}
              onChange={(e) =>
                void onPatch({ status: e.target.value as Job['status'] })
              }
            >
              {JOB_STATUSES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="job-buttons">
            {!job.status && (
              <>
                <button
                  disabled={busy}
                  onClick={() => void onPatch({ status: 'pass' })}
                >
                  Discard
                </button>
                <button
                  className={queued ? 'selected-button' : 'primary'}
                  disabled={busy || completed}
                  onClick={() => void onApply()}
                >
                  {queued
                    ? 'Remove from queue'
                    : completed
                      ? 'XP earned'
                      : 'Apply'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <form
        className="job-notes"
        onSubmit={(e) => {
          e.preventDefault();
          void onPatch({ my_notes: note });
        }}
      >
        <label>
          My notes
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Notes, follow-ups, things to ask…"
          />
        </label>
        <button disabled={busy || note === job.my_notes}>Save notes</button>
      </form>
      <details className="job-detail">
        <summary>
          Company & application details
          {job.form_index
            ? ` · ${job.form_index.fields.length} fields · ${job.form_index.fields.filter((f) => f.open).length} open questions`
            : ''}
        </summary>
        <div className="company-context">
          <section>
            <h3>About the company</h3>
            <p>{job.company_summary || 'No company summary yet.'}</p>
          </section>
          <section>
            <h3>Your connection</h3>
            <p>{job.connection_note || 'No connection recorded.'}</p>
          </section>
        </div>
        {job.source && <p>Source: {job.source}</p>}
        <p>
          First seen {job.first_seen} · Last seen {job.last_seen}
        </p>
        <p>
          {job.form_index?.note ||
            'Index the application form to estimate the time involved.'}
        </p>
        <ul>
          {job.form_index?.fields.map((f) => (
            <li key={f.key}>
              {f.label} · {f.kind}
              {f.required ? ' · required' : ''}
              {f.options.length ? ` (${f.options.join(', ')})` : ''}
            </li>
          ))}
        </ul>
        <button
          disabled={busy || !(job.application_url || job.url)}
          onClick={() => void onIndex()}
        >
          Re-index form
        </button>
        <details className="edit-job">
          <summary>Edit job information</summary>
          <JobForm job={job} busy={busy} onSave={onPatch} />
        </details>
      </details>
    </article>
  );
}
function JobForm({
  job,
  busy,
  onSave,
}: {
  job?: Job;
  busy: boolean;
  onSave: (data: Partial<Job>) => Promise<void>;
}) {
  return (
    <form
      className="job-add"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        void onSave({
          ...Object.fromEntries(data),
          tags: String(data.get('tags') || '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          remote: data.has('remote'),
          fresh: data.has('fresh'),
          top_fit: data.has('top_fit'),
          impact: data.has('impact'),
        } as Partial<Job>);
      }}
    >
      <label>
        Company
        <input
          name="company"
          defaultValue={job?.company}
          required
          maxLength={200}
        />
      </label>
      <label>
        Role
        <input name="role" defaultValue={job?.role} required maxLength={300} />
      </label>
      <label>
        Posting URL
        <input name="url" type="url" defaultValue={job?.url || ''} />
      </label>
      <label>
        Direct application URL
        <input
          name="application_url"
          type="url"
          defaultValue={job?.application_url || ''}
        />
      </label>
      <label>
        Location
        <input name="city" defaultValue={job?.city || ''} />
      </label>
      <label>
        Employment
        <select name="employment" defaultValue={job?.employment || ''}>
          {['', 'Full-time', 'Part-time', 'Freelance', 'Contract'].map(
            (value) => (
              <option key={value} value={value}>
                {value || 'Not specified'}
              </option>
            ),
          )}
        </select>
      </label>
      <label>
        Tags, comma separated
        <input name="tags" defaultValue={job?.tags.join(', ')} />
      </label>
      <label>
        Fit note
        <textarea name="fit_note" defaultValue={job?.fit_note} />
      </label>
      <label>
        Company summary
        <textarea name="company_summary" defaultValue={job?.company_summary} />
      </label>
      <label>
        Your connection
        <textarea name="connection_note" defaultValue={job?.connection_note} />
      </label>
      <div className="addflags">
        {[
          ['remote', 'Remote'],
          ['fresh', 'New this week'],
          ['top_fit', 'Top fit'],
          ['impact', 'Impact'],
        ].map(([name, label]) => (
          <label key={name}>
            <input
              type="checkbox"
              name={name}
              defaultChecked={Boolean(job?.[name as keyof Job])}
            />
            {label}
          </label>
        ))}
      </div>
      <button disabled={busy} className="primary">
        {job ? 'Save job' : 'Add job'}
      </button>
    </form>
  );
}
