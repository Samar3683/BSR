"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Mail, MessageCircle, Phone, RotateCcw, Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "../../components/ui/button";
import { ConfirmDialog } from "../../components/ui/dialog";
import { ErrorState, LoadingState } from "../../components/ui/feedback";
import { Field, Textarea } from "../../components/ui/form";
import { PageHeader, Panel } from "../../components/ui/layout";
import { useToast } from "../../components/ui/toast";
import { useInvalidateData } from "../../hooks/use-admin-config";
import { formatDateTime } from "../../lib/datetime";
import { toAdminError } from "../../lib/errors";
import {
  deleteMessage,
  getMessage,
  updateMessage,
  type ContactMessage,
} from "../../services/messages";
import { ThreadPanel } from "../requests/thread-panel";
import { MessageStatusBadge } from "./messages-view";

const whatsappNumber = (phone: string) => phone.replace(/\D/g, "").replace(/^00/, "");

export function MessageDetailView({ id }: { id: string }) {
  const query = useQuery({ queryKey: ["message", id], queryFn: () => getMessage(id) });
  if (query.isError) {
    return (
      <div className="a-page">
        <ErrorState
          error={query.error}
          onRetry={() => query.refetch()}
          back={{ href: "/admin/messages", label: "Back to messages" }}
        />
      </div>
    );
  }
  if (!query.data) return <LoadingState />;
  return <Detail message={query.data} />;
}

function Detail({ message }: { message: ContactMessage }) {
  const router = useRouter();
  const toast = useToast();
  const invalidate = useInvalidateData();
  const [note, setNote] = useState(message.note ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const setStatus = useMutation({
    mutationFn: (status: "new" | "closed") => updateMessage(message.id, { status }),
    onSuccess: async () => {
      toast.success("Message updated.");
      await invalidate();
    },
    onError: (e) => toast.error(toAdminError(e).message),
  });
  const saveNote = useMutation({
    mutationFn: () => updateMessage(message.id, { note: note.trim() || null }),
    onSuccess: async () => {
      toast.success("Note saved.");
      await invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteMessage(message.id),
    onSuccess: async () => {
      await invalidate();
      toast.success("Message deleted.");
      router.push("/admin/messages");
    },
  });

  return (
    <div className="a-page">
      <PageHeader
        back={{ href: "/admin/messages", label: "Messages" }}
        eyebrow="Message"
        title={message.subject || message.reference}
        meta={
          <span>
            {message.reference} · {formatDateTime(message.created_at)} ·{" "}
            <MessageStatusBadge message={message} />
          </span>
        }
        actions={
          message.status === "closed" ? (
            <Button onClick={() => setStatus.mutate("new")} loading={setStatus.isPending}>
              <RotateCcw aria-hidden="true" />
              Reopen
            </Button>
          ) : (
            <Button onClick={() => setStatus.mutate("closed")} loading={setStatus.isPending}>
              <Check aria-hidden="true" />
              Close conversation
            </Button>
          )
        }
      />

      <div className="a-grid a-grid--2">
        <Panel title="Contact">
          <dl className="a-dl">
            <div>
              <dt>Name</dt>
              <dd>{message.name}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{message.phone ?? "—"}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{message.email ?? "—"}</dd>
            </div>
          </dl>
          <div className="a-row" style={{ marginTop: 14 }}>
            {message.phone ? (
              <>
                <a className="a-btn" href={`tel:${message.phone.replace(/[^\d+]/g, "")}`}>
                  <Phone aria-hidden="true" />
                  Call
                </a>
                <a
                  className="a-btn"
                  href={`https://wa.me/${whatsappNumber(message.phone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle aria-hidden="true" />
                  WhatsApp
                </a>
              </>
            ) : null}
            {message.email ? (
              <a className="a-btn" href={`mailto:${message.email}`}>
                <Mail aria-hidden="true" />
                Email
              </a>
            ) : null}
          </div>
        </Panel>

        <Panel title="Notes">
          <div className="a-form">
            <Field label="Internal note" help="Visible to administrators only.">
              <Textarea
                rows={4}
                maxLength={2000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <div className="a-actions">
              <Button
                onClick={() => saveNote.mutate()}
                loading={saveNote.isPending}
                disabled={note.trim() === (message.note ?? "")}
              >
                Save note
              </Button>
            </div>
          </div>
        </Panel>
      </div>

      <ThreadPanel
        kind="message"
        id={message.id}
        first={{ body: message.body, at: message.created_at }}
        canEmail={Boolean(message.email)}
      />

      <div className="a-actions">
        <Button variant="danger-ghost" onClick={() => setConfirmDelete(true)}>
          <Trash aria-hidden="true" />
          Delete message
        </Button>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this message?"
        message="The message, its replies and the visitor's contact details are erased permanently."
        confirmLabel="Delete message"
        busy={remove.isPending}
        error={remove.error ? toAdminError(remove.error).message : null}
        onConfirm={() => remove.mutate()}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}
