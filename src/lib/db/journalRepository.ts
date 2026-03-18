import { supabase } from "./client";

export interface TradeEntry {
  id:           string;
  symbol:       string;
  direction:    "BUY" | "SELL";
  entry_price:  number;
  exit_price:   number | null;
  quantity:     number;
  entry_at:     string;
  exit_at:      string | null;
  notes:        string | null;
  signal_score: number | null;
  signal_state: any;
  pnl:          number | null;
  status:       "OPEN" | "CLOSED";
}

async function requireUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export async function getTrades(symbol?: string, limit = 100): Promise<TradeEntry[]> {
  let q = supabase.from("trade_journal").select("*").order("entry_at", { ascending: false }).limit(limit);
  if (symbol) q = q.eq("symbol", symbol);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as TradeEntry[];
}

export async function openTrade(data: {
  symbol:        string;
  direction:     "BUY" | "SELL";
  entry_price:   number;
  quantity:      number;
  notes?:        string;
  signal_score?: number;
  signal_state?: any;
}): Promise<TradeEntry> {
  const user_id = await requireUserId();
  const { data: row, error } = await supabase
    .from("trade_journal")
    .insert([{ ...data, status: "OPEN", user_id }])
    .select()
    .single();
  if (error) throw error;
  return row as TradeEntry;
}

export async function closeTrade(id: string, exit_price: number, notes?: string): Promise<TradeEntry> {
  const { data: row, error } = await supabase
    .from("trade_journal")
    .update({ exit_price, exit_at: new Date().toISOString(), status: "CLOSED", notes })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return row as TradeEntry;
}

export async function deleteTrade(id: string): Promise<void> {
  const { error } = await supabase.from("trade_journal").delete().eq("id", id);
  if (error) throw error;
}

export async function getJournalStats(symbol?: string) {
  let q = supabase.from("trade_journal").select("direction,pnl,status,symbol");
  if (symbol) q = q.eq("symbol", symbol);
  const { data } = await q;
  const closed   = (data || []).filter(t => t.status === "CLOSED");
  const totalPnl = closed.reduce((a, t) => a + (Number(t.pnl) || 0), 0);
  const wins     = closed.filter(t => (t.pnl ?? 0) > 0).length;
  const losses   = closed.filter(t => (t.pnl ?? 0) <= 0).length;
  const winRate  = closed.length ? Math.round((wins / closed.length) * 100) : 0;
  return { totalPnl, wins, losses, winRate, totalTrades: closed.length };
}
