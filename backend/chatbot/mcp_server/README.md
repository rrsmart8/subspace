# Alpaca market-data MCP server

This is a read-only [FastMCP](https://gofastmcp.com) server. It gives the Subspace Tier 3 investment assistant access to US stock market data from Alpaca. It has no tools for placing orders or reading accounts.

## Tools

| Tool | Returns |
| --- | --- |
| `search_companies(query, limit=5)` | Active US-listed companies and ETFs that match a ticker or company name: symbol, name, exchange, and whether the stock is tradable. |
| `get_stock_snapshot(symbols)` | For up to 10 symbols: the latest trade, bid/ask, today's open/high/low/close/volume, the previous close and the % change. Also says whether the US market is open. |
| `get_price_history(symbol, start, end=today, interval="auto")` | Prices adjusted for splits and dividends, available since 2016. Includes a summary (return, high/low with dates, average volume, volatility) and up to 60 sample bars. With `auto`, the bar size is hourly, daily, weekly or monthly depending on the date range. |
| `get_company_news(symbol, start, end, limit=5)` | Headlines with source, date, a short summary and the URL. These are marked as untrusted content. |
| `get_corporate_actions(symbol, start, end)` | Cash and stock dividends, stock splits and spin-offs. |

All amounts are in RON, converted from USD at the fixed `ALPACA_USD_TO_RON` rate, and each result states the rate it used. Invalid input and Alpaca failures come back as short error messages from the tool.

## How it is served

The server uses the **stdio** transport, so it doesn't open a network port. You don't run it yourself: the Node backend (`../mcp-client.mjs`) starts it as a child process when the first chat message arrives:

```sh
uv run --frozen --directory backend/chatbot/mcp_server python -m market_mcp
```

The backend passes it only the Alpaca variables (`APCA_API_KEY_ID`, `APCA_API_SECRET_KEY`, `ALPACA_*`), reads its tool list and gives those tools to the Featherless model. The server stops when the API stops. If Alpaca keys are missing or `ALPACA_DISABLE=1` is set, every tool reports that market data is unavailable.

## Development

Requires [uv](https://docs.astral.sh/uv/). `npm run setup` installs the server's dependencies, or run this inside this directory:

```sh
uv sync
uv run pytest -q   # tests use a fake data source, no network
npx @modelcontextprotocol/inspector uv run --env-file ../../../.env python -m market_mcp   # try tools interactively
```

Code layout: `market_mcp/server.py` defines the tools, input checks, RON conversion and output limits. `market_mcp/alpaca_source.py` is a thin wrapper around `alpaca-py`.
