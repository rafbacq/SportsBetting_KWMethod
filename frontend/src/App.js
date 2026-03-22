import React, { useState, useEffect, useCallback, useMemo } from 'react';
import SearchBar from './components/SearchBar';
import FilterBar from './components/FilterBar';
import MarketCard from './components/MarketCard';
import MarketDetail from './components/MarketDetail';
import Settings from './components/Settings';
import {
  importPrivateKey,
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
  // ─── Auth state (API key + CryptoKey) ───────────────────────────────
  const [auth, setAuth] = useState(null); // { keyId, privateKey (CryptoKey) }
  const [balance, setBalance] = useState(null);
  const [connectError, setConnectError] = useState(null);

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

  // ─── Fetch balance when auth changes ────────────────────────────────

  useEffect(() => {
    if (!auth) {
      setBalance(null);
      return;
    }
    getBalance(auth)
      .then((b) => setBalance(b.balance))
      .catch(() => setBalance(null));
  }, [auth]);

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

  async function handleConnect(keyId, privateKeyPem) {
    setConnectError(null);
    try {
      const cryptoKey = await importPrivateKey(privateKeyPem);
      const newAuth = { keyId, privateKey: cryptoKey };
      // Verify the key works by fetching balance
      await getBalance(newAuth);
      setAuth(newAuth);
    } catch (e) {
      setConnectError(e.message || 'Failed to connect. Check your API key and private key.');
      throw e;
    }
  }

  function handleDisconnect() {
    setAuth(null);
    setBalance(null);
    localStorage.removeItem('kalshi_key_id');
  }

  // ─── Trading handlers ──────────────────────────────────────────────

  async function handlePlaceOrder(ticker, side, count) {
    await placeOrder(auth, { ticker, side, count });
    if (auth) {
      getBalance(auth).then((b) => setBalance(b.balance)).catch(() => {});
    }
  }

  async function handleSell(ticker, side, count) {
    await sellPosition(auth, { ticker, side, count });
    if (auth) {
      getBalance(auth).then((b) => setBalance(b.balance)).catch(() => {});
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div className="app">
      <header className="app-header">
        <h1>Kalshi Markets</h1>
        <span className="app-header__subtitle">Real-time event contracts</span>
        {auth && (
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
            auth={auth}
            onPlaceOrder={handlePlaceOrder}
            onSell={handleSell}
            onClose={() => setSelectedMarket(null)}
            position={null}
          />
        )}

        {activeTab === 'Settings' && (
          <Settings
            auth={auth}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            balance={balance}
            connectError={connectError}
          />
        )}
      </main>
    </div>
  );
}
