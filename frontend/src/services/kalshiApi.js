// Kalshi API service layer
// In production, this would make real API calls to Kalshi's trade API.
// Currently uses mock data for UI development.

import { liveGames, betHistory } from './mockData';

const KALSHI_BASE_URL = 'https://api.elections.kalshi.com/trade-api/v2';

class KalshiService {
  constructor() {
    this.baseUrl = KALSHI_BASE_URL;
  }

  async getLiveGames() {
    // TODO: Replace with real API call to /markets?status=open
    return Promise.resolve(liveGames);
  }

  async getBetHistory() {
    // TODO: Replace with real API call to /portfolio/settlements
    return Promise.resolve(betHistory);
  }

  async placeBet(marketTicker, side, amount) {
    // TODO: POST to /portfolio/orders
    console.log(`Placing bet: ${side} on ${marketTicker} for $${amount}`);
    return Promise.resolve({ success: true, orderId: `ORD-${Date.now()}` });
  }

  async cashOut(marketTicker) {
    // TODO: POST to /portfolio/orders (sell position)
    console.log(`Cashing out position on ${marketTicker}`);
    return Promise.resolve({ success: true });
  }
}

const kalshiService = new KalshiService();
export default kalshiService;
