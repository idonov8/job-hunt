'use client';
import { useState } from 'react';
import type { Job } from '@/lib/jobs';
import {
  similarAnswers,
  type HunterState,
  type Action,
} from '@/lib/hunter-model';

export default function Hunter({
  initialJobs,
  initialState,
}: {
  initialJobs: Job[];
  initialState: HunterState;
}) {
  const [jobs, setJobs] = useState(initialJobs);
  const [state, setState] = useState(initialState);
  const [tab, setTab] = useState('discover');
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
  const selected = jobs.filter((j) => state.selected.includes(j.slug));
  const visible = jobs
    .filter((j) =>
      tab === 'queue'
        ? state.selected.includes(j.slug)
        : tab === 'history'
          ? Boolean(j.status)
          : !j.status,
    )
    .filter((j) =>
      `${j.company} ${j.role} ${j.fit_note} ${j.tags.join(' ')}`
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
      if (changes.status === 'pass') {
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
        <a className="brand" href="/">
          ↗{' '}
          <span>
            job hunter<span className="brand-dot">.</span>
          </span>
        </a>
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
        <a className="quiet-link" href="/tracker">
          Classic tracker ↗
        </a>
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
        <div className="dashboard-grid">
          <div className="main-column">
            <div className="page-heading">
              <div>
                <span className="eyebrow">THE OPPORTUNITY BOARD</span>
                <h1>
                  Your next chapter
                  <br />
                  starts with one move.
                </h1>
                <p>Find your fit. Build your shortlist. Get in the zone.</p>
              </div>
              <button onClick={() => setAdding(!adding)}>
                {adding ? 'Close' : '+ Add a role'}
              </button>
            </div>
            <nav className="hunter-tabs" aria-label="Job views">
              {[
                ['discover', 'Discover'],
                ['queue', `Shortlist · ${selected.length}`],
                ['history', 'History'],
                ['answers', 'Answers'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  aria-current={tab === id ? 'page' : undefined}
                  className={tab === id ? 'active' : ''}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </nav>
            {adding && (
              <form
                className="job-add"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const data = Object.fromEntries(new FormData(form));
                  void run(async () => {
                    const result = await request('/api/jobs', data);
                    setJobs([result.job, ...jobs]);
                    setAdding(false);
                  });
                }}
              >
                <label>
                  Company
                  <input name="company" required maxLength={200} />
                </label>
                <label>
                  Role
                  <input name="role" required maxLength={300} />
                </label>
                <label>
                  Application URL
                  <input name="application_url" type="url" required />
                </label>
                <label>
                  Location
                  <input name="city" />
                </label>
                <button disabled={busy} className="primary">
                  Add & index form
                </button>
              </form>
            )}
            {tab === 'answers' ? (
              <div>
                {state.answers.length ? (
                  state.answers.map((a, i) => (
                    <article className="opportunity" key={i}>
                      <span className="eyebrow">
                        {a.company} ·{' '}
                        {new Date(a.saved_at).toLocaleDateString()}
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
                    <h2>Your experience is reusable.</h2>
                    <p>
                      Save answers during a focus session to build your library.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="board-controls">
                  <input
                    aria-label="Search jobs"
                    placeholder="Search roles, companies, skills…"
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
                </div>
                <div className="result-count">
                  {visible.length} opportunities{' '}
                  {tab === 'queue' ? 'in your shortlist' : ''}
                </div>
                {visible.map((job) => (
                  <article
                    className={`opportunity ${state.selected.includes(job.slug) ? 'is-selected' : ''}`}
                    key={job.slug}
                  >
                    <div className="opportunity-top">
                      <div className="company-mark" aria-hidden="true">
                        {job.company.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="company-name">{job.company}</span>
                        <h2>{job.role}</h2>
                      </div>
                      <span className="time-tag">
                        {job.form_index?.minutes
                          ? `~${job.form_index.minutes} min`
                          : 'Time unknown'}
                      </span>
                    </div>
                    <div className="job-tags">
                      {job.city && <span>{job.city}</span>}
                      {job.remote && <span>Remote</span>}
                      {job.employment && <span>{job.employment}</span>}
                      {job.top_fit && (
                        <span className="fit-tag">✦ Strong fit</span>
                      )}
                      {job.fresh && <span>New</span>}
                    </div>
                    <p>
                      {job.fit_note ||
                        'Add a fit note through your scan assistant or the classic tracker.'}
                    </p>
                    <details>
                      <summary>
                        {job.form_index
                          ? `${job.form_index.fields.length} indexed fields · ${job.form_index.fields.filter((f) => f.open).length} open questions`
                          : 'Application details'}
                      </summary>
                      <p>
                        {job.form_index?.note ||
                          'Index the form to estimate the work involved.'}
                      </p>
                      <ul>
                        {job.form_index?.fields.map((f) => (
                          <li key={f.key}>
                            {f.label} · {f.kind}
                            {f.required ? ' · required' : ''}
                            {f.options.length
                              ? ` (${f.options.join(', ')})`
                              : ''}
                          </li>
                        ))}
                      </ul>
                      <button
                        disabled={busy || !(job.application_url || job.url)}
                        onClick={() => void index(job)}
                      >
                        Re-index form
                      </button>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void patch(job, {
                            application_url: String(
                              new FormData(e.currentTarget).get('url'),
                            ),
                          });
                        }}
                      >
                        <label>
                          Direct application URL
                          <input
                            name="url"
                            type="url"
                            defaultValue={job.application_url || job.url || ''}
                            required
                          />
                        </label>
                        <button disabled={busy}>Save & index</button>
                      </form>
                    </details>
                    <footer>
                      <span>
                        {job.status
                          ? job.status
                          : job.tags.slice(0, 3).join(' · ') ||
                            'Ready to explore'}
                      </span>
                      <div>
                        {job.status ? (
                          <button
                            disabled={
                              busy ||
                              state.completed.some((c) => c.slug === job.slug)
                            }
                            onClick={() => void patch(job, { status: '' })}
                          >
                            {state.completed.some((c) => c.slug === job.slug)
                              ? 'XP earned'
                              : 'Reopen'}
                          </button>
                        ) : (
                          <>
                            <button
                              disabled={busy}
                              onClick={() =>
                                void patch(job, { status: 'pass' })
                              }
                            >
                              Discard
                            </button>
                            <button
                              className={
                                state.selected.includes(job.slug)
                                  ? 'selected-button'
                                  : 'primary'
                              }
                              disabled={
                                busy ||
                                state.completed.some((c) => c.slug === job.slug)
                              }
                              onClick={() =>
                                void act({
                                  type: state.selected.includes(job.slug)
                                    ? 'remove'
                                    : 'select',
                                  slug: job.slug,
                                })
                              }
                            >
                              {state.selected.includes(job.slug)
                                ? '✓ Shortlisted'
                                : '+ Shortlist'}
                            </button>
                          </>
                        )}
                      </div>
                    </footer>
                  </article>
                ))}
                {!visible.length && (
                  <div className="empty">
                    <h2>
                      {tab === 'discover'
                        ? 'A fresh start.'
                        : 'Nothing here yet.'}
                    </h2>
                    <p>
                      {tab === 'discover'
                        ? 'Add a role above, or connect your assistant and run a job scan.'
                        : 'Your next move will show up here.'}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
          <aside className="mission-sidebar">
            <section className="session-card">
              <span className="eyebrow">YOUR NEXT SESSION</span>
              <div className="orbit" aria-hidden="true">
                <span>↗</span>
              </div>
              <h2>
                {selected.length
                  ? 'You’ve got a plan.'
                  : 'Make your first move.'}
              </h2>
              <p>
                {selected.length
                  ? `${selected.length} roles shortlisted. One at a time. You’ve got this.`
                  : 'Shortlist roles that interest you, then give each application your full attention.'}
              </p>
              <div className="session-facts">
                <div>
                  <b>{selected.length}</b>
                  <span>in queue</span>
                </div>
                <div>
                  <b>100</b>
                  <span>XP / application</span>
                </div>
              </div>
              <button
                className="primary"
                disabled={busy || !selected.length}
                onClick={() => void act({ type: 'start' })}
              >
                Enter focus mode ↗
              </button>
              <small>Quickest indexed forms first · 2 skips per session</small>
            </section>
            {session?.ended && (
              <section className="session-recap">
                <span className="eyebrow">LAST SESSION</span>
                <h3>{session.done.length * 100} XP earned</h3>
                <p>
                  {session.done.length} completed · {session.skipped.length}{' '}
                  skipped
                </p>
                <p>Skipped and unfinished roles stay in your shortlist.</p>
              </section>
            )}
            <section className="progress-card">
              <span className="eyebrow">SMALL STEPS ADD UP</span>
              <h3>{state.completed.length} applications logged</h3>
              <p>{xp} total XP</p>
              <div className="milestones">
                {[1, 5, 10].map((n) => (
                  <span
                    className={state.completed.length >= n ? 'earned' : ''}
                    key={n}
                  >
                    {state.completed.length >= n ? '✦' : '◇'}{' '}
                    {n === 1 ? 'First move' : `${n} applications`}
                  </span>
                ))}
              </div>
            </section>
            <section className="assistant-card">
              <span className="eyebrow">LET YOUR ASSISTANT SCOUT</span>
              <h3>Fresh roles. Your criteria.</h3>
              <p>
                Use your existing AI subscription to curate jobs through Job
                Hunter’s MCP.
              </p>
              <a href="/scan">Set up your scan ↗</a>
            </section>
          </aside>
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
