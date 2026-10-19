import { NextResponse, type NextRequest } from "next/server";

import { readConfig } from "./config";

const HEADERS = { "Cache-Control": "no-store" };

export const fail = (message: string, status: number) =>
  NextResponse.json({ error: { message } }, { status, headers: HEADERS });

export const ok = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: HEADERS });

/** Same-site browser requests only (a server-side client has neither header). */
export function sameSite(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === request.nextUrl.host;
    } catch {
      return false;
    }
  }
  const site = request.headers.get("sec-fetch-site");
  return !site || site === "same-origin" || site === "none";
}

/** Reads a small JSON body; null when it is missing, too large or not JSON. */
export async function readJson(request: NextRequest, maxChars = 20_000): Promise<unknown | null> {
  try {
    const raw = await request.text();
    if (raw.length > maxChars) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** The public base URL for links in emails. */
export const baseUrl = (request: NextRequest) => readConfig()?.appUrl ?? request.nextUrl.origin;
