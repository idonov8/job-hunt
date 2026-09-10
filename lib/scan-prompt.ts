export function scanPrompt(
  preferences = '[Roles, seniority, location, remote policy, salary, industries, dealbreakers, and what interests me. Include my background and any company connections.]',
  cadence = 'daily',
) {
  return `Run a ${cadence} job scan using the connected Job Hunter MCP.

MY INTERESTS & BACKGROUND
${preferences}

Read list_jobs, then find relevant openings and verify them on the company’s site. Add new matches with add_job; use update_job for jobs already tracked.

For each job include:
• company, role, url (posting), application_url (direct form)
• city, employment, remote, tags, top_fit, impact, fresh
• fit_note: why it fits my experience, including gaps and tradeoffs
• company_summary: what the company does and relevant verified facts
• connection_note: my actual connections or relevant past work; say when unknown
• source: supporting URLs; first_seen and last_seen: YYYY-MM-DD

Keep my notes, decisions, and history. Set fresh for jobs found in the past seven days; update last_seen only when re-verified. Use index_form for missing or stale application details.

If my email is connected, match recent application emails to the right role and update status: applied, talking, offer, or pass. Flag ambiguous matches and missing facts for me.

Finish with record_scan and a short summary of new matches, status changes, and anything that needs my attention.`;
}

export const connectionPrompt = `Help me connect my local Job Hunter to this agent. Ask where the job-hunt folder is if you cannot find it. Follow that checkout's README MCP setup: run npm run mcp:config to get the local server configuration, and add it using this agent's supported MCP settings. Keep .env.local credentials private. Confirm the app is running at JOB_HUNTER_URL, then call list_jobs to check the connection. Once connected, help me run a job scan and schedule it daily or weekly using my existing subscription. If this environment cannot run local MCP servers, explain which local desktop option I can use.`;
