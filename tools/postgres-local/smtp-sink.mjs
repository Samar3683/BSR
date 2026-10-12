// Tiny SMTP sink for local development and tests (stands in for Mailpit). Node built-ins only.
// Every message is written to .postgres-local/mail/<stamp>.eml (raw) and <stamp>.json
// ({ from, to, subject, text, html, links, ... }) so tests can read recovery/invite links.
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

import { MAIL_DIR as DEFAULT_MAIL_DIR, PORTS, ensureDir } from "./lib.mjs";

const MAIL_DIR = ensureDir(process.env.BSR_MAIL_DIR || DEFAULT_MAIL_DIR);
const MAX_SIZE = 25 * 1024 * 1024;
let seq = 0;

// ------------------------------------------------------------ minimal MIME parsing

function splitHeaderBody(raw) {
  const idx = raw.search(/\r?\n\r?\n/);
  if (idx < 0) return { headerText: raw, body: "" };
  const sep = raw.slice(idx).match(/^\r?\n\r?\n/)[0];
  return { headerText: raw.slice(0, idx), body: raw.slice(idx + sep.length) };
}

function parseHeaders(text) {
  const headers = {};
  const unfolded = text.replace(/\r?\n[ \t]+/g, " ");
  for (const line of unfolded.split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i <= 0) continue;
    const key = line.slice(0, i).trim().toLowerCase();
    const value = line.slice(i + 1).trim();
    headers[key] = headers[key] ? `${headers[key]}, ${value}` : value;
  }
  return headers;
}

function decodeWords(value = "") {
  return value.replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_, charset, enc, text) => {
    try {
      const buf =
        enc.toUpperCase() === "B"
          ? Buffer.from(text, "base64")
          : Buffer.from(
              text
                .replace(/_/g, " ")
                .replace(/=([0-9A-Fa-f]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16))),
              "latin1",
            );
      return new TextDecoder(charset.toLowerCase()).decode(buf);
    } catch {
      return text;
    }
  });
}

function decodeQuotedPrintable(text) {
  const bytes = Buffer.from(
    text
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))),
    "latin1",
  );
  return bytes;
}

function param(header = "", name) {
  const m = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|([^;\\s]*))`, "i").exec(header);
  return m ? (m[1] ?? m[2]) : undefined;
}

function walk(raw, out) {
  const { headerText, body } = splitHeaderBody(raw);
  const headers = parseHeaders(headerText);
  const type = (headers["content-type"] || "text/plain").toLowerCase();
  if (type.startsWith("multipart/")) {
    const boundary = param(headers["content-type"], "boundary");
    if (!boundary) return headers;
    const parts = body.split(`--${boundary}`).slice(1);
    for (const part of parts) {
      if (part.startsWith("--")) break;
      walk(part.replace(/^\r?\n/, ""), out);
    }
    return headers;
  }
  const encoding = (headers["content-transfer-encoding"] || "").toLowerCase();
  let buf;
  if (encoding === "base64") buf = Buffer.from(body.replace(/\s+/g, ""), "base64");
  else if (encoding === "quoted-printable") buf = decodeQuotedPrintable(body);
  else buf = Buffer.from(body, "utf8");
  let text;
  try {
    text = new TextDecoder(
      (param(headers["content-type"], "charset") || "utf-8").toLowerCase(),
    ).decode(buf);
  } catch {
    text = buf.toString("utf8");
  }
  if (type.startsWith("text/html")) out.html = (out.html || "") + text;
  else if (type.startsWith("text/plain")) out.text = (out.text || "") + text;
  return headers;
}

const decodeEntities = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/g, "/")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

function extractLinks(html = "", text = "") {
  const links = new Set();
  for (const m of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) links.add(decodeEntities(m[1]));
  for (const m of `${text}\n${html.replace(/<[^>]+>/g, " ")}`.matchAll(/https?:\/\/[^\s"'<>]+/g)) {
    links.add(decodeEntities(m[0]));
  }
  return [...links];
}

function store(envelope, raw) {
  const now = new Date();
  const id = `${now.toISOString().replace(/[:.]/g, "-")}-${String(++seq).padStart(4, "0")}`;
  const out = {};
  const headers = walk(raw, out);
  const record = {
    id,
    receivedAt: now.toISOString(),
    envelopeFrom: envelope.from,
    envelopeTo: envelope.to,
    from: decodeWords(headers.from),
    to: decodeWords(headers.to),
    subject: decodeWords(headers.subject),
    date: headers.date,
    messageId: headers["message-id"],
    text: out.text ?? null,
    html: out.html ?? null,
    links: extractLinks(out.html, out.text),
    eml: `${id}.eml`,
  };
  fs.writeFileSync(path.join(MAIL_DIR, `${id}.eml`), raw);
  fs.writeFileSync(path.join(MAIL_DIR, `${id}.json`), JSON.stringify(record, null, 2));
  console.log(
    `${record.receivedAt} mail to=${envelope.to.join(",")} subject=${JSON.stringify(record.subject)} -> ${id}.json`,
  );
}

// ------------------------------------------------------------ SMTP protocol

const server = net.createServer((socket) => {
  let buffer = "";
  let inData = false;
  let data = [];
  let size = 0;
  let envelope = { from: null, to: [] };
  const reply = (line) => socket.write(`${line}\r\n`);

  reply("220 localhost ESMTP supabase-local smtp-sink");
  socket.setEncoding("utf8");
  socket.on("error", () => {});
  socket.on("data", (chunk) => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf("\r\n")) >= 0) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      if (inData) {
        if (line === ".") {
          inData = false;
          try {
            store(envelope, data.join("\r\n"));
            reply("250 2.0.0 OK: queued");
          } catch (e) {
            console.error("failed to store message", e);
            reply("451 4.3.0 local error storing message");
          }
          data = [];
          size = 0;
          envelope = { from: null, to: [] };
        } else {
          size += line.length + 2;
          if (size <= MAX_SIZE) data.push(line.startsWith("..") ? line.slice(1) : line);
        }
        continue;
      }
      const verb = line.split(" ")[0].toUpperCase();
      switch (verb) {
        case "EHLO":
          socket.write(`250-localhost\r\n250-8BITMIME\r\n250-SMTPUTF8\r\n250 SIZE ${MAX_SIZE}\r\n`);
          break;
        case "HELO":
          reply("250 localhost");
          break;
        case "MAIL":
          envelope = { from: (/<([^>]*)>/.exec(line) || [])[1] ?? null, to: [] };
          reply("250 2.1.0 OK");
          break;
        case "RCPT":
          envelope.to.push((/<([^>]*)>/.exec(line) || [])[1] ?? line.slice(8).trim());
          reply("250 2.1.5 OK");
          break;
        case "DATA":
          inData = true;
          reply("354 End data with <CR><LF>.<CR><LF>");
          break;
        case "RSET":
          envelope = { from: null, to: [] };
          reply("250 2.0.0 OK");
          break;
        case "NOOP":
          reply("250 2.0.0 OK");
          break;
        case "VRFY":
          reply("252 2.0.0 Cannot VRFY user");
          break;
        case "QUIT":
          reply("221 2.0.0 Bye");
          socket.end();
          break;
        default:
          reply("502 5.5.2 Command not implemented");
      }
    }
  });
});

server.listen(PORTS.smtp, "127.0.0.1", () => {
  console.log(`smtp-sink listening on 127.0.0.1:${PORTS.smtp}, writing to ${MAIL_DIR}`);
});
