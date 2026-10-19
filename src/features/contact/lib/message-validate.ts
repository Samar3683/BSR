import { messageContent as content } from "../config/message-content";

export interface MessageValues {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

export type MessageErrors = Partial<Record<keyof MessageValues | "contact", string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** At least 6 digits, only digits and the usual separators. */
const validPhone = (value: string) =>
  /^[0-9+ ().-]+$/.test(value) && value.replace(/\D/g, "").length >= 6;

/** What the contact form needs to pass, and the message when it does not. */
export function validateMessage(values: MessageValues): MessageErrors {
  const e = content.errors;
  const errors: MessageErrors = {};
  const email = values.email.trim();
  const phone = values.phone.trim();
  if (!values.name.trim()) errors.name = e.name;
  if (email && !EMAIL.test(email)) errors.email = e.email;
  if (phone && !validPhone(phone)) errors.phone = e.phone;
  if (!email && !phone) errors.contact = e.contact;
  if (values.message.trim().length < 5) errors.message = e.message;
  return errors;
}

export type SendResult = { ok: true; reference: string } | { ok: false; message: string };

/** Posts the message to the site's own endpoint. Never throws: the form shows the text. */
export async function sendMessage(values: MessageValues, elapsedMs: number): Promise<SendResult> {
  try {
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        email: values.email || undefined,
        phone: values.phone || undefined,
        subject: values.subject || undefined,
        message: values.message,
        elapsed: elapsedMs,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      reference?: string;
      error?: { message?: string };
    };
    if (response.ok && data.reference) return { ok: true, reference: data.reference };
    return { ok: false, message: data.error?.message ?? content.failed };
  } catch {
    return { ok: false, message: content.failed };
  }
}
