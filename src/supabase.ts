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

function normalizedEmail(email: string) {
  return email.trim().toLowerCase();
}

function profileRedirect() {
  return new URL("/profile", window.location.origin).toString();
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
  if (url.startsWith("/api/")) {
    const { data, error } = await supabase.auth.getSession();
    if (!error && data.session?.access_token) {
      headers.set("Authorization", `Bearer ${data.session.access_token}`);
    } else {
      headers.delete("Authorization");
    }
  }
  return fetch(input, { ...init, headers, credentials: "same-origin" });
}

export async function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({
    email: normalizedEmail(email),
    password,
  });
}

export async function signUpWithPassword(email: string, password: string, fullName: string) {
  return supabase.auth.signUp({
    email: normalizedEmail(email),
    password,
    options: {
      emailRedirectTo: profileRedirect(),
      data: { full_name: fullName.trim().slice(0, 80) },
    },
  });
}

export async function requestEmailLink(email: string, shouldCreateUser = false) {
  return supabase.auth.signInWithOtp({
    email: normalizedEmail(email),
    options: {
      emailRedirectTo: profileRedirect(),
      shouldCreateUser,
    },
  });
}

export async function requestEmailCode(email: string) {
  return supabase.auth.signInWithOtp({
    email: normalizedEmail(email),
    options: {
      shouldCreateUser: false,
    },
  });
}

export async function verifyEmailCode(email: string, token: string) {
  return supabase.auth.verifyOtp({
    email: normalizedEmail(email),
    token: token.replace(/\s/g, ""),
    type: "email",
  });
}

export async function requestPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(normalizedEmail(email), {
    redirectTo: profileRedirect(),
  });
}

export async function updatePassword(password: string) {
  return supabase.auth.updateUser({ password });
}

export async function signOut() {
  return supabase.auth.signOut();
}
