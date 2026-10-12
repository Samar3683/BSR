"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";

import {
  announceSignOut,
  onSignOutElsewhere,
  signOut as signOutRequest,
} from "../../lib/auth-client";
import { UNAUTHORIZED_EVENT } from "../../lib/db/client";

export interface SessionAdmin {
  id: string;
  user_id: string;
  display_name: string;
  email: string | null;
  role: string;
}

interface SessionApi {
  admin: SessionAdmin;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionApi | null>(null);

/**
 * The signed-in administrator (verified on the server by the panel layout).
 * Signing out anywhere — this tab, another tab, an expired refresh token —
 * returns to the login page and drops cached data.
 */
export function AdminSessionProvider({
  admin,
  children,
}: {
  admin: SessionAdmin;
  children: ReactNode;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const leave = useCallback(() => {
    queryClient.clear();
    router.replace("/admin/login");
    router.refresh();
  }, [queryClient, router]);

  useEffect(() => {
    // A request answered with 401 (session ended or revoked), or a sign-out in
    // another tab, returns this tab to the login page.
    window.addEventListener(UNAUTHORIZED_EVENT, leave);
    const stop = onSignOutElsewhere(leave);
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, leave);
      stop();
    };
  }, [leave]);

  const signOut = useCallback(async () => {
    await signOutRequest().catch(() => undefined);
    announceSignOut();
    leave();
  }, [leave]);

  const value = useMemo(() => ({ admin, signOut }), [admin, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionApi {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside <AdminSessionProvider>");
  return value;
}
