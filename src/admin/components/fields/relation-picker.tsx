"use client";

import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { useRecordNames } from "../../hooks/use-admin-config";
import type { EntityKey } from "../../lib/fields/types";
import { searchRecordNames } from "../../services/records";
import { Button } from "../ui/button";

interface RelationPickerProps {
  entity: EntityKey;
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
  "aria-label"?: string;
}

/** Searchable record picker (combobox) over current, non-archived records. */
export function RelationPicker({
  entity,
  value,
  onChange,
  placeholder = "Search…",
  disabled,
  id,
  ...aria
}: RelationPickerProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const names = useRecordNames(entity, value ? [value] : []);
  const selectedName = value ? names.data?.[value] : undefined;

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), 200);
    return () => clearTimeout(timer);
  }, [term]);

  const results = useQuery({
    queryKey: ["relation-search", entity, debounced],
    queryFn: () => searchRecordNames(entity, debounced, 20),
    enabled: open,
    staleTime: 10_000,
  });
  const items = results.data ?? [];

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (choice: string | null) => {
    onChange(choice);
    setOpen(false);
    setTerm("");
  };

  return (
    <div className="a-combo" ref={rootRef}>
      <div className="a-input-group">
        <input
          id={id}
          className="a-input"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && items[active] ? `${listId}-${items[active].id}` : undefined
          }
          disabled={disabled}
          placeholder={value ? undefined : placeholder}
          value={open ? term : (selectedName ?? (value ? "Loading…" : ""))}
          onFocus={() => {
            setOpen(true);
            setActive(0);
          }}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && open) {
              e.preventDefault();
              if (items[active]) choose(items[active].id);
            } else if (e.key === "Escape" && open) {
              e.stopPropagation();
              setOpen(false);
            }
          }}
          {...aria}
        />
        {value && !disabled ? (
          <Button
            className="a-input-addon"
            variant="ghost"
            size="sm"
            icon
            aria-label="Clear selection"
            onClick={() => choose(null)}
            style={{ height: 34, borderRadius: "0 4px 4px 0" }}
          >
            <X aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      {open ? (
        <ul className="a-combo-list" id={listId} role="listbox">
          {results.isLoading ? <li className="a-combo-empty">Searching…</li> : null}
          {!results.isLoading && items.length === 0 ? (
            <li className="a-combo-empty">No matching records</li>
          ) : null}
          {items.map((item, index) => (
            <li
              key={item.id}
              id={`${listId}-${item.id}`}
              role="option"
              aria-selected={index === active}
              className="a-combo-item"
              onMouseDown={(e) => {
                e.preventDefault();
                choose(item.id);
              }}
              onMouseEnter={() => setActive(index)}
            >
              <span>{item.display_name}</span>
              {item.id === value ? <span className="a-small">Selected</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
