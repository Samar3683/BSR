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
    subject: "Reset your BSR Trasporti admin password",
    html: `<h2>BSR Trasporti — password reset</h2>
<p>We received a request to reset the password of your admin account.</p>
<p><a href="${escapeHtml(link)}">Choose a new password</a></p>
<p>The link works once and expires in 1 hour. If you did not request this, you can ignore this email; your password stays unchanged.</p>`,
    text: `BSR Trasporti — password reset\n\nChoose a new password: ${link}\n\nThe link works once and expires in 1 hour. If you did not request this, ignore this email.`,
  };
}

export function inviteMail(to: string, link: string): Mail {
  return {
    to,
    subject: "Your BSR Trasporti admin access",
    html: `<h2>BSR Trasporti — admin access</h2>
<p>You have been invited to the BSR Trasporti operations panel.</p>
<p><a href="${escapeHtml(link)}">Choose your password</a></p>
<p>The link works once and expires in 7 days. If you did not expect this invitation, you can ignore this email.</p>`,
    text: `BSR Trasporti — admin access\n\nChoose your password: ${link}\n\nThe link works once and expires in 7 days. If you did not expect this invitation, ignore this email.`,
  };
}
