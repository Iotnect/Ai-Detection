import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { config } from "../config.js";

let client: SupabaseClient | undefined;

export function getSupabaseAdmin(): SupabaseClient | undefined {
  if (!config.supabase) return undefined;

  client ??= createClient(config.supabase.url, config.supabase.secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return client;
}
