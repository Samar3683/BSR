"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { useToast } from "../components/ui/toast";
import { useT } from "../i18n/provider";
import { UNAUTHORIZED_EVENT } from "../lib/db/client";
import { CONFIG_KEY } from "./use-admin-config";

interface Change {
  t: string;
  op: string;
}

const CONFIG_TABLES = new Set(["entity_configs", "field_definitions", "field_options"]);

// Connection state, shared by whoever wants to show it ("Live").
let live = false;
const subscribers = new Set<() => void>();
function setLive(next: boolean) {
  if (live === next) return;
  live = next;
  for (const notify of subscribers) notify();
}

/** True while the live connection to the server is open. */
export function useLiveStatus(): boolean {
  return useSyncExternalStore(
    (notify) => {
      subscribers.add(notify);
      return () => subscribers.delete(notify);
    },
    () => live,
    () => false,
  );
}

/**
 * Keeps every screen current: the server pushes a short message whenever
 * something changes in the database (Server-Sent Events), and the panel
 * reloads what is on screen through its normal, authorized queries. A person
 * typing in a form is never overwritten: record screens stay as they are while
 * the page is an edit or create form. The 60-second polling of the dashboard
 * and counters remains as a fallback if the connection is down.
 */
export function useRealtime() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const t = useT();
  // The connection must not restart when these change identity.
  const notify = useRef<(message: string) => void>(() => undefined);
  useEffect(() => {
    notify.current = (message) => toast.info(t(message));
  }, [toast, t]);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    let source: EventSource | null = null;
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let wasConnected = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const touched = new Set<string>();

    const refresh = () => {
      timer = null;
      const config = [...touched].some((table) => CONFIG_TABLES.has(table));
      const editing = /\/(edit|new)$/.test(window.location.pathname);
      touched.clear();
      void queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          if (key === CONFIG_KEY[0]) return config;
          // Do not reset a form someone is filling in.
          if (editing && (key === "record" || key === "request")) return false;
          return true;
        },
      });
    };

    const connect = () => {
      if (stopped) return;
      source = new EventSource("/admin/api/events");
      source.addEventListener("ready", () => {
        setLive(true);
        // Changes may have been missed while the connection was down.
        if (wasConnected) {
          touched.add("reconnect");
          timer ??= setTimeout(refresh, 0);
        }
        wasConnected = true;
      });
      source.addEventListener("change", (event) => {
        let batch: Change[] = [];
        try {
          batch = JSON.parse((event as MessageEvent<string>).data) as Change[];
        } catch {
          return;
        }
        for (const change of batch) {
          touched.add(change.t);
          if (change.t === "quote_requests" && change.op === "INSERT") {
            notify.current("New quote request received.");
          }
        }
        timer ??= setTimeout(refresh, 200);
      });
      source.onerror = () => {
        setLive(false);
        if (source?.readyState !== EventSource.CLOSED) return; // the browser retries by itself
        source.close();
        // The server refused: signed out, or no longer an administrator.
        void fetch("/admin/api/auth/session", { credentials: "same-origin" })
          .then((response) => {
            if (response.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
            else if (!stopped) retry = setTimeout(connect, 5000);
          })
          .catch(() => {
            if (!stopped) retry = setTimeout(connect, 5000);
          });
      };
    };

    connect();
    return () => {
      stopped = true;
      source?.close();
      setLive(false);
      if (retry) clearTimeout(retry);
      if (timer) clearTimeout(timer);
    };
  }, [queryClient]);
}
