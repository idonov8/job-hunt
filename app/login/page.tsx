'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    }).catch(() => null);

    setBusy(false);
    if (response?.ok) {
      router.replace('/');
      router.refresh();
    } else {
      setError(response ? 'Wrong password.' : 'Could not reach the server.');
    }
  }

  return (
    <div className="gate">
      <h1>Job Hunt HQ</h1>
      <p className="sub">Enter the password to open the tracker.</p>
      <form onSubmit={submit}>
        <input
          type="password"
          value={password}
          autoFocus
          autoComplete="current-password"
          placeholder="Password"
          onChange={(event) => setPassword(event.target.value)}
        />
        <button type="submit" disabled={busy}>
          {busy ? '…' : 'Open'}
        </button>
      </form>
      <p className="err">{error}</p>
    </div>
  );
}
