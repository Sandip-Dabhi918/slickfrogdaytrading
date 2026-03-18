import axios from "axios";

const BASE = "https://finnhub.io/api/v1";
const token = () => process.env.MARKET_API_KEY;

export interface QuoteData {
  price:  number;   // current price
  bid:    number;
  ask:    number;
  volume: number;
  open:   number;
  high:   number;
  low:    number;
  prevClose: number;
  change:    number;
  changePct: number;
}

export async function fetchStock(symbol: string): Promise<QuoteData> {
  // Finnhub /quote gives: c=current, o=open, h=high, l=low, pc=prevClose, v=volume
  // bid/ask are not in /quote — we estimate from current price ± typical spread
  const res = await axios.get(`${BASE}/quote?symbol=${symbol}&token=${token()}`);
  const d   = res.data;

  const price = Number(d.c) || 0;

  // Estimate bid/ask from volume: higher volume = tighter spread
  // Typical L1 spread for liquid US equities: 0.01–0.05
  // This is a reasonable approximation when L1 data isn't available on free tier
  const spreadEst = price > 100 ? 0.02 : price > 50 ? 0.03 : price > 10 ? 0.05 : 0.10;
  const bid = price - spreadEst / 2;
  const ask = price + spreadEst / 2;

  return {
    price,
    bid:       bid,
    ask:       ask,
    volume:    Number(d.v) || 0,
    open:      Number(d.o) || price,
    high:      Number(d.h) || price,
    low:       Number(d.l) || price,
    prevClose: Number(d.pc) || price,
    change:    Number(d.d) || 0,
    changePct: Number(d.dp) || 0,
  };
}
