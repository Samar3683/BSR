"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";

import { getSupabase } from "../../lib/supabase/client";

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
    const { data } = getSupabase().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !session)) leave();
      if (event === "SIGNED_IN" && session && session.user.id !== admin.user_id) leave();
    });
    return () => data.subscription.unsubscribe();
  }, [admin.user_id, leave]);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
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
