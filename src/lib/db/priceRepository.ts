import { supabase } from "./client";

export async function savePrice(data: any, user_id?: string) {
  const { error } = await supabase
    .from("price_history")
    .insert([{ ...data, ...(user_id ? { user_id } : {}) }]);
  if (error) throw error;
}

export async function getLastPrice(symbol: string) {
  const { data, error } = await supabase
    .from("price_history")
    .select("*")
    .eq("symbol", symbol)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0];
}