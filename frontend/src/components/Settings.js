import React, { useState } from 'react';

/**
 * Settings panel for Kalshi API credentials.
 * Supports email + password login.
 * Credentials are stored in localStorage for convenience.
 */
export default function Settings({ token, onLogin, onLogout, balance, loginError }) {
  const [email, setEmail] = useState(() => localStorage.getItem('kalshi_email') || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await onLogin(email, password);
      localStorage.setItem('kalshi_email', email);
      setPassword('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="settings">
      <h2>Kalshi Account</h2>

      {token ? (
        <div className="settings__connected">
          <div className="settings__status">
            <span className="status-dot status-dot--connected" />
            <span>Connected</span>
          </div>

          {balance != null && (
            <div className="settings__balance">
              <span className="settings__balance-label">Balance</span>
              <span className="settings__balance-value">${(balance / 100).toFixed(2)}</span>
            </div>
          )}

          <div className="settings__account-email">{localStorage.getItem('kalshi_email')}</div>

          <button className="btn btn--secondary" onClick={onLogout}>
            Log Out
          </button>
        </div>
      ) : (
        <form className="settings__form" onSubmit={handleLogin}>
          <p className="settings__info">
            Enter your Kalshi credentials to enable trading. Market data is available without logging in.
          </p>

          <div className="settings__field">
            <label htmlFor="kalshi-email">Email</label>
            <input
              id="kalshi-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>

          <div className="settings__field">
            <label htmlFor="kalshi-password">Password</label>
            <input
              id="kalshi-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
            />
          </div>

          {loginError && <div className="settings__error">{loginError}</div>}

          <button className="btn btn--primary" type="submit" disabled={loading || !email || !password}>
            {loading ? 'Connecting...' : 'Log In'}
          </button>
        </form>
      )}
    </section>
  );
}
