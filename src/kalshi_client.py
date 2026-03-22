"""
Kalshi API client for automated trading of sports event contracts.

Handles authentication, market data retrieval, order placement, and
position management through Kalshi's REST and WebSocket APIs.
"""

import hashlib
import hmac
import json
import logging
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


@dataclass
class KalshiConfig:
    base_url: str = "https://api.elections.kalshi.com/trade-api/v2"
    api_key: str = ""
    email: str = ""
    password: str = ""

    @classmethod
    def from_env(cls) -> "KalshiConfig":
        return cls(
            api_key=os.getenv("KALSHI_API_KEY", ""),
            email=os.getenv("KALSHI_EMAIL", ""),
            password=os.getenv("KALSHI_PASSWORD", ""),
        )


@dataclass
class Market:
    ticker: str
    event_ticker: str
    title: str
    yes_price: float
    no_price: float
    volume: int
    status: str
    close_time: Optional[str] = None


@dataclass
class OrderResponse:
    order_id: str
    status: str
    side: str
    price: float
    quantity: int


class KalshiClient:
    """Client for the Kalshi trading API."""

    def __init__(self, config: Optional[KalshiConfig] = None):
        self.config = config or KalshiConfig.from_env()
        self.session = requests.Session()
        self._token: Optional[str] = None
        self._token_expiry: float = 0

    def _get_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        return headers

    def login(self) -> bool:
        """Authenticate with Kalshi and obtain a session token."""
        url = f"{self.config.base_url}/login"
        payload = {
            "email": self.config.email,
            "password": self.config.password,
        }
        try:
            resp = self.session.post(url, json=payload, headers=self._get_headers())
            resp.raise_for_status()
            data = resp.json()
            self._token = data.get("token")
            self._token_expiry = time.time() + 3600  # assume 1h expiry
            logger.info("Kalshi login successful")
            return True
        except requests.RequestException as e:
            logger.error(f"Kalshi login failed: {e}")
            return False

    def _ensure_auth(self):
        if not self._token or time.time() > self._token_expiry:
            if not self.login():
                raise RuntimeError("Failed to authenticate with Kalshi")

    def _request(self, method: str, path: str, **kwargs) -> dict[str, Any]:
        self._ensure_auth()
        url = f"{self.config.base_url}{path}"
        resp = self.session.request(
            method, url, headers=self._get_headers(), **kwargs
        )
        resp.raise_for_status()
        return resp.json()

    # ── Market Data ──────────────────────────────────────────

    def get_events(
        self,
        series_ticker: Optional[str] = None,
        status: str = "open",
        limit: int = 100,
    ) -> list[dict]:
        params: dict[str, Any] = {"status": status, "limit": limit}
        if series_ticker:
            params["series_ticker"] = series_ticker
        data = self._request("GET", "/events", params=params)
        return data.get("events", [])

    def get_event(self, event_ticker: str) -> dict:
        data = self._request("GET", f"/events/{event_ticker}")
        return data.get("event", {})

    def get_markets(
        self,
        event_ticker: Optional[str] = None,
        status: str = "open",
        limit: int = 100,
    ) -> list[Market]:
        params: dict[str, Any] = {"status": status, "limit": limit}
        if event_ticker:
            params["event_ticker"] = event_ticker
        data = self._request("GET", "/markets", params=params)
        markets = []
        for m in data.get("markets", []):
            markets.append(
                Market(
                    ticker=m["ticker"],
                    event_ticker=m.get("event_ticker", ""),
                    title=m.get("title", ""),
                    yes_price=m.get("yes_ask", 0) / 100,
                    no_price=m.get("no_ask", 0) / 100,
                    volume=m.get("volume", 0),
                    status=m.get("status", ""),
                    close_time=m.get("close_time"),
                )
            )
        return markets

    def get_market(self, ticker: str) -> Market:
        data = self._request("GET", f"/markets/{ticker}")
        m = data.get("market", {})
        return Market(
            ticker=m["ticker"],
            event_ticker=m.get("event_ticker", ""),
            title=m.get("title", ""),
            yes_price=m.get("yes_ask", 0) / 100,
            no_price=m.get("no_ask", 0) / 100,
            volume=m.get("volume", 0),
            status=m.get("status", ""),
            close_time=m.get("close_time"),
        )

    def get_orderbook(self, ticker: str) -> dict:
        return self._request("GET", f"/markets/{ticker}/orderbook")

    # ── Trading ──────────────────────────────────────────────

    def place_order(
        self,
        ticker: str,
        side: str,
        quantity: int,
        price: float,
        order_type: str = "limit",
    ) -> OrderResponse:
        """Place a limit or market order.

        Args:
            ticker: Market ticker.
            side: 'yes' or 'no'.
            quantity: Number of contracts.
            price: Price in dollars (0-1 range, will be converted to cents).
            order_type: 'limit' or 'market'.
        """
        price_cents = int(round(price * 100))
        payload = {
            "ticker": ticker,
            "action": "buy",
            "side": side,
            "type": order_type,
            "count": quantity,
            "yes_price" if side == "yes" else "no_price": price_cents,
        }
        data = self._request("POST", "/portfolio/orders", json=payload)
        order = data.get("order", {})
        return OrderResponse(
            order_id=order.get("order_id", ""),
            status=order.get("status", ""),
            side=side,
            price=price,
            quantity=quantity,
        )

    def sell_position(
        self, ticker: str, side: str, quantity: int, price: float
    ) -> OrderResponse:
        price_cents = int(round(price * 100))
        payload = {
            "ticker": ticker,
            "action": "sell",
            "side": side,
            "type": "limit",
            "count": quantity,
            "yes_price" if side == "yes" else "no_price": price_cents,
        }
        data = self._request("POST", "/portfolio/orders", json=payload)
        order = data.get("order", {})
        return OrderResponse(
            order_id=order.get("order_id", ""),
            status=order.get("status", ""),
            side=side,
            price=price,
            quantity=quantity,
        )

    def get_positions(self) -> list[dict]:
        data = self._request("GET", "/portfolio/positions")
        return data.get("market_positions", [])

    def get_balance(self) -> float:
        data = self._request("GET", "/portfolio/balance")
        return data.get("balance", 0) / 100  # cents to dollars

    def cancel_order(self, order_id: str) -> bool:
        try:
            self._request("DELETE", f"/portfolio/orders/{order_id}")
            return True
        except requests.RequestException:
            return False

    # ── Sports-specific helpers ──────────────────────────────

    def find_sports_markets(self, sport: str = "nba") -> list[Market]:
        """Find open sports-related markets by searching event tickers."""
        events = self.get_events()
        sport_events = [
            e for e in events
            if sport.lower() in e.get("series_ticker", "").lower()
            or sport.lower() in e.get("title", "").lower()
        ]
        markets = []
        for event in sport_events:
            event_markets = self.get_markets(event_ticker=event["event_ticker"])
            markets.extend(event_markets)
        return markets
