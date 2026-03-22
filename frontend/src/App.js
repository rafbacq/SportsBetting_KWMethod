import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import BetControls from './components/BetControls';
import Settings from './components/Settings';
import History from './components/History';
import kalshiService from './services/kalshiApi';
import './App.css';

const TABS = ['Dashboard', 'History'];

export default function App() {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState({
    autoBetting: false,
    notifications: true,
  });

  useEffect(() => {
    kalshiService.getLiveGames().then(setGames);
    kalshiService.getBetHistory().then(setHistory);
  }, []);

  function handlePlaceBet(game, team, stake) {
    const side = team === game.homeTeam ? 'YES' : 'NO';
    kalshiService.placeBet(game.marketTicker, side, stake).then((res) => {
      if (res.success) {
        alert(`Bet placed: $${stake} on ${team} (${side})`);
      }
    });
  }

  function handleCashOut(game) {
    kalshiService.cashOut(game.marketTicker).then((res) => {
      if (res.success) {
        alert(`Position on ${game.homeTeam} vs ${game.awayTeam} cashed out.`);
      }
    });
  }

  function handleToggle(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Basketball Betting Assistant</h1>
        <span className="app-header__subtitle">Powered by Kalshi</span>
      </header>

      <nav className="app-nav">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`nav-tab ${activeTab === tab ? 'nav-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {activeTab === 'Dashboard' && (
          <div className="dashboard-layout">
            <div className="dashboard-layout__left">
              <Dashboard
                games={games}
                selectedGame={selectedGame}
                onSelectGame={setSelectedGame}
              />
            </div>
            <div className="dashboard-layout__right">
              <BetControls
                game={selectedGame}
                onPlaceBet={handlePlaceBet}
                onCashOut={handleCashOut}
              />
              <Settings settings={settings} onToggle={handleToggle} />
            </div>
          </div>
        )}

        {activeTab === 'History' && <History bets={history} />}
      </main>
    </div>
  );
}
