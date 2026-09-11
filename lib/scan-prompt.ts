export function scanPrompt(
  preferences = '[Roles, seniority, location, remote policy, salary, industries, dealbreakers, and what interests me. Include my background and any company connections.]',
  cadence = 'daily',
) {
  return `Run a ${cadence} job scan using the connected Job Hunter MCP.

MY INTERESTS & BACKGROUND
${preferences}

Call get_job_fields first and use its current response for every opening in this scan. Then read list_jobs, find relevant openings, and verify them on the company’s site. Add new matches with add_job; use update_job for jobs already tracked. Fill every applicable field requested by get_job_fields and omit unknown optional facts rather than guessing.

Keep my notes, decisions, and history. Set fresh for jobs found in the past seven days; update last_seen only when re-verified. Use index_form for missing or stale application details.

Finish with record_scan and a short summary of new matches, changes, and anything that needs my attention.`;
}

export function setupPrompt(mcpUrl: string) {
  return `Help me set up Job Hunter with this agent.

First, connect the local Job Hunter MCP:
1. Connect to ${mcpUrl} using my AGENT_TOKEN as the Bearer token. Ask me for the token if needed and keep it private.
2. Call get_job_fields to verify the connection.
3. Make sure this agent can read my Gmail. Ask me to connect or authorize it if needed.

Then prepare my job-search profile. Fill in what you already know from our conversations, memory, connected files, or an uploaded CV. Ask me only for what is missing:
- How often should the job scan run: daily, weekly, twice a week, or another schedule?
- What kinds of jobs am I looking for: roles, seniority, location/remote preferences, industries, compensation, interests, and dealbreakers?
- What professional experience should guide the search? Let me answer directly or upload a CV.

Show me the completed profile and proposed schedules, then create two separate recurring routines:

DAILY APPLICATION INBOX BRIEF
Every day, sweep Gmail since the last successful brief for real replies from companies and recruiters: rejections, interview invitations, availability requests, take-home tasks, and recruiter outreach. Only inspect job-hunt mail, not the rest of my inbox. Open the full email thread before judging it. Match each message to the correct tracked role and use the Job Hunter MCP to update the tracker to reflect exactly what the email says. Preserve my notes and history, never infer a completion I have not confirmed, and flag ambiguous matches for me. Finish with a concise brief of changes and anything needing my attention.

PERSONALIZED JOB SCAN
Run on the schedule I chose. At the start of every scan, call get_job_fields and use its current response when filling each opening. Use my completed profile, what you learn from my feedback and tracker history, current hiring patterns, and relevant advances in technology to decide how to search. Do not freeze the search into a permanent list of fields, titles, keywords, or sources. Read existing jobs first, find relevant openings, verify important facts on primary sources, and use the Job Hunter MCP to add or update only well-supported matches. Preserve my notes, decisions, and history. Record the scan and summarize new matches, changes, uncertainties, and anything needing my attention.

Keep the two routines separate. Run each once now as a connection check before scheduling it. If this agent cannot connect to an HTTP MCP server or run recurring routines, explain the smallest compatible setup instead.`;
}
