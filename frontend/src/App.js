import React, { useState, useEffect, useCallback, useMemo } from 'react';
import SearchBar from './components/SearchBar';
import FilterBar from './components/FilterBar';
import MarketCard from './components/MarketCard';
import MarketDetail from './components/MarketDetail';
import Settings from './components/Settings';
import {
  login,
  getAllOpenMarkets,
  getBalance,
  placeOrder,
  sellPosition,
  categorizeMarket,
} from './services/kalshiApi';
import './App.css';

const TABS = ['Markets', 'Settings'];
const POLL_INTERVAL = 15000; // 15s market refresh

export default function App() {
  // ─── Auth state ─────────────────────────────────────────────────────
  const [token, setToken] = useState(() => sessionStorage.getItem('kalshi_token') || null);
  const [balance, setBalance] = useState(null);
  const [loginError, setLoginError] = useState(null);

  // ─── Navigation ─────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('Markets');
  const [selectedMarket, setSelectedMarket] = useState(null);

  // ─── Markets ────────────────────────────────────────────────────────
  const [markets, setMarkets] = useState([]);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [marketsError, setMarketsError] = useState(null);

  // ─── Search & filter ────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // ─── Fetch markets ──────────────────────────────────────────────────

  const fetchMarkets = useCallback(async () => {
    try {
      const data = await getAllOpenMarkets(5);
      setMarkets(data);
      setMarketsError(null);
    } catch (e) {
      console.error('Failed to fetch markets:', e);
      setMarketsError(e.message);
    } finally {
      setMarketsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
    const timer = setInterval(fetchMarkets, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchMarkets]);

  // ─── Fetch balance ──────────────────────────────────────────────────

  useEffect(() => {
    if (!token) {
      setBalance(null);
      return;
    }
    getBalance(token)
      .then((b) => setBalance(b.balance))
      .catch(() => setBalance(null));
  }, [token]);

  // ─── Categorized + filtered markets ─────────────────────────────────

  const categorizedMarkets = useMemo(
    () => markets.map((m) => ({ ...m, _category: categorizeMarket(m) })),
    [markets]
  );

  const categoryCounts = useMemo(() => {
    const counts = {};
    categorizedMarkets.forEach((m) => {
      counts[m._category] = (counts[m._category] || 0) + 1;
    });
    return counts;
  }, [categorizedMarkets]);

  const filteredMarkets = useMemo(() => {
    let filtered = categorizedMarkets;

    if (categoryFilter !== 'All') {
      filtered = filtered.filter((m) => m._category === categoryFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          (m.title || '').toLowerCase().includes(q) ||
          (m.subtitle || '').toLowerCase().includes(q) ||
          (m.ticker || '').toLowerCase().includes(q) ||
          (m.event_ticker || '').toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [categorizedMarkets, categoryFilter, search]);

  // ─── Auth handlers ──────────────────────────────────────────────────

  async function handleLogin(email, password) {
    setLoginError(null);
    try {
      const { token: t } = await login(email, password);
      setToken(t);
      sessionStorage.setItem('kalshi_token', t);
    } catch (e) {
      setLoginError(e.message);
    }
  }

  function handleLogout() {
    setToken(null);
    setBalance(null);
    sessionStorage.removeItem('kalshi_token');
  }

  // ─── Trading handlers ──────────────────────────────────────────────

  async function handlePlaceOrder(ticker, side, count) {
    await placeOrder(token, { ticker, side, count });
    if (token) {
      getBalance(token).then((b) => setBalance(b.balance)).catch(() => {});
    }
  }

  async function handleSell(ticker, side, count) {
    await sellPosition(token, { ticker, side, count });
    if (token) {
      getBalance(token).then((b) => setBalance(b.balance)).catch(() => {});
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div className="app">
      <header className="app-header">
        <h1>Kalshi Markets</h1>
        <span className="app-header__subtitle">Real-time event contracts</span>
        {token && (
          <span className="app-header__balance">
            Balance: ${balance != null ? (balance / 100).toFixed(2) : '...'}
          </span>
        )}
      </header>

      <nav className="app-nav">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`nav-tab ${activeTab === tab ? 'nav-tab--active' : ''}`}
            onClick={() => {
              setActiveTab(tab);
              if (tab !== 'Markets') setSelectedMarket(null);
            }}
          >
            {tab}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {activeTab === 'Markets' && !selectedMarket && (
          <div className="markets-view">
            <div className="markets-view__controls">
              <SearchBar value={search} onChange={setSearch} />
              <FilterBar active={categoryFilter} onChange={setCategoryFilter} categoryCounts={categoryCounts} />
            </div>

            <div className="markets-view__count">
              {filteredMarkets.length} market{filteredMarkets.length !== 1 ? 's' : ''}
              {marketsLoading && <span className="loading-dot"> loading...</span>}
            </div>

            {marketsError && <div className="markets-error">Error: {marketsError}</div>}

            <div className="market-grid">
              {filteredMarkets.map((market) => (
                <MarketCard
                  key={market.ticker}
                  market={market}
                  isSelected={false}
                  onClick={() => setSelectedMarket(market)}
                />
              ))}
            </div>

            {!marketsLoading && filteredMarkets.length === 0 && !marketsError && (
              <p className="empty-state">No markets found. Try adjusting your search or filters.</p>
            )}
          </div>
        )}

        {activeTab === 'Markets' && selectedMarket && (
          <MarketDetail
            market={selectedMarket}
            token={token}
            onPlaceOrder={handlePlaceOrder}
            onSell={handleSell}
            onClose={() => setSelectedMarket(null)}
            position={null}
          />
        )}

        {activeTab === 'Settings' && (
          <Settings
            token={token}
            onLogin={handleLogin}
            onLogout={handleLogout}
            balance={balance}
            loginError={loginError}
          />
        )}
      </main>
    </div>
  );
}
