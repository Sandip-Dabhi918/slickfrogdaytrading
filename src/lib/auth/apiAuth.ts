/**
 * Server-side auth helper for Next.js API routes.
 *
 * Usage:
 *   const user = await requireAuth(req, res);
 *   if (!user) return; // response already sent as 401
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export async function requireAuth(req: NextApiRequest, res: NextApiResponse) {
  // Pull the JWT from the Authorization header: "Bearer <token>"
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  // Create a per-request Supabase client that honours the user's JWT
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  return user;
}
