"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { KeyRound, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useSession } from "../../components/shell/session";
import { Button } from "../../components/ui/button";
import { Alert, FormError } from "../../components/ui/feedback";
import { Field, Input, Segmented } from "../../components/ui/form";
import { PageHeader, Panel } from "../../components/ui/layout";
import { useToast } from "../../components/ui/toast";
import { useI18n } from "../../i18n/provider";
import { formatDateTime } from "../../lib/datetime";
import { toAdminError } from "../../lib/errors";
import { changePassword } from "../../lib/auth-client";
import { fetchAdmins, renameAdmin } from "../../services/admins";
import type { ThemePreference } from "../../theme/constants";
import { useTheme } from "../../theme/theme-provider";
import { MIN_PASSWORD_LENGTH, passwordProblem } from "../../lib/password-policy";

/** The signed-in administrator's own profile: name, password, appearance, language. */
export function ProfileView() {
  const { admin } = useSession();
  const profiles = useQuery({ queryKey: ["admins"], queryFn: fetchAdmins });
  const own = profiles.data?.find((p) => p.id === admin.id);

  return (
    <div className="a-page">
      <PageHeader
        eyebrow="Account"
        title="Profile and security"
        meta={<span>Your details, password and preferences.</span>}
      />
      <div className="a-profile">
        <DetailsPanel
          name={admin.display_name}
          email={admin.email}
          role={admin.role}
          signedInAt={own?.last_sign_in_at ?? null}
          createdAt={own?.created_at ?? null}
        />
        <PasswordPanel email={admin.email} />
        <PreferencesPanel />
      </div>
    </div>
  );
}

function DetailsPanel({
  name,
  email,
  role,
  signedInAt,
  createdAt,
}: {
  name: string;
  email: string | null;
  role: string;
  signedInAt: string | null;
  createdAt: string | null;
}) {
  const { admin } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const dirty = value.trim() !== name;

  const save = useMutation({
    mutationFn: () => renameAdmin(admin.id, value.trim()),
    onSuccess: () => {
      toast.success("Name updated.");
      // The panel layout reads the name on the server.
      router.refresh();
    },
    onError: (e) => setError(toAdminError(e).message),
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!value.trim()) {
      setError("Enter your name");
      return;
    }
    if (value.trim().length > 120) {
      setError("Use at most 120 characters");
      return;
    }
    save.mutate();
  }

  return (
    <Panel title="Account details">
      <form className="a-form" onSubmit={onSubmit} noValidate>
        <div className="a-form-grid">
          <Field label="Name" required error={error}>
            <Input
              value={value}
              maxLength={120}
              autoComplete="name"
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
          <Field label="Email" help="Used to sign in. Ask another administrator to change it.">
            <Input value={email ?? ""} readOnly aria-readonly="true" />
          </Field>
        </div>
        <dl className="a-dl">
          <div>
            <dt>Role</dt>
            <dd>{role === "admin" ? "Administrator" : role}</dd>
          </div>
          <div>
            <dt>Last sign-in</dt>
            <dd>{signedInAt ? formatDateTime(signedInAt) : "—"}</dd>
          </div>
          <div>
            <dt>Account created</dt>
            <dd>{createdAt ? formatDateTime(createdAt) : "—"}</dd>
          </div>
        </dl>
        <div className="a-actions">
          <Button type="submit" variant="primary" loading={save.isPending} disabled={!dirty}>
            {save.isPending ? null : <Save aria-hidden="true" />}
            Save name
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function PasswordPanel({ email }: { email: string | null }) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{
    current?: string;
    next?: string;
    confirm?: string;
    form?: string;
  }>({});

  const change = useMutation({
    // The server re-checks the current password, so a stolen, unlocked session
    // cannot change it, and signs every other session out.
    mutationFn: () => changePassword(next, current),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password changed.");
    },
    onError: (e) => {
      const mapped = toAdminError(e);
      if (mapped.fieldErrors.current) setErrors({ current: mapped.fieldErrors.current });
      else if (mapped.fieldErrors.password) setErrors({ next: mapped.fieldErrors.password });
      else setErrors({ form: mapped.message || "The password could not be changed." });
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found: typeof errors = {};
    if (!current) found.current = "Enter your current password";
    const problem = passwordProblem(next);
    if (problem) found.next = problem;
    else if (next === current) found.next = "Choose a password different from the current one";
    if (confirm !== next) found.confirm = "The passwords do not match";
    setErrors(found);
    if (!Object.keys(found).length) change.mutate();
  }

  return (
    <Panel title="Password">
      <form className="a-form" onSubmit={onSubmit} noValidate>
        {errors.form ? <Alert tone="error">{errors.form}</Alert> : null}
        {email ? (
          <input type="email" autoComplete="username" value={email} readOnly hidden />
        ) : null}
        <div className="a-form-grid">
          <Field label="Current password" required error={errors.current} wide>
            <Input
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
          <Field
            label="New password"
            required
            error={errors.next}
            help={`At least ${MIN_PASSWORD_LENGTH} characters, with upper- and lowercase letters and a digit.`}
          >
            <Input
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <Field label="Repeat the new password" required error={errors.confirm}>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
        </div>
        <FormError error={null} />
        <div className="a-actions">
          <Button type="submit" variant="primary" loading={change.isPending}>
            {change.isPending ? null : <KeyRound aria-hidden="true" />}
            Change password
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function PreferencesPanel() {
  const { theme, setTheme } = useTheme();
  const { lang, setLang } = useI18n();
  return (
    <Panel title="Preferences">
      <div className="a-form">
        <Field label="Appearance" help="System follows your device setting." composite>
          <Segmented<ThemePreference>
            label="Appearance"
            value={theme}
            onChange={setTheme}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </Field>
        <Field label="Language" help="Applies to the whole panel." composite>
          <Segmented
            label="Language"
            value={lang}
            onChange={setLang}
            options={[
              { value: "it", label: "Italiano" },
              { value: "en", label: "English" },
            ]}
          />
        </Field>
      </div>
    </Panel>
  );
}
