import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./passwords";
import { decodeCookie, encodeCookie } from "./session";

const SECRET = "test-secret-with-at-least-thirty-two-characters";

describe("session cookie", () => {
  const expires = new Date(Date.now() + 3_600_000);

  it("round-trips a signed cookie", () => {
    const cookie = encodeCookie("tok_123", expires, SECRET);
    expect(decodeCookie(cookie, SECRET)?.token).toBe("tok_123");
  });

  it("rejects tampering, another secret and expiry", () => {
    const cookie = encodeCookie("tok_123", expires, SECRET);
    const [token, exp, sig] = cookie.split(".");
    expect(decodeCookie(`${token}x.${exp}.${sig}`, SECRET)).toBeNull();
    expect(decodeCookie(`${token}.${Number(exp) + 1000}.${sig}`, SECRET)).toBeNull();
    expect(decodeCookie(cookie, `${SECRET}-other`)).toBeNull();
    expect(decodeCookie(cookie, SECRET, expires.getTime() + 5000)).toBeNull();
    expect(decodeCookie("", SECRET)).toBeNull();
    expect(decodeCookie("a.b", SECRET)).toBeNull();
    expect(decodeCookie(undefined, SECRET)).toBeNull();
  });
});

describe("passwords", () => {
  it("hashes with a salt and verifies", async () => {
    const hash = await hashPassword("Correct-horse-9");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain("Correct-horse-9");
    expect(await hashPassword("Correct-horse-9")).not.toBe(hash);
    expect(await verifyPassword(hash, "Correct-horse-9")).toBe(true);
    expect(await verifyPassword(hash, "correct-horse-9")).toBe(false);
  });

  it("treats a missing or malformed hash as a failed login", async () => {
    expect(await verifyPassword(null, "anything")).toBe(false);
    expect(await verifyPassword("not-a-hash", "anything")).toBe(false);
  });
});
