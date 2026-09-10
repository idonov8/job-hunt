'use client';
import { useState } from 'react';
import { scanPrompt } from '@/lib/scan-prompt';
export default function Scan() {
  const [preferences, setPreferences] = useState('');
  const [cadence, setCadence] = useState('daily');
  const [message, setMessage] = useState('');
  const prompt = scanPrompt(preferences || undefined, cadence);
  return (
    <main className="hunter">
      <div className="scan-page">
        <a href="/">← Back to the board</a>
        <h1>Put your assistant on the lookout.</h1>
        <p>
          Connect the local MCP server to your assistant, then copy this prompt
          into a conversation or an existing daily/weekly automation. Job Hunter
          doesn’t buy model tokens or run the schedule itself.
        </p>
        <h2>1. Connect Job Hunter</h2>
        <p>
          Run the app locally. In your assistant’s MCP configuration, add this
          server with the absolute path to your checkout. The script loads its
          .env.local; keep that file private. Your assistant must support local
          stdio MCP servers.
        </p>
        <pre>
          {JSON.stringify(
            {
              mcpServers: {
                'job-hunter': {
                  command: 'node',
                  args: [
                    '--import',
                    '/absolute/path/job-hunt/node_modules/tsx/dist/loader.mjs',
                    '/absolute/path/job-hunt/scripts/mcp.ts',
                  ],
                },
              },
            },
            null,
            2,
          )}
        </pre>
        <p>
          Set JOB_HUNTER_URL in .env.local to the app’s actual address and port.
          The MCP tools use AGENT_TOKEN from that file.
        </p>
        <h2>2. Make the search yours</h2>
        <label htmlFor="cadence">Scan frequency</label>
        <select
          id="cadence"
          value={cadence}
          onChange={(e) => setCadence(e.target.value)}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
        <label htmlFor="preferences">What interests you?</label>
        <textarea
          id="preferences"
          value={preferences}
          onChange={(e) => setPreferences(e.target.value)}
          placeholder="Roles, seniority, location, salary, remote policy, industries, dealbreakers, technologies, your background and connections…"
        />
        <h2>3. Run your scan</h2>
        <button
          className="primary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(prompt);
              setMessage('Prompt copied');
            } catch {
              setMessage('Select the prompt below and copy it manually');
            }
          }}
        >
          Copy {cadence} scan prompt
        </button>
        <p role="status">{message}</p>
        <pre>{prompt}</pre>
      </div>
    </main>
  );
}
