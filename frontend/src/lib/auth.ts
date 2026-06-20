"use client";

export type AuthUser = {
  id: number | string;
  name: string;
  email: string;
  is_verified?: boolean;
  auth_provider?: string;
  subscription_tier?: "free" | "trial" | "paid";
  role?: "user" | "admin";
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  premium_expires_at?: string | null;
};

const TOKEN_KEY = "gf_token";
const USER_KEY = "gf_user";
const LEGACY_TOKEN_KEY = "fg_token";
const LEGACY_USER_KEY = "ptt_user";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY) || localStorage.getItem(LEGACY_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setSession(token: string, user?: AuthUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.removeItem(LEGACY_USER_KEY);
  }
  window.dispatchEvent(new Event("gymfixer-auth-change"));
}

export function setStoredUser(user: AuthUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.removeItem(LEGACY_USER_KEY);
  window.dispatchEvent(new Event("gymfixer-auth-change"));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(LEGACY_USER_KEY);
  window.dispatchEvent(new Event("gymfixer-auth-change"));
}

export function isAuthenticated() {
  return Boolean(getAuthToken());
}
