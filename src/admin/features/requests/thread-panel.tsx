"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useState } from "react";

import { Button } from "../../components/ui/button";
import { ErrorState, FormError } from "../../components/ui/feedback";
import { Field, Textarea } from "../../components/ui/form";
import { Panel } from "../../components/ui/layout";
import { useToast } from "../../components/ui/toast";
import { useInvalidateData } from "../../hooks/use-admin-config";
import { formatDateTime } from "../../lib/datetime";
import { fetchThread, sendReply } from "../../services/messages";

/**
 * The conversation with a visitor under a quote request or a message: what
 * they wrote, what the team answered, and a box to reply. The reply is
 * emailed when the visitor left an address, and always shown to them on the
 * tracking page.
 */
export function ThreadPanel({
  kind,
  id,
  first,
  canEmail,
}: {
  kind: "quote" | "message";
  id: string;
  /** The visitor's first message, when it is not itself a thread entry. */
  first?: { body: string; at: string };
  canEmail: boolean;
}) {
  const toast = useToast();
  const invalidate = useInvalidateData();
  const [draft, setDraft] = useState("");
  const thread = useQuery({ queryKey: ["thread", kind, id], queryFn: () => fetchThread(kind, id) });

  const send = useMutation({
    mutationFn: () => sendReply(kind, id, draft.trim()),
    onSuccess: async ({ emailed }) => {
      setDraft("");
      toast.success(
        emailed ? "Reply sent by email." : "Reply saved. The visitor sees it on the tracking page.",
      );
      await invalidate();
    },
  });

  return (
    <Panel title="Conversation">
      {thread.isError ? (
        <ErrorState error={thread.error} onRetry={() => thread.refetch()} />
      ) : (
        <ol className="a-thread" aria-label="Conversation">
          {first ? (
            <li className="a-thread-entry" data-direction="in">
              <p>{first.body}</p>
              <span className="a-small a-muted">{formatDateTime(first.at)}</span>
            </li>
          ) : null}
          {(thread.data ?? []).map((entry) => (
            <li key={entry.id} className="a-thread-entry" data-direction={entry.direction}>
              <p>{entry.body}</p>
              <span className="a-small a-muted">
                {entry.direction === "out" ? "BSR" : "Visitor"} · {formatDateTime(entry.created_at)}
                {entry.direction === "out" && entry.emailed ? " · Emailed" : ""}
              </span>
            </li>
          ))}
          {!first && !thread.data?.length ? <li className="a-muted">No messages yet.</li> : null}
        </ol>
      )}

      <form
        className="a-form"
        style={{ marginTop: 16 }}
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim()) send.mutate();
        }}
      >
        <Field
          label="Reply"
          help={
            canEmail
              ? "Sent by email and shown on the visitor's tracking page."
              : "No email address: the visitor reads it on the tracking page."
          }
        >
          <Textarea
            rows={3}
            maxLength={2000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </Field>
        <FormError error={send.error} />
        <div className="a-actions">
          <Button type="submit" variant="primary" loading={send.isPending} disabled={!draft.trim()}>
            {send.isPending ? null : <Send aria-hidden="true" />}
            Send reply
          </Button>
        </div>
      </form>
    </Panel>
  );
}
