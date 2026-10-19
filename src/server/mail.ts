import nodemailer from "nodemailer";

import { requireConfig } from "./config";

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function sendMail(mail: Mail): Promise<void> {
  const config = requireConfig();
  if (!config.smtpUrl) {
    throw new Error("Email is not configured: set SMTP_URL (and MAIL_FROM).");
  }
  const transport = nodemailer.createTransport(config.smtpUrl);
  await transport.sendMail({ from: config.mailFrom, ...mail });
}

export function recoveryMail(to: string, link: string): Mail {
  return {
    to,
    subject: "Reimposta la password del pannello BSR Trasporti",
    html: `<h2>BSR Trasporti — reimpostazione della password</h2>
<p>Abbiamo ricevuto una richiesta di reimpostazione della password del tuo account amministratore.</p>
<p><a href="${escapeHtml(link)}">Scegli una nuova password</a></p>
<p>Il link funziona una sola volta e scade tra 1 ora. Se non l'hai richiesto, puoi ignorare questa email: la tua password resta invariata.</p>`,
    text: `BSR Trasporti — reimpostazione della password\n\nScegli una nuova password: ${link}\n\nIl link funziona una sola volta e scade tra 1 ora. Se non l'hai richiesto, ignora questa email.`,
  };
}

export function inviteMail(to: string, link: string): Mail {
  return {
    to,
    subject: "Il tuo accesso al pannello BSR Trasporti",
    html: `<h2>BSR Trasporti — accesso al pannello</h2>
<p>Sei stato invitato al pannello operativo di BSR Trasporti.</p>
<p><a href="${escapeHtml(link)}">Scegli la tua password</a></p>
<p>Il link funziona una sola volta e scade tra 7 giorni. Se non aspettavi questo invito, puoi ignorare questa email.</p>`,
    text: `BSR Trasporti — accesso al pannello\n\nScegli la tua password: ${link}\n\nIl link funziona una sola volta e scade tra 7 giorni. Se non aspettavi questo invito, ignora questa email.`,
  };
}

// ------------------------------------------------- public-facing mail (Italian)

const trackingLink = (baseUrl: string, code: string) =>
  `${baseUrl.replace(/\/+$/, "")}/tracciamento?codice=${encodeURIComponent(code)}`;

/** The logo at the top of a visitor's email (a PNG: every mail client shows it). */
const logoHtml = (baseUrl: string) =>
  `<p><img src="${escapeHtml(baseUrl.replace(/\/+$/, ""))}/assets/images/brand/bsr-logo-email.png" alt="BSR Trasporti" width="200" style="display:block;border:0;height:auto"></p>`;

/** Sent to a visitor who left an email address: the code they can follow the request with. */
export function receiptMail(
  to: string,
  kind: "quote" | "message",
  code: string,
  baseUrl: string,
): Mail {
  const link = trackingLink(baseUrl, code);
  const what = kind === "quote" ? "la tua richiesta di preventivo" : "il tuo messaggio";
  return {
    to,
    subject: `BSR Trasporti — abbiamo ricevuto ${what} (${code})`,
    html: `${logoHtml(baseUrl)}
<p>Abbiamo ricevuto ${what}.</p>
<p>Il tuo codice di tracciamento è <strong>${escapeHtml(code)}</strong>.</p>
<p><a href="${escapeHtml(link)}">Segui lo stato e le risposte</a></p>
<p>Conserva il codice: serve per controllare lo stato e leggere le nostre risposte.</p>`,
    text: `BSR Trasporti\n\nAbbiamo ricevuto ${what}.\nCodice di tracciamento: ${code}\nSegui lo stato e le risposte: ${link}\n\nConserva il codice: serve per controllare lo stato e leggere le nostre risposte.`,
  };
}

/** A reply from the team, with the way back to the conversation. */
export function replyMail(to: string, code: string, reply: string, baseUrl: string): Mail {
  const link = trackingLink(baseUrl, code);
  return {
    to,
    subject: `BSR Trasporti — risposta alla tua richiesta (${code})`,
    html: `${logoHtml(baseUrl)}
<p style="white-space:pre-wrap">${escapeHtml(reply)}</p>
<p><a href="${escapeHtml(link)}">Apri la conversazione</a> — codice <strong>${escapeHtml(code)}</strong></p>`,
    text: `BSR Trasporti\n\n${reply}\n\nApri la conversazione: ${link}\nCodice: ${code}`,
  };
}
