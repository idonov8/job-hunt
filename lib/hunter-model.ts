export type Field = {
  key: string;
  label: string;
  kind: string;
  required: boolean;
  options: string[];
  open: boolean;
};
export type FormIndex = {
  status: 'indexed' | 'partial' | 'unknown';
  url: string;
  indexed_at: string;
  fields: Field[];
  minutes: number | null;
  note: string;
};
export type Answer = {
  question: string;
  answer: string;
  company: string;
  slug: string;
  saved_at: string;
};
export type HunterState = {
  selected: string[];
  completed: { slug: string; at: string }[];
  answers: Answer[];
  session: null | {
    queue: string[];
    skipped: string[];
    done: string[];
    ended: boolean;
  };
};
export const EMPTY_STATE: HunterState = {
  selected: [],
  completed: [],
  answers: [],
  session: null,
};
export type Action = {
  type: 'select' | 'remove' | 'start' | 'skip' | 'complete' | 'end';
  slug?: string;
  answers?: { question: string; answer: string }[];
};
export function transition(input: HunterState, action: Action): HunterState {
  const state = structuredClone(input);
  const slug = action.slug;
  if (action.type === 'select') {
    if (!slug) throw new Error('Choose a job');
    if (!state.selected.includes(slug)) state.selected.push(slug);
  } else if (action.type === 'remove')
    state.selected = state.selected.filter((s) => s !== slug);
  else if (action.type === 'start') {
    if (state.session && !state.session.ended)
      throw new Error('Resume or end the current session first');
    if (!state.selected.length) throw new Error('Select at least one job');
    state.session = {
      queue: [...state.selected],
      skipped: [],
      done: [],
      ended: false,
    };
  } else if (action.type === 'end') {
    if (state.session) state.session.ended = true;
  } else {
    const session = state.session;
    if (
      action.type === 'complete' &&
      state.completed.some((c) => c.slug === slug)
    )
      return state;
    if (!session || session.ended || session.queue[0] !== slug)
      throw new Error(
        'This application is no longer current; reload the session',
      );
    if (action.type === 'skip') {
      if (session.skipped.length >= 2)
        throw new Error(
          'No skips left. Finish this application or end the session.',
        );
      session.skipped.push(slug!);
    } else if (action.type === 'complete') {
      session.done.push(slug!);
      state.completed.push({ slug: slug!, at: new Date().toISOString() });
      state.selected = state.selected.filter((s) => s !== slug);
    } else throw new Error('Unknown action');
    session.queue.shift();
    session.ended = !session.queue.length;
  }
  return state;
}
export function similarAnswers(question: string, answers: Answer[]): Answer[] {
  // ponytail: lexical overlap misses paraphrases; add user-reviewed topic tags if needed.
  const words = (text: string) =>
    new Set(
      text
        .toLowerCase()
        .match(/[a-z]{4,}/g)
        ?.filter(
          (w) =>
            ![
              'that',
              'this',
              'with',
              'your',
              'have',
              'what',
              'describe',
              'about',
              'were',
              'when',
              'which',
            ].includes(w),
        ) ?? [],
    );
  const q = words(question);
  return answers
    .map((a) => {
      const tokens = words(a.question);
      return {
        a,
        score:
          [...q].filter((w) => tokens.has(w)).length /
          Math.max(1, new Set([...q, ...tokens]).size),
      };
    })
    .filter((x) => x.score >= 0.2)
    .sort(
      (a, b) => b.score - a.score || b.a.saved_at.localeCompare(a.a.saved_at),
    )
    .slice(0, 3)
    .map((x) => x.a);
}
