import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { isHttps, isSameSite, requestHost } from "./request";

/** As the Docker image sees a request: request.url names the listening address. */
const request = (headers: Record<string, string>) =>
  new NextRequest("http://0.0.0.0:3000/admin/api/rest", { method: "POST", headers });

describe("requestHost", () => {
  it("is the Host header the browser sent, not the listening address", () => {
    expect(requestHost(request({ host: "localhost:3000" }))).toBe("localhost:3000");
  });

  it("prefers the first X-Forwarded-Host of a reverse proxy", () => {
    expect(
      requestHost(request({ host: "web:3000", "x-forwarded-host": "bsr.example, proxy" })),
    ).toBe("bsr.example");
  });
});

describe("isSameSite", () => {
  it("accepts the site's own origin behind Docker's port mapping", () => {
    expect(isSameSite(request({ host: "127.0.0.1:3010", origin: "http://127.0.0.1:3010" }))).toBe(
      true,
    );
  });

  it("rejects another origin", () => {
    expect(isSameSite(request({ host: "localhost:3000", origin: "https://evil.example" }))).toBe(
      false,
    );
    expect(isSameSite(request({ host: "localhost:3000", origin: "http://localhost:3001" }))).toBe(
      false,
    );
  });

  it("rejects a malformed origin and cross-site fetch metadata", () => {
    expect(isSameSite(request({ host: "localhost:3000", origin: "null" }))).toBe(false);
    expect(isSameSite(request({ host: "localhost:3000", "sec-fetch-site": "cross-site" }))).toBe(
      false,
    );
  });

  it("accepts server-side clients that send neither header", () => {
    expect(isSameSite(request({ host: "localhost:3000" }))).toBe(true);
  });
});

describe("isHttps", () => {
  it("follows X-Forwarded-Proto when a proxy terminates TLS", () => {
    expect(isHttps(request({ "x-forwarded-proto": "https" }))).toBe(true);
    expect(isHttps(request({}))).toBe(false);
  });
});
