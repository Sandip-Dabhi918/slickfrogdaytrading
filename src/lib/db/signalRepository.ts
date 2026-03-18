import { supabase } from "./client";

export async function saveSignal(data: any, user_id?: string) {
  const { error } = await supabase
    .from("signals")
    .insert([{ ...data, ...(user_id ? { user_id } : {}) }]);
  if (error) throw error;
}

export async function getSignals() {
  const { data, error } = await supabase
    .from("signals")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}