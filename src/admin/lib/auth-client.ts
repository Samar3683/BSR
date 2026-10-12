import { AdminError } from "./errors";

/** Browser calls to the panel's sign-in API (the session lives in an httpOnly cookie). */

interface AuthErrorBody {
  error?: { message?: string; field_errors?: Record<string, string> | null };
}

async function call(action: string, body?: unknown): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`/admin/api/auth/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new AdminError(
      "network",
      "The server could not be reached. Check the connection and try again.",
    );
  }
  if (response.ok) return;
  let payload: AuthErrorBody = {};
  try {
    payload = (await response.json()) as AuthErrorBody;
  } catch {
    // keep the generic message
  }
  const fieldErrors = payload.error?.field_errors ?? undefined;
  throw new AdminError(
    fieldErrors ? "validation" : response.status === 401 ? "auth" : "rule",
    payload.error?.message ?? "Something went wrong. Try again.",
    fieldErrors,
  );
}

export const signIn = (email: string, password: string) => call("login", { email, password });
export const signOut = () => call("logout");
export const requestPasswordReset = (email: string) => call("forgot", { email });
/** `current` is required for a normal session; a session opened by an emailed link may omit it. */
export const changePassword = (password: string, current?: string) =>
  call("password", { password, current });

const BROADCAST = "bsr-admin-auth";

/** Tells other tabs of this browser that the user signed out. */
export function announceSignOut(): void {
  try {
    const channel = new BroadcastChannel(BROADCAST);
    channel.postMessage("signed-out");
    channel.close();
  } catch {
    // BroadcastChannel is unavailable; other tabs notice on their next request.
  }
}

export function onSignOutElsewhere(handler: () => void): () => void {
  try {
    const channel = new BroadcastChannel(BROADCAST);
    channel.onmessage = () => handler();
    return () => channel.close();
  } catch {
    return () => undefined;
  }
}
