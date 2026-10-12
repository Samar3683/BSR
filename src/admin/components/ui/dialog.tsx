"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";

import { useTr } from "../../i18n/provider";
import { Button } from "./button";

interface DialogProps {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** Renders the body + footer inside a <form>. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  /** Prevent closing (e.g. while saving). */
  busy?: boolean;
  description?: ReactNode;
}

/**
 * Modal dialog on the native <dialog> element: focus is trapped and
 * restored by the browser, Escape closes, the page behind is inert.
 */
export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
  onSubmit,
  busy,
  description,
}: DialogProps) {
  const tr = useTr();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Start on the first field (showModal alone would focus the Close button).
      dialog
        .querySelector<HTMLElement>(
          ".a-dialog-body :is(input:not([type=hidden]):not([type=file]):not(:disabled), select:not(:disabled), textarea:not(:disabled))",
        )
        ?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onCancel = (event: Event) => {
      event.preventDefault();
      if (!busy) onClose();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, [onClose, busy]);

  const body = (
    <>
      <div className="a-dialog-body">
        {description ? (
          <p className="a-muted" id={descriptionId}>
            {description}
          </p>
        ) : null}
        {children}
      </div>
      {footer ? <div className="a-dialog-foot">{footer}</div> : null}
    </>
  );

  return (
    <dialog
      ref={ref}
      className={["a-dialog", wide && "a-dialog--wide"].filter(Boolean).join(" ")}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onMouseDown={(event) => {
        // Click on the backdrop (outside the dialog box) closes it.
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="a-dialog-head">
        <h2 id={titleId}>{tr(title)}</h2>
        <Button
          variant="ghost"
          size="sm"
          icon
          aria-label={tr("Close")}
          onClick={onClose}
          disabled={busy}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      {open ? (
        onSubmit ? (
          <form
            noValidate
            style={{ display: "contents" }}
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit(event);
            }}
          >
            {body}
          </form>
        ) : (
          body
        )
      ) : null}
    </dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  tone = "danger",
  busy,
  error,
  onConfirm,
  onClose,
  children,
}: ConfirmDialogProps) {
  const tr = useTr();
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div>{tr(message)}</div>
      {children}
      {error ? (
        <div className="a-alert a-alert--error" role="alert">
          {error}
        </div>
      ) : null}
    </Dialog>
  );
}
