import React, { useState } from 'react';

export default function BetControls({ game, onPlaceBet, onCashOut }) {
  const [stake, setStake] = useState(25);

  if (!game) {
    return (
      <section className="bet-controls">
        <h2>Bet Controls</h2>
        <p className="empty-state">Select a game to place a bet.</p>
      </section>
    );
  }

  const suggestedTeam =
    game.suggestedTeam === 'home' ? game.homeTeam
    : game.suggestedTeam === 'away' ? game.awayTeam
    : null;

  const suggestedProb =
    game.suggestedTeam === 'home' ? game.homeWinProb
    : game.suggestedTeam === 'away' ? game.awayWinProb
    : null;

  return (
    <section className="bet-controls">
      <h2>Bet Controls</h2>

      <div className="bet-controls__game-info">
        <span>{game.awayTeam} @ {game.homeTeam}</span>
        <span className="bet-controls__quarter">
          {game.quarter} &middot; {game.timeRemaining}
        </span>
      </div>

      {suggestedTeam ? (
        <div className="bet-controls__suggestion">
          <div className="suggestion-label">Suggested Bet</div>
          <div className="suggestion-team">{suggestedTeam}</div>
          <div className="suggestion-odds">
            Win probability: {(suggestedProb * 100).toFixed(0)}% &middot;
            Payout: {(1 / suggestedProb).toFixed(2)}x
          </div>
        </div>
      ) : (
        <div className="bet-controls__suggestion">
          <div className="suggestion-label">No suggested bet for this game.</div>
        </div>
      )}

      <div className="bet-controls__stake">
        <label htmlFor="stake">Stake ($)</label>
        <input
          id="stake"
          type="number"
          min="1"
          max="1000"
          value={stake}
          onChange={(e) => setStake(Number(e.target.value))}
        />
      </div>

      <div className="bet-controls__actions">
        <button
          className="btn btn--primary"
          disabled={!suggestedTeam}
          onClick={() => onPlaceBet(game, suggestedTeam, stake)}
        >
          Place Bet
        </button>
        <button
          className="btn btn--secondary"
          onClick={() => onCashOut(game)}
        >
          Cash Out
        </button>
      </div>
    </section>
  );
}
