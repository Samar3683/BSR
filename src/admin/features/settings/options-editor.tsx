"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Plus, Trash } from "lucide-react";
import { useState } from "react";

import { Button } from "../../components/ui/button";
import { ConfirmDialog } from "../../components/ui/dialog";
import { FormError } from "../../components/ui/feedback";
import { Checkbox, Input } from "../../components/ui/form";
import { useToast } from "../../components/ui/toast";
import { useAdminConfig, useInvalidateConfig } from "../../hooks/use-admin-config";
import { toAdminError } from "../../lib/errors";
import type { FieldDefinition, FieldOption } from "../../lib/fields/types";
import {
  createOption,
  deleteOption,
  fetchOptionUsage,
  reorderOptions,
  setOptionArchived,
  updateOption,
} from "../../services/config";

/**
 * Dropdown values of a select field. Records store option ids, so labels can
 * be edited freely. Used options can only be archived (they stay readable on
 * existing records but cannot be chosen again); unused ones can be deleted.
 */
export function OptionsEditor({ field }: { field: FieldDefinition }) {
  const toast = useToast();
  const invalidate = useInvalidateConfig();
  const { data: config } = useAdminConfig();
  const [showArchived, setShowArchived] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [toDelete, setToDelete] = useState<FieldOption | null>(null);
  const usage = useQuery({
    queryKey: ["option-usage", field.id],
    queryFn: () => fetchOptionUsage(field.id),
  });
  const all = config?.options[field.id] ?? [];
  const live = all.filter((o) => !o.archived_at);
  const visible = showArchived ? all : live;

  const run = useMutation({
    mutationFn: async (task: () => Promise<unknown>) => task(),
    onSuccess: async () => {
      await invalidate();
    },
    onError: (error) => toast.error(toAdminError(error).message),
  });

  const add = useMutation({
    mutationFn: () =>
      createOption(field.id, newLabel.trim(), ((all.at(-1)?.sort_order ?? 0) as number) + 10),
    onSuccess: async () => {
      setNewLabel("");
      await invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteOption(id),
    onSuccess: async () => {
      setToDelete(null);
      await invalidate();
      toast.success("Option deleted.");
    },
  });

  const move = (option: FieldOption, delta: -1 | 1) => {
    const ids = live.map((o) => o.id);
    const index = ids.indexOf(option.id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    run.mutate(() =>
      reorderOptions(field.id, [...ids, ...all.filter((o) => o.archived_at).map((o) => o.id)]),
    );
  };

  return (
    <div className="a-stack" style={{ gap: 8 }}>
      <div className="a-row" style={{ justifyContent: "space-between" }}>
        <strong>Options</strong>
        <Checkbox label="Show archived" checked={showArchived} onChange={setShowArchived} />
      </div>
      {visible.length === 0 ? (
        <p className="a-muted a-small">No options yet. Add the values people can choose.</p>
      ) : null}
      <div role="list" aria-label={`${field.label} options`}>
        {visible.map((option) => {
          const used = usage.data?.[option.id] ?? 0;
          const liveIndex = live.findIndex((o) => o.id === option.id);
          return (
            <div
              key={option.id}
              role="listitem"
              className="a-option-row"
              data-archived={Boolean(option.archived_at)}
            >
              <span className="a-row" style={{ gap: 0, flexDirection: "column" }}>
                <Button
                  size="sm"
                  variant="ghost"
                  icon
                  aria-label={`Move ${option.label} up`}
                  disabled={!!option.archived_at || liveIndex <= 0 || run.isPending}
                  onClick={() => move(option, -1)}
                  style={{ height: 16 }}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon
                  aria-label={`Move ${option.label} down`}
                  disabled={!!option.archived_at || liveIndex === live.length - 1 || run.isPending}
                  onClick={() => move(option, 1)}
                  style={{ height: 16 }}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
              </span>
              <OptionLabel
                key={option.label}
                option={option}
                onSave={(label) => run.mutate(() => updateOption(option.id, label))}
              />
              <span className="a-small a-muted a-nowrap" title="Records using this option">
                {used} {used === 1 ? "record" : "records"}
              </span>
              <span className="a-row" style={{ flexWrap: "nowrap", gap: 2 }}>
                {option.archived_at ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon
                    aria-label={`Restore ${option.label}`}
                    title="Restore"
                    onClick={() => run.mutate(() => setOptionArchived(option.id, false))}
                  >
                    <ArchiveRestore aria-hidden="true" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon
                    aria-label={`Archive ${option.label}`}
                    title="Archive"
                    onClick={() => run.mutate(() => setOptionArchived(option.id, true))}
                  >
                    <Archive aria-hidden="true" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="danger-ghost"
                  icon
                  aria-label={`Delete ${option.label}`}
                  title={used ? "Used by records: archive it instead" : "Delete"}
                  disabled={used > 0}
                  onClick={() => setToDelete(option)}
                >
                  <Trash aria-hidden="true" />
                </Button>
              </span>
            </div>
          );
        })}
      </div>
      {/* Not a <form>: the editor lives inside the field dialog's form. */}
      <div className="a-row">
        <Input
          aria-label="New option"
          placeholder="New option"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (newLabel.trim()) add.mutate();
            }
          }}
          maxLength={120}
          style={{ flex: 1, minWidth: 160 }}
        />
        <Button loading={add.isPending} disabled={!newLabel.trim()} onClick={() => add.mutate()}>
          {add.isPending ? null : <Plus aria-hidden="true" />}
          Add option
        </Button>
      </div>
      <FormError error={add.error} />
      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this option?"
        message={`“${toDelete?.label}” is not used by any record and will be removed permanently.`}
        confirmLabel="Delete option"
        busy={remove.isPending}
        error={remove.error ? toAdminError(remove.error).message : null}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onClose={() => {
          remove.reset();
          setToDelete(null);
        }}
      />
    </div>
  );
}

function OptionLabel({ option, onSave }: { option: FieldOption; onSave: (label: string) => void }) {
  const [value, setValue] = useState(option.label);
  const commit = () => {
    const label = value.trim();
    if (!label) setValue(option.label);
    else if (label !== option.label) onSave(label);
  };
  return (
    <Input
      className="a-input--sm"
      aria-label={`Option label: ${option.label}`}
      value={value}
      maxLength={120}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") setValue(option.label);
      }}
      disabled={Boolean(option.archived_at)}
    />
  );
}
