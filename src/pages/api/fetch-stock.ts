import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { requireAuth } from "../../lib/auth/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const symbol = req.query.symbol || "AAPL";
  const response = await axios.get(
    `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${process.env.MARKET_API_KEY}`
  );
  res.status(200).json(response.data);
}
