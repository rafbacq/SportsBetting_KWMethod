import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { BetSlip } from '@/components/trading/BetSlip';
import { MarketsPage } from '@/pages/MarketsPage';
import { MarketDetailPage } from '@/pages/MarketDetailPage';
import { PortfolioPage } from '@/pages/PortfolioPage';
import { SettingsPage } from '@/pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<MarketsPage />} />
            <Route path="/market/:id" element={<MarketDetailPage />} />
            <Route path="/portfolio" element={<PortfolioPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
        <BetSlip />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
