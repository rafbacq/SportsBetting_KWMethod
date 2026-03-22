import React from 'react';

function RecommendationBadge({ recommendation }) {
  const colors = {
    BET: { bg: '#dcfce7', color: '#166534', border: '#86efac' },
    WATCH: { bg: '#fef9c3', color: '#854d0e', border: '#fde047' },
    'NO ACTION': { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' },
  };
  const style = colors[recommendation] || colors['NO ACTION'];

  return (
    <span
      className="badge"
      style={{
        backgroundColor: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
      }}
    >
      {recommendation}
    </span>
  );
}

function GameCard({ game, isSelected, onSelect }) {
  return (
    <div
      className={`game-card ${isSelected ? 'game-card--selected' : ''}`}
      onClick={() => onSelect(game)}
    >
      <div className="game-card__header">
        <span className="game-card__time">
          {game.quarter} &middot; {game.timeRemaining}
        </span>
        <RecommendationBadge recommendation={game.recommendation} />
      </div>

      <div className="game-card__matchup">
        <div className="game-card__team">
          <span className="team-name">{game.awayTeam}</span>
          <span className="team-score">{game.awayScore}</span>
          <span className="team-prob">{(game.awayWinProb * 100).toFixed(0)}%</span>
        </div>
        <div className="game-card__vs">@</div>
        <div className="game-card__team">
          <span className="team-name">{game.homeTeam}</span>
          <span className="team-score">{game.homeScore}</span>
          <span className="team-prob">{(game.homeWinProb * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ games, selectedGame, onSelectGame }) {
  return (
    <section className="dashboard">
      <h2>Live Games</h2>
      {games.length === 0 ? (
        <p className="empty-state">No live games right now.</p>
      ) : (
        <div className="game-list">
          {games.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              isSelected={selectedGame?.id === game.id}
              onSelect={onSelectGame}
            />
          ))}
        </div>
      )}
    </section>
  );
}
