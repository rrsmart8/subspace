"""Thin, read-only adapter over alpaca-py.

Every method returns plain Python data in USD with Alpaca's own timestamps. The
tool layer (server.py) does validation, RON conversion, caching and shaping, so
it can be tested against a fake source without touching the network.

Only market-data clients and the read-only asset/clock endpoints are used. No
order, position or account method is ever called.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from alpaca.data.enums import Adjustment, DataFeed
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.historical.corporate_actions import CorporateActionsClient
from alpaca.data.historical.news import NewsClient
from alpaca.data.requests import (
    CorporateActionsRequest,
    NewsRequest,
    StockBarsRequest,
    StockSnapshotRequest,
)
from alpaca.data.timeframe import TimeFrame, TimeFrameUnit
from alpaca.trading.client import TradingClient
from alpaca.trading.enums import AssetClass, AssetStatus
from alpaca.trading.requests import GetAssetsRequest

TIMEFRAMES = {
    "1Hour": TimeFrame(1, TimeFrameUnit.Hour),
    "1Day": TimeFrame(1, TimeFrameUnit.Day),
    "1Week": TimeFrame(1, TimeFrameUnit.Week),
    "1Month": TimeFrame(1, TimeFrameUnit.Month),
}

# Corporate action types worth explaining to a retail investor.
ACTION_TYPES = ["cash_dividend", "stock_dividend", "forward_split", "reverse_split", "spin_off"]


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _bar(bar: Any) -> dict[str, Any] | None:
    if bar is None:
        return None
    return {
        "t": _iso(bar.timestamp),
        "o": bar.open,
        "h": bar.high,
        "l": bar.low,
        "c": bar.close,
        "v": bar.volume,
    }


class AlpacaSource:
    def __init__(self, key_id: str, secret: str) -> None:
        self._stocks = StockHistoricalDataClient(key_id, secret)
        self._news = NewsClient(key_id, secret)
        self._actions = CorporateActionsClient(key_id, secret)
        # paper=True: the keys only ever need read access to assets and the clock.
        # raw_data=True because alpaca-py's Asset enum lags new exchanges (e.g. TXSE)
        # and would reject the whole list.
        self._trading = TradingClient(key_id, secret, paper=True, raw_data=True)

    def list_assets(self) -> list[dict[str, Any]]:
        assets = self._trading.get_all_assets(
            GetAssetsRequest(status=AssetStatus.ACTIVE, asset_class=AssetClass.US_EQUITY)
        )
        return [
            {
                "symbol": a["symbol"],
                "name": a["name"],
                "exchange": a.get("exchange"),
                "tradable": bool(a.get("tradable")),
                "fractionable": bool(a.get("fractionable")),
            }
            for a in assets or []
            if a.get("symbol") and a.get("name")
        ]

    def clock(self) -> dict[str, Any]:
        c = self._trading.get_clock()
        return {
            "timestamp": c.get("timestamp"),
            "is_open": bool(c.get("is_open")),
            "next_open": c.get("next_open"),
            "next_close": c.get("next_close"),
        }

    def snapshots(self, symbols: list[str], feed: str) -> dict[str, dict[str, Any]]:
        raw = self._stocks.get_stock_snapshot(
            StockSnapshotRequest(symbol_or_symbols=symbols, feed=DataFeed(feed))
        )
        out: dict[str, dict[str, Any]] = {}
        for symbol, snap in (raw or {}).items():
            if snap is None:
                continue
            trade, quote = snap.latest_trade, snap.latest_quote
            out[symbol] = {
                "price": trade.price if trade else None,
                "price_time": _iso(trade.timestamp) if trade else None,
                "bid": quote.bid_price if quote else None,
                "ask": quote.ask_price if quote else None,
                "day": _bar(snap.daily_bar),
                "previous_close": snap.previous_daily_bar.close if snap.previous_daily_bar else None,
            }
        return out

    def bars(
        self, symbol: str, interval: str, start: datetime, end: datetime, feed: str
    ) -> list[dict[str, Any]]:
        result = self._stocks.get_stock_bars(
            StockBarsRequest(
                symbol_or_symbols=symbol,
                timeframe=TIMEFRAMES[interval],
                start=start,
                end=end,
                adjustment=Adjustment.ALL,
                feed=DataFeed(feed),
            )
        )
        return [b for b in (_bar(x) for x in result.data.get(symbol, [])) if b]

    def news(self, symbol: str, start: datetime, end: datetime, limit: int) -> list[dict[str, Any]]:
        result = self._news.get_news(
            NewsRequest(symbols=symbol, start=start, end=end, limit=limit, include_content=False)
        )
        items = result.data.get("news", []) if isinstance(result.data, dict) else []
        return [
            {
                "headline": n.headline,
                "source": n.source,
                "published_at": _iso(n.created_at),
                "summary": n.summary,
                "url": n.url,
                "symbols": list(n.symbols or []),
            }
            for n in items[:limit]
        ]

    def corporate_actions(self, symbol: str, start: date, end: date) -> list[dict[str, Any]]:
        result = self._actions.get_corporate_actions(
            CorporateActionsRequest(symbols=[symbol], types=ACTION_TYPES, start=start, end=end)
        )
        rows: list[dict[str, Any]] = []
        for group, actions in (result.data or {}).items():
            # Alpaca groups results under plural keys ("cash_dividends", "forward_splits").
            kind = group[:-1] if group.endswith("s") else group
            for a in actions:
                rows.append(
                    {
                        "type": kind,
                        "ex_date": _iso(getattr(a, "ex_date", None)),
                        "payable_date": _iso(getattr(a, "payable_date", None)),
                        # Cash per share (USD) for cash dividends; share ratio otherwise.
                        "rate": getattr(a, "rate", None),
                        "old_rate": getattr(a, "old_rate", None),
                        "new_rate": getattr(a, "new_rate", None),
                        "new_symbol": getattr(a, "new_symbol", None),
                        "special": getattr(a, "special", None),
                    }
                )
        return rows
