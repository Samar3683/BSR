"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "../../components/ui/button";
import { Alert } from "../../components/ui/feedback";
import { Field, Input } from "../../components/ui/form";
import { signIn, signOut } from "../../lib/auth-client";
import { getDb } from "../../lib/db/client";
import { toAdminError } from "../../lib/errors";

const LINK_ERRORS: Record<string, string> = {
  link: "This link is invalid or has expired. Request a new one.",
  "no-access": "This account does not have access to the admin panel.",
};

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(notice ? (LINK_ERRORS[notice] ?? null) : null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: typeof fieldErrors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errors.email = "Enter a valid email address";
    if (!password) errors.password = "Enter your password";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setBusy(true);
    setError(null);
    try {
      try {
        await signIn(email.trim(), password);
      } catch (signInError) {
        const mapped = toAdminError(signInError);
        setError(
          mapped.kind === "network"
            ? mapped.message
            : /too many/i.test(mapped.message)
              ? mapped.message
              : "The email or password is not correct.",
        );
        return;
      }
      const { data, error: profileError } = await getDb().rpc("current_admin");
      const admin = Array.isArray(data) ? data[0] : null;
      if (profileError || !admin || !admin.active) {
        await signOut().catch(() => undefined);
        setError(
          admin && !admin.active
            ? "This administrator account is inactive. Contact another administrator."
            : LINK_ERRORS["no-access"]!,
        );
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("The server could not be reached. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="a-form" onSubmit={onSubmit} noValidate>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Field label="Email" error={fieldErrors.email} required>
        <Input
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
      </Field>
      <Field label="Password" error={fieldErrors.password} required>
        <Input
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Button type="submit" variant="primary" block loading={busy}>
        {busy ? null : <LogIn aria-hidden="true" />}
        Sign in
      </Button>
      <p className="a-auth-foot">
        <Link href="/admin/forgot-password" className="a-link">
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}
