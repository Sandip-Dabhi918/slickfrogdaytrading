import type { NextApiRequest, NextApiResponse } from "next";
import runScanner from "./run-scanner";
import getSignals from "./get-signals";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 🚀 No auth here

    // Step 1: Debug
    const debug = {
      status: "OK",
      time: new Date(),
      env: process.env.NODE_ENV,
    };

    // Step 2: Run scanner
    const scanner = await runScanner(req, res);

    // Step 3: Get signals
    const signals = await getSignals(req, res);

    return res.status(200).json({
      debug,
      scanner,
      signals,
    });

  } catch (err: any) {
    return res.status(500).json({
      error: err.message,
    });
  }
}