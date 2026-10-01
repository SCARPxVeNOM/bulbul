import bs58 from "bs58";
import * as SecureStore from "expo-secure-store";
import { env } from "./env";

export type SessionStatus = "active" | "broken" | "cancelled" | "too_short" | "attest_failed" | "attested";

export interface FocusSession {
  id: string;
  wallet: string;
  commitment: string;
  day_index: number;
  focus_minutes: number;
  started_at: number;
  last_heartbeat: number;
  ended_at: number | null;
  status: SessionStatus;
  tx_signature: string | null;
  error: string | null;
  required_seconds: number;
  elapsed_seconds: number;
  heartbeat_interval_seconds: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Signs raw bytes and returns MWA's signed payload (message || 64-byte signature). */
export type MessageSigner = (message: Uint8Array) => Promise<Uint8Array>;

const tokenKey = (wallet: string) => `bulbul.session.${wallet}`;

async function request<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${env.apiUrl}${path}`, {
      ...rest,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new ApiError("Can't reach the bulbul server. Check your connection.", 0);
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status);
  return body;
}

const inFlightSignIns = new Map<string, Promise<string>>();

/**
 * Sign-In With Solana against the server; the session token is kept in the secure store.
 * Concurrent callers share one sign-in, since a second wallet association would cancel the first.
 */
export function signIn(wallet: string, sign: MessageSigner): Promise<string> {
  const pending = inFlightSignIns.get(wallet);
  if (pending) return pending;
  const p = doSignIn(wallet, sign).finally(() => inFlightSignIns.delete(wallet));
  inFlightSignIns.set(wallet, p);
  return p;
}

async function doSignIn(wallet: string, sign: MessageSigner): Promise<string> {
  const { nonce, message } = await request<{ nonce: string; message: string }>("/auth/challenge", {
    method: "POST",
    body: JSON.stringify({ wallet }),
  });
  const signedPayload = await sign(new TextEncoder().encode(message));
  const signature = bs58.encode(signedPayload.slice(signedPayload.length - 64));
  const { token } = await request<{ token: string }>("/auth/verify", {
    method: "POST",
    body: JSON.stringify({ wallet, nonce, signature }),
  });
  await SecureStore.setItemAsync(tokenKey(wallet), token);
  return token;
}

export async function signOut(wallet: string): Promise<void> {
  await SecureStore.deleteItemAsync(tokenKey(wallet));
}

/** Calls an authenticated endpoint, signing in once (and retrying) if the session is missing or expired. */
async function authed<T>(wallet: string, sign: MessageSigner, path: string, init: RequestInit = {}): Promise<T> {
  let token = await SecureStore.getItemAsync(tokenKey(wallet));
  if (!token) token = await signIn(wallet, sign);
  try {
    return await request<T>(path, { ...init, token });
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401) throw e;
    token = await signIn(wallet, sign);
    return request<T>(path, { ...init, token });
  }
}

export function focusApi(wallet: string, sign: MessageSigner) {
  const post = (path: string, body: unknown = {}) =>
    authed<{ session: FocusSession }>(wallet, sign, path, { method: "POST", body: JSON.stringify(body) }).then(
      (r) => r.session,
    );
  return {
    /** Resumes a live session without prompting the wallet: returns null when not signed in yet. */
    active: async () => {
      if (!(await SecureStore.getItemAsync(tokenKey(wallet)))) return null;
      return authed<{ session: FocusSession | null }>(wallet, sign, "/focus/active").then((r) => r.session);
    },
    start: (commitment: string) => post("/focus/start", { commitment }),
    heartbeat: (id: string) => post(`/focus/${id}/heartbeat`),
    finish: (id: string) => post(`/focus/${id}/finish`),
    retry: (id: string) => post(`/focus/${id}/retry`),
    cancel: (id: string) => post(`/focus/${id}/cancel`),
  };
}

export function companionArtUrl(stage: string): string {
  return `${env.apiUrl}/companion/${stage}.png`;
}
