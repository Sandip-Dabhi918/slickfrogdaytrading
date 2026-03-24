import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { requireAuth } from "../../lib/auth/apiAuth";

// US sector peers fallback
const US_SECTOR_PEERS: Record<string, string[]> = {
  "Technology":            ["AAPL","MSFT","GOOGL","META","NVDA","AMD","INTC","QCOM","AVGO","TSM"],
  "Consumer Cyclical":     ["AMZN","TSLA","HD","NKE","SBUX","GM","F","TGT","LOW","COST"],
  "Communication Services":["META","GOOGL","NFLX","DIS","CMCSA","T","VZ","SNAP","PINS","RBLX"],
  "Financial Services":    ["JPM","BAC","WFC","GS","MS","C","BLK","AXP","V","MA"],
  "Healthcare":            ["JNJ","PFE","UNH","ABBV","MRK","TMO","ABT","DHR","BMY","AMGN"],
  "Industrials":           ["HON","UPS","CAT","DE","LMT","RTX","BA","MMM","GE","FDX"],
  "Energy":                ["XOM","CVX","COP","SLB","EOG","PXD","MPC","VLO","PSX","OXY"],
  "Basic Materials":       ["LIN","APD","ECL","SHW","NEM","FCX","NUE","ALB","DD","PPG"],
  "Real Estate":           ["AMT","PLD","CCI","EQIX","PSA","DLR","O","SPG","WELL","AVB"],
  "Utilities":             ["NEE","DUK","SO","D","AEP","EXC","SRE","PEG","ES","XEL"],
  "Consumer Defensive":    ["WMT","PG","KO","PEP","COST","PM","MO","CL","GIS","K"],
};

// TSX (Canadian) sector peers fallback — symbols without .TO suffix for display,
// stored with .TO suffix for Finnhub API calls
const TSX_SECTOR_PEERS: Record<string, string[]> = {
  "Financial Services":    ["RY","TD","BNS","BMO","CM","NA","MFC","SLF","IAG","FFH"],
  "Energy":                ["CNQ","SU","CVE","IMO","ARX","TOU","ERF","PEY","MEG","BTE"],
  "Materials":             ["ABX","WPM","AEM","FM","CCO","LUN","CS","IMG","HBM","SGT"],
  "Technology":            ["CSU","SHOP","OTEX","CGI","BB","KXS","DSG","ENGH","DND","TIXT"],
  "Industrials":           ["CNR","CP","TRI","WSP","STN","BYD","GFL","WCN","TFI","CAE"],
  "Healthcare":            ["CSH","NHC","NWH","SIA","PLC","WELL","CXI","DRT","HLS","CLS"],
  "Consumer":              ["ATD","DOL","EMP","L","MRU","SAP","PZA","MTY","QSR","CTC"],
  "Utilities":             ["FTS","EMA","H","AQN","NPI","BEP","CPX","ACO","CU","PPL"],
  "Real Estate":           ["RioCan","SmartCentres","Brookfield","Granite","Allied","Dream"],
  "Communication":         ["BCE","T","RCI","QBR","MBT","TVA"],
};

/** Detect if a symbol is Canadian TSX */
function isTSX(symbol: string): boolean {
  return symbol.endsWith(".TO") || symbol.endsWith(".TSX") || symbol.endsWith(".V");
}

/** Normalise TSX symbol for Finnhub (always use .TO suffix) */
function toFinnhubSymbol(symbol: string): string {
  if (symbol.endsWith(".TSX")) return symbol.replace(".TSX", ".TO");
  if (symbol.endsWith(".V"))   return symbol; // TSX Venture already correct
  if (isTSX(symbol))           return symbol;
  return symbol;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const raw    = ((req.query.symbol as string) || "").toUpperCase().trim();
  const symbol = toFinnhubSymbol(raw);
  const tsx    = isTSX(symbol);

  if (!symbol) return res.status(400).json({ error: "symbol required" });

  try {
    const [profileRes, peersRes] = await Promise.allSettled([
      axios.get(
        `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${process.env.MARKET_API_KEY}`
      ),
      axios.get(
        `https://finnhub.io/api/v1/stock/peers?symbol=${symbol}&token=${process.env.MARKET_API_KEY}`
      ),
    ]);

    const profile = profileRes.status === "fulfilled" ? profileRes.value.data : null;
    const peers   = peersRes.status  === "fulfilled"  ? peersRes.value.data   : [];

    const sector     = profile?.finnhubIndustry || profile?.sector || null;
    const country    = profile?.country || (tsx ? "Canada" : "US");
    const mktCap     = profile?.marketCapitalization || null;
    const exchange   = tsx ? "TSX" : "US";

    // Start with Finnhub's own peer suggestions
    let suggestions: string[] = Array.isArray(peers)
      ? peers
          .filter((p: string) => p !== symbol)
          .map((p: string) => p.replace(".TO", "")) // strip .TO for display
          .slice(0, 8)
      : [];

    // Fill with sector fallback if not enough peers
    if (suggestions.length < 3) {
      const peerMap = tsx ? TSX_SECTOR_PEERS : US_SECTOR_PEERS;
      const sectorKey = sector
        ? Object.keys(peerMap).find(k =>
            sector.toLowerCase().includes(k.toLowerCase()) ||
            k.toLowerCase().includes(sector.toLowerCase())
          )
        : null;

      if (sectorKey) {
        const fallback = peerMap[sectorKey].filter(s =>
          s !== raw && s !== symbol && s !== raw.replace(".TO", "")
        );
        suggestions = [...new Set([...suggestions, ...fallback])].slice(0, 8);
      }
    }

    res.status(200).json({
      symbol:      raw,
      exchange,
      sector,
      country,
      marketCap:   mktCap,
      companyName: profile?.name || raw,
      suggestions: suggestions.slice(0, 6),
    });
  } catch (err: any) {
    res.status(200).json({ symbol: raw, exchange: tsx ? "TSX" : "US", sector: null, suggestions: [], error: err.message });
  }
}