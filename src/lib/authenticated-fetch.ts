import { supabase } from "@/lib/supabase";

async function accessToken(forceRefresh = false): Promise<string | undefined> {
  if (!supabase) return undefined;

  if (forceRefresh) {
    const { data } = await supabase.auth.refreshSession();
    return data.session?.access_token;
  }

  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if (!session) return undefined;

  const expiresSoon = (session.expires_at ?? 0) * 1_000 <= Date.now() + 60_000;
  if (!expiresSoon) return session.access_token;

  const { data: refreshed } = await supabase.auth.refreshSession();
  return refreshed.session?.access_token;
}

export async function authenticatedFetch(
  input: string | URL,
  init: RequestInit = {},
): Promise<Response> {
  const send = async (token: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };

  const token = await accessToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");

  let response = await send(token);

  if (response.status === 401) {
    const refreshedToken = await accessToken(true);
    if (refreshedToken) response = await send(refreshedToken);
  }

  return response;
}
