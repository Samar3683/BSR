"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Mail, MessageCircle, PackagePlus, Phone, Trash, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "../../components/ui/button";
import { ConfirmDialog } from "../../components/ui/dialog";
import { ErrorState, FormError, LoadingState } from "../../components/ui/feedback";
import { Field, Textarea } from "../../components/ui/form";
import { PageHeader, Panel } from "../../components/ui/layout";
import { useToast } from "../../components/ui/toast";
import { useInvalidateData } from "../../hooks/use-admin-config";
import { useT } from "../../i18n/provider";
import { formatDateTime } from "../../lib/datetime";
import { toAdminError } from "../../lib/errors";
import {
  startRequestOrder,
  deleteRequest,
  getRequest,
  updateRequest,
  type QuoteRequest,
  type RequestAddress,
} from "../../services/requests";
import { RequestStatusBadge } from "./requests-view";

const address = (a: RequestAddress) =>
  [a.street, [a.zip, a.city, a.province && `(${a.province})`].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

/** The digits WhatsApp's link format needs (international number, no signs). */
const whatsappNumber = (phone: string) => phone.replace(/\D/g, "").replace(/^00/, "");

export function RequestDetailView({ id }: { id: string }) {
  const query = useQuery({ queryKey: ["request", id], queryFn: () => getRequest(id) });
  if (query.isError) {
    return (
      <div className="a-page">
        <ErrorState
          error={query.error}
          onRetry={() => query.refetch()}
          back={{ href: "/admin/requests", label: "Back to requests" }}
        />
      </div>
    );
  }
  if (!query.data) return <LoadingState />;
  return <Detail request={query.data} />;
}

function Detail({ request }: { request: QuoteRequest }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const invalidate = useInvalidateData();
  const [note, setNote] = useState(request.note ?? "");
  const [confirm, setConfirm] = useState<"delete" | "discard" | null>(null);

  const refresh = async () => {
    await invalidate();
  };

  const setStatus = useMutation({
    mutationFn: (status: "new" | "contacted" | "discarded") =>
      updateRequest(request.id, { status }),
    onSuccess: async () => {
      toast.success("Request updated.");
      setConfirm(null);
      await refresh();
    },
    onError: (e) => toast.error(toAdminError(e).message),
  });
  const saveNote = useMutation({
    mutationFn: () => updateRequest(request.id, { note: note.trim() || null }),
    onSuccess: async () => {
      toast.success("Note saved.");
      await refresh();
    },
  });
  const convert = useMutation({
    mutationFn: () => startRequestOrder(request.id),
    onSuccess: async () => {
      await refresh();
      // The order is entered in the normal order form, prefilled from the request.
      router.push(`/admin/orders/new?request=${request.id}`);
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteRequest(request.id),
    onSuccess: async () => {
      await refresh();
      toast.success("Request deleted.");
      router.push("/admin/requests");
    },
    onError: (e) => toast.error(toAdminError(e).message),
  });

  const converted = request.status === "converted";
  const context = [request.context.service, request.context.sector, request.context.vehicle].filter(
    Boolean,
  );

  return (
    <div className="a-page">
      <PageHeader
        back={{ href: "/admin/requests", label: "Requests" }}
        eyebrow="Quote request"
        title={request.reference}
        meta={
          <span>
            {t("Received")} {formatDateTime(request.created_at)} ·{" "}
            <RequestStatusBadge status={request.status} />
          </span>
        }
        actions={
          converted ? (
            request.order_id ? (
              <Link className="a-btn a-btn--primary" href={`/admin/orders/${request.order_id}`}>
                {t("Open order")}
              </Link>
            ) : null
          ) : (
            <>
              <Button
                variant="primary"
                loading={convert.isPending}
                onClick={() => convert.mutate()}
              >
                {convert.isPending ? null : <PackagePlus aria-hidden="true" />}
                Create order
              </Button>
              {request.status === "new" ? (
                <Button onClick={() => setStatus.mutate("contacted")} loading={setStatus.isPending}>
                  <Check aria-hidden="true" />
                  Mark as contacted
                </Button>
              ) : null}
              {request.status !== "discarded" ? (
                <Button onClick={() => setConfirm("discard")}>
                  <X aria-hidden="true" />
                  Discard
                </Button>
              ) : (
                <Button onClick={() => setStatus.mutate("new")}>Reopen</Button>
              )}
            </>
          )
        }
      />
      <FormError error={convert.error} />

      <div className="a-grid a-grid--2">
        <Panel title="Contact">
          <dl className="a-dl">
            <div>
              <dt>{t("Name")}</dt>
              <dd>{request.name}</dd>
            </div>
            <div>
              <dt>{t("Phone")}</dt>
              <dd>{request.phone}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{request.email ?? "—"}</dd>
            </div>
          </dl>
          <div className="a-row" style={{ marginTop: 14 }}>
            <a className="a-btn" href={`tel:${request.phone.replace(/[^\d+]/g, "")}`}>
              <Phone aria-hidden="true" />
              {t("Call")}
            </a>
            <a
              className="a-btn"
              href={`https://wa.me/${whatsappNumber(request.phone)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle aria-hidden="true" />
              WhatsApp
            </a>
            {request.email ? (
              <a className="a-btn" href={`mailto:${request.email}`}>
                <Mail aria-hidden="true" />
                Email
              </a>
            ) : null}
          </div>
        </Panel>

        <Panel title="Route">
          <dl className="a-dl">
            <div>
              <dt>{t("Pickup")}</dt>
              <dd>{address(request.pickup)}</dd>
            </div>
            <div>
              <dt>{t("Delivery")}</dt>
              <dd>{address(request.delivery)}</dd>
            </div>
            {context.length ? (
              <div>
                <dt>{t("Context")}</dt>
                <dd>{context.join(" · ")}</dd>
              </div>
            ) : null}
          </dl>
        </Panel>
      </div>

      <Panel title="Handling">
        <div className="a-form">
          <Field label="Internal note" help="Visible to administrators only.">
            <Textarea
              rows={3}
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <div className="a-actions">
            <Button
              onClick={() => saveNote.mutate()}
              loading={saveNote.isPending}
              disabled={note.trim() === (request.note ?? "")}
            >
              Save note
            </Button>
          </div>
          {request.handled_at ? (
            <p className="a-help">
              {t("Last handled")} {formatDateTime(request.handled_at)}
            </p>
          ) : null}
          {converted && request.customer_id ? (
            <p>
              <Link className="a-link" href={`/admin/customers/${request.customer_id}`}>
                {t("Open customer")}
              </Link>
            </p>
          ) : null}
        </div>
        <p className="a-help" style={{ marginTop: 12 }}>
          Requests hold a visitor&apos;s personal data and are not part of the audit log, so they
          can be erased.
        </p>
        <div className="a-actions" style={{ marginTop: 8 }}>
          <Button variant="danger-ghost" onClick={() => setConfirm("delete")}>
            <Trash aria-hidden="true" />
            Delete request
          </Button>
        </div>
      </Panel>

      <ConfirmDialog
        open={confirm === "discard"}
        title="Discard this request?"
        message="It moves out of the inbox. You can reopen it later."
        confirmLabel="Discard"
        tone="primary"
        busy={setStatus.isPending}
        onConfirm={() => setStatus.mutate("discarded")}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        title="Delete this request?"
        message="The request and the contact details in it are erased permanently."
        confirmLabel="Delete request"
        busy={remove.isPending}
        error={remove.error ? toAdminError(remove.error).message : null}
        onConfirm={() => remove.mutate()}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
