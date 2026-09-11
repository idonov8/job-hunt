'use client';
import { useState } from 'react';
import { setupPrompt } from '@/lib/scan-prompt';

export default function Scan() {
  const [message, setMessage] = useState('');
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        setupPrompt(new URL('/mcp', window.location.href).href),
      );
      setMessage('Setup prompt copied');
    } catch {
      setMessage(
        'Could not copy automatically. Open the prompt below and copy it.',
      );
    }
  }
  return (
    <main className="hunter">
      <div className="scan-page">
        <a href="/">← Back to Job Hunter</a>
        <section className="setup-step setup-card">
          <span className="eyebrow">SET UP YOUR AGENT</span>
          <h1>Put your job hunt on autopilot.</h1>
          <p>
            Copy the setup prompt, paste it into Claude or another desktop agent,
            and follow its questions. It will connect Job Hunter, learn what you
            want, and create separate inbox and job-search routines.
          </p>
          <button className="primary setup-copy" onClick={() => void copy()}>
            {message === 'Setup prompt copied' ? 'Copied' : 'Copy setup prompt'}
          </button>
          <p className="setup-note">
            Keep Job Hunter and your desktop agent running when local routines
            are due.
          </p>
          <details>
            <summary>Preview setup prompt</summary>
            <p className="prompt-preview">
              {setupPrompt('/mcp on this Job Hunter installation')}
            </p>
          </details>
        </section>
        <p role="status" aria-live="polite" className="setup-status">
          {message}
        </p>
      </div>
    </main>
  );
}
