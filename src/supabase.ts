import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://swvlujplpqfppnhdhxyf.supabase.co";
const supabasePublishableKey = "sb_publishable_mNuobCwjLhFaqdQ03faipw_WYmrt0Ni";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
    flowType: "pkce",
  },
});

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
  if (url.startsWith("/api/")) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  }
  return fetch(input, { ...init, headers, credentials: "same-origin" });
}

export async function requestEmailLink(email: string, displayName = "") {
  return supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: `${window.location.origin}/profile`, shouldCreateUser: true, data: displayName.trim() ? { full_name: displayName.trim().slice(0, 80) } : undefined },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}
