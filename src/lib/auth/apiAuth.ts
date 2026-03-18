/**
 * Server-side auth helper for Next.js API routes.
 *
 * Usage:
 *   const user = await requireAuth(req, res);
 *   if (!user) return;
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export async function requireAuth(req: NextApiRequest, res: NextApiResponse) {
  // 🚀 ✅ DEMO MODE (BYPASS AUTH)
  if (
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true"
  ) {
    return {
      id: "00000000-0000-0000-0000-000000000000",
      email: "demo@momentum.com",
      role: "demo",
    };
  }

  // 🔐 PRODUCTION AUTH STARTS HERE

  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  return user;
}