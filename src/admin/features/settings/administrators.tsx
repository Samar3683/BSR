"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { useSession } from "../../components/shell/session";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { EmptyState, ErrorState, FormError, LoadingState } from "../../components/ui/feedback";
import { Field, Input, Switch } from "../../components/ui/form";
import { Panel } from "../../components/ui/layout";
import { useToast } from "../../components/ui/toast";
import { formatDateTime } from "../../lib/datetime";
import { toAdminError } from "../../lib/errors";
import { fetchAdmins, inviteAdmin, renameAdmin, setAdminActive } from "../../services/admins";

/**
 * Who can use the panel. There is no public sign-up: administrators are
 * invited (an Edge Function creates the Auth user with the service role) and
 * can be deactivated, which immediately removes their access through RLS.
 */
export function AdministratorsSettings() {
  const { admin } = useSession();
  const toast = useToast();
  const client = useQueryClient();
  const admins = useQuery({ queryKey: ["admins"], queryFn: fetchAdmins });
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const refresh = () => client.invalidateQueries({ queryKey: ["admins"] });

  const invite = useMutation({
    mutationFn: () => inviteAdmin(email.trim(), name.trim()),
    onSuccess: async () => {
      toast.success(`Invitation sent to ${email.trim()}.`);
      setEmail("");
      setName("");
      await refresh();
    },
    onError: (error) => setErrors(toAdminError(error).fieldErrors),
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setAdminActive(id, active),
    onSuccess: async (_, { active }) => {
      toast.success(active ? "Administrator reactivated." : "Administrator deactivated.");
      await refresh();
    },
    onError: (error) => toast.error(toAdminError(error).message),
  });

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameAdmin(id, name),
    onSuccess: async () => {
      toast.success("Name updated.");
      setRenaming(null);
      await refresh();
    },
    onError: (error) => toast.error(toAdminError(error).message),
  });

  const onInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = "Enter a valid email address";
    if (!name.trim()) next.display_name = "Enter the person's name";
    setErrors(next);
    if (!Object.keys(next).length) invite.mutate();
  };

  return (
    <div className="a-stack">
      <Panel title="Administrators" flush>
        {admins.isError ? (
          <ErrorState error={admins.error} onRetry={() => admins.refetch()} />
        ) : admins.isLoading ? (
          <LoadingState />
        ) : !admins.data?.length ? (
          <EmptyState title="No administrators" />
        ) : (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Last sign-in</th>
                  <th scope="col">Access</th>
                  <th scope="col">
                    <span className="a-sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {admins.data.map((row) => {
                  const self = row.user_id === admin.user_id;
                  return (
                    <tr key={row.id}>
                      <td>
                        {row.display_name}
                        {self ? (
                          <span className="a-badge" style={{ marginLeft: 6 }}>
                            You
                          </span>
                        ) : null}
                      </td>
                      <td>{row.email}</td>
                      <td>{row.role}</td>
                      <td>
                        {row.last_sign_in_at ? (
                          formatDateTime(row.last_sign_in_at)
                        ) : (
                          <span className="a-muted">Never</span>
                        )}
                      </td>
                      <td>
                        <Switch
                          label={row.active ? "Active" : "Inactive"}
                          checked={row.active}
                          disabled={self || toggle.isPending}
                          title={self ? "You cannot change your own access" : undefined}
                          onChange={(active) => toggle.mutate({ id: row.id, active })}
                        />
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Rename ${row.display_name}`}
                          onClick={() => setRenaming({ id: row.id, name: row.display_name })}
                        >
                          <Pencil aria-hidden="true" />
                          Rename
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Dialog
        open={renaming !== null}
        title="Rename administrator"
        onClose={() => setRenaming(null)}
        busy={rename.isPending}
        onSubmit={() => {
          if (renaming && renaming.name.trim())
            rename.mutate({ id: renaming.id, name: renaming.name.trim() });
        }}
        footer={
          <>
            <Button onClick={() => setRenaming(null)} disabled={rename.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={rename.isPending}
              disabled={!renaming?.name.trim()}
            >
              Save
            </Button>
          </>
        }
      >
        <Field label="Name" required>
          <Input
            value={renaming?.name ?? ""}
            maxLength={120}
            onChange={(e) => setRenaming((r) => (r ? { ...r, name: e.target.value } : r))}
          />
        </Field>
      </Dialog>

      <Panel title="Invite an administrator">
        <form className="a-form" onSubmit={onInvite} noValidate>
          <p className="a-help">
            The person receives an email with a link to choose a password. Only invited people can
            sign in; there is no public registration.
          </p>
          <div className="a-form-grid">
            <Field label="Email" required error={errors.email}>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field label="Name" required error={errors.display_name}>
              <Input
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
              />
            </Field>
          </div>
          <FormError error={invite.error && !Object.keys(errors).length ? invite.error : null} />
          <div className="a-row" style={{ justifyContent: "flex-end" }}>
            <Button type="submit" variant="primary" loading={invite.isPending}>
              {invite.isPending ? null : <UserPlus aria-hidden="true" />}
              Send invitation
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
