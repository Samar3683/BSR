"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "../../components/ui/button";
import { Alert } from "../../components/ui/feedback";
import { Field, Input } from "../../components/ui/form";
import { changePassword, requestPasswordReset } from "../../lib/auth-client";
import { toAdminError } from "../../lib/errors";
import { MIN_PASSWORD_LENGTH, passwordProblem } from "../../lib/password-policy";

export { MIN_PASSWORD_LENGTH };

/** Requests a recovery email. The answer never reveals whether the account exists. */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (requestError) {
      const mapped = toAdminError(requestError);
      setError(
        /too many/i.test(mapped.message)
          ? "Too many requests. Wait a few minutes and try again."
          : "The server could not be reached. Check the connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="a-form">
        <Alert tone="success">
          If an administrator account exists for {email.trim()}, an email with a reset link is on
          its way.
        </Alert>
        <p className="a-auth-foot">
          <Link href="/admin/login" className="a-link">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form className="a-form" onSubmit={onSubmit} noValidate>
      <Field label="Email" error={error} required>
        <Input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
      </Field>
      <Button type="submit" variant="primary" block loading={busy}>
        Send reset link
      </Button>
      <p className="a-auth-foot">
        <Link href="/admin/login" className="a-link">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

/** Sets a new password for the session opened by a recovery or invitation link. */
export function ResetPasswordForm({ email }: { email: string | null }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: typeof errors = {};
    const problem = passwordProblem(password);
    if (problem) next.password = problem;
    if (confirm !== password) next.confirm = "The passwords do not match";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await changePassword(password);
      router.replace("/admin");
      router.refresh();
    } catch (error) {
      const mapped = toAdminError(error);
      setErrors({ form: mapped.message || "The password could not be changed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="a-form" onSubmit={onSubmit} noValidate>
      {errors.form ? <Alert tone="error">{errors.form}</Alert> : null}
      {email ? <input type="email" autoComplete="username" value={email} readOnly hidden /> : null}
      <Field
        label="New password"
        error={errors.password}
        help={`At least ${MIN_PASSWORD_LENGTH} characters, with upper- and lowercase letters and a digit.`}
        required
      >
        <Input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
      </Field>
      <Field label="Repeat the password" error={errors.confirm} required>
        <Input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>
      <Button type="submit" variant="primary" block loading={busy}>
        Save password
      </Button>
    </form>
  );
}
