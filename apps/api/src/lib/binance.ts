import type { RunInterval } from "@repo/shared";

const BINANCE_API = "https://api.binance.com";

const INTERVAL_MAP: Record<RunInterval, string> = {
  ONE_SECOND: "1s",
  FIVE_SECONDS: "1s",
  FIFTEEN_SECONDS: "1s",
  THIRTY_SECONDS: "1s",
  ONE_MINUTE: "1m",
  FIVE_MINUTES: "5m",
  FIFTEEN_MINUTES: "15m",
  THIRTY_MINUTES: "30m",
  ONE_HOUR: "1h",
  FOUR_HOURS: "4h",
  ONE_DAY: "1d",
};

export interface Kline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
}

export interface TickerPrice {
  symbol: string;
  price: string;
}

export interface Ticker24h {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openPrice: string;
}

/**
 * Normalise market pair to Binance symbol format (no separator, uppercase).
 * "BTC/USDT" → "BTCUSDT", "btcusdt" → "BTCUSDT"
 */
export function toSymbol(pair: string): string {
  return pair.replace("/", "").toUpperCase();
}

export function toBinanceInterval(interval: RunInterval): string {
  return INTERVAL_MAP[interval];
}

export async function fetchKlines(
  symbol: string,
  interval: RunInterval,
  limit = 30
): Promise<Kline[]> {
  const binanceInterval = toBinanceInterval(interval);
  const url = `${BINANCE_API}/api/v3/klines?symbol=${toSymbol(symbol)}&interval=${binanceInterval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Binance API error ${res.status}: ${body}`);
  }
  const data = (await res.json()) as unknown[][];
  return data.map((k) => ({
    openTime: k[0] as number,
    open: k[1] as string,
    high: k[2] as string,
    low: k[3] as string,
    close: k[4] as string,
    volume: k[5] as string,
    closeTime: k[6] as number,
    quoteVolume: k[7] as string,
    trades: k[8] as number,
  }));
}

export async function fetchTicker(symbol: string): Promise<Ticker24h> {
  const url = `${BINANCE_API}/api/v3/ticker/24hr?symbol=${toSymbol(symbol)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Binance API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<Ticker24h>;
}
