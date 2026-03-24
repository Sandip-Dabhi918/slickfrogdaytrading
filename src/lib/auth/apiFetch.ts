/**
 * Authenticated fetch wrapper for client-side API calls.
 * Automatically reads the current Supabase session token and injects it
 * as "Authorization: Bearer <token>" on every request.
 *
 * Drop-in replacement for fetch() — same signature:
 *   const data = await apiFetch("/api/get-signals");
 *   const data = await apiFetch("/api/save-price", { method: "POST", body: JSON.stringify(payload) });
 */
import { supabase } from "../db/client";

export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = new Headers(init.headers ?? {});
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, { ...init, headers });
}
