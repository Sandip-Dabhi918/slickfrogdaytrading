import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { requireAuth } from "../../lib/auth/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const symbol = (req.query.symbol as string) || "AAPL";
  const today  = new Date();
  const from   = new Date(today); from.setDate(today.getDate() - 3);
  const fmt    = (d: Date) => d.toISOString().split("T")[0];

  try {
    const response = await axios.get(
      `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fmt(from)}&to=${fmt(today)}&token=${process.env.MARKET_API_KEY}`
    );
    const news = (response.data || []).slice(0, 8).map((item: any) => ({
      headline: item.headline,
      source:   item.source,
      datetime: item.datetime,
      url:      item.url,
    }));
    res.status(200).json({ news });
  } catch {
    res.status(200).json({ news: [] });
  }
}
