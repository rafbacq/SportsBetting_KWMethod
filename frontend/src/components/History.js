import React from 'react';

export default function History({ bets }) {
  const totalProfit = bets.reduce((sum, b) => sum + b.profit * b.stake, 0);
  const wins = bets.filter((b) => b.result === 'WIN').length;

  return (
    <section className="history">
      <h2>Bet History</h2>

      <div className="history__summary">
        <div className="stat">
          <span className="stat__value">{bets.length}</span>
          <span className="stat__label">Total Bets</span>
        </div>
        <div className="stat">
          <span className="stat__value">
            {wins}/{bets.length}
          </span>
          <span className="stat__label">Win Rate</span>
        </div>
        <div className="stat">
          <span
            className="stat__value"
            style={{ color: totalProfit >= 0 ? '#166534' : '#dc2626' }}
          >
            {totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}
          </span>
          <span className="stat__label">Net P&L</span>
        </div>
      </div>

      <table className="history__table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Team</th>
            <th>Side</th>
            <th>Stake</th>
            <th>Result</th>
            <th>P&L</th>
          </tr>
        </thead>
        <tbody>
          {bets.map((bet) => (
            <tr key={bet.id}>
              <td>{bet.date}</td>
              <td>{bet.team}</td>
              <td>{bet.side}</td>
              <td>${bet.stake}</td>
              <td>
                <span
                  className={`result-badge result-badge--${bet.result.toLowerCase()}`}
                >
                  {bet.result}
                </span>
              </td>
              <td
                style={{
                  color: bet.profit >= 0 ? '#166534' : '#dc2626',
                  fontWeight: 600,
                }}
              >
                {bet.profit >= 0 ? '+' : ''}${(bet.profit * bet.stake).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
