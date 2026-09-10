'use client';
import { useState } from 'react';
import { scanPrompt, connectionPrompt } from '@/lib/scan-prompt';

export default function Scan() {
  const [preferences, setPreferences] = useState('');
  const [cadence, setCadence] = useState('daily');
  const [message, setMessage] = useState('');
  const prompt = scanPrompt(preferences || undefined, cadence);
  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`${label} copied`);
    } catch {
      setMessage(
        'Could not copy automatically. Expand the prompt below and copy the text.',
      );
    }
  }
  return (
    <main className="hunter">
      <div className="scan-page">
        <a href="/">← Back to Job Hunter</a>
        <h1>Let your agent find your next job.</h1>
        <p>
          Your existing ChatGPT or Claude subscription can do the searching and
          keep Job Hunter up to date. There’s no extra AI API bill from Job
          Hunter; scans use your plan’s usual allowance.
        </p>
        <section className="setup-step">
          <h2>1. Connect your agent, once</h2>
          <p>
            MCP is the connection that lets your agent add jobs and update
            application statuses here. Ask your agent to help connect it using
            the instructions below.
          </p>
          <button
            onClick={() =>
              void copy(connectionPrompt, 'Connection instructions')
            }
          >
            {message === 'Connection instructions copied' ? 'Copied' : 'Copy connection instructions'}
          </button>
          <details>
            <summary>Connection instructions & local setup</summary>
            <p className="prompt-preview">{connectionPrompt}</p>
            <p>
              From your Job Hunter folder, run <code>npm run mcp:config</code>{' '}
              to get a ready-to-paste configuration. Add it in your desktop
              agent’s local MCP settings, then restart or reconnect the agent.
            </p>
            <p>
              The app must be running. The connection uses the saved token in{' '}
              <code>.env.local</code>; you don’t need another account.
            </p>
          </details>
        </section>
        <section className="setup-step">
          <h2>2. Tell it what you’re looking for</h2>
          <label htmlFor="preferences">My interests and background</label>
          <textarea
            id="preferences"
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            placeholder="Roles, location, salary, remote preferences, industries, dealbreakers, and a little about your experience…"
          />
          <label htmlFor="cadence">How often?</label>
          <select
            id="cadence"
            value={cadence}
            onChange={(e) => setCadence(e.target.value)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          <p>Copy this prompt into your connected agent and try one scan.</p>
          <button
            className="primary"
            onClick={() => void copy(prompt, 'Scan prompt')}
          >
            {message === 'Scan prompt copied' ? 'Copied' : 'Copy scan prompt'}
          </button>
          <details>
            <summary>Read the scan prompt</summary>
            <p className="prompt-preview">{prompt}</p>
          </details>
        </section>
        <section className="setup-step">
          <h2>3. Make it a routine</h2>
          <p>
            Once the first scan works, ask your agent to repeat it on your
            chosen schedule. These guides walk through the scheduling options:
          </p>
          <div className="setup-links">
            <a
              href="https://learn.chatgpt.com/docs/automations"
              target="_blank"
              rel="noopener noreferrer"
            >
              ChatGPT: scheduled tasks ↗
            </a>
            <a
              href="https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork"
              target="_blank"
              rel="noopener noreferrer"
            >
              Claude: scheduled tasks ↗
            </a>
          </div>
          <p>
            For this local version, use an agent that supports local MCP
            connections and keep your computer, Job Hunter, and the desktop
            agent running for scans. A cloud-only task cannot directly launch
            this local connection.
          </p>
        </section>
        <p role="status" aria-live="polite" className="setup-status">
          {message}
        </p>
      </div>
    </main>
  );
}
