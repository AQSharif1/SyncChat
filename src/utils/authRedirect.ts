/**
 * Environment-aware auth redirect URL for Supabase email links and OAuth.
 * Uses the current origin in the browser; falls back to production in SSR/build.
 */
export function getAuthCallbackUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/auth/callback`;
  }
  return import.meta.env.VITE_AUTH_CALLBACK_URL ?? 'https://syncchatapp.com/auth/callback';
}
