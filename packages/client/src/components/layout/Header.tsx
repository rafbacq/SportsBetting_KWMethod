import { Link, useLocation } from 'react-router-dom';
import { usePlatformStore } from '@/store/platformStore';
import { useBalance } from '@/hooks/useBalance';
import { formatDollars } from '@sports-betting/shared';
import type { Platform } from '@sports-betting/shared';

const platforms: { id: Platform; name: string }[] = [
  { id: 'kalshi', name: 'Kalshi' },
  { id: 'polymarket', name: 'Polymarket' },
];

const navLinks = [
  { to: '/', label: 'Markets' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/settings', label: 'Settings' },
];

export function Header() {
  const location = useLocation();
  const { activePlatform, setActivePlatform } = usePlatformStore();
  const { data: balance } = useBalance();

  return (
    <header className="glass sticky top-0 z-40 border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo & Nav */}
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-lg font-bold">BetBridge</span>
          </Link>

          <nav className="flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === link.to
                    ? 'bg-surface-2 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-surface-2/50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Platform Switcher */}
          <div className="flex items-center bg-surface-2 rounded-lg p-0.5">
            {platforms.map((p) => (
              <button
                key={p.id}
                onClick={() => setActivePlatform(p.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activePlatform === p.id
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* Balance */}
          {balance && (
            <div className="hidden sm:flex items-center gap-2 bg-surface-2 rounded-lg px-3 py-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-sm font-medium">{formatDollars(balance.available)}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
