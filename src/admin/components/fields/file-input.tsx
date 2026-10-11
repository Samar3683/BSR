"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Paperclip, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

import { toAdminError } from "../../lib/errors";
import { formatFileSize } from "../../lib/fields/format";
import { allowedFileTypes, maxFileSizeMb } from "../../lib/fields/registry";
import type { FieldDefinition, FileValue } from "../../lib/fields/types";
import { signedFileUrl, uploadFieldFile } from "../../services/files";
import { Button } from "../ui/button";

/** Signed URL for a private file (refreshed before it expires). */
export function useSignedUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["signed-url", path],
    queryFn: () => signedFileUrl(path!, 600),
    enabled: Boolean(path),
    staleTime: 8 * 60_000,
  });
}

export function FilePreview({ value, image }: { value: FileValue; image: boolean }) {
  const url = useSignedUrl(value.path);
  return (
    <div className="a-file">
      {image && url.data ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL of a private file
        <img className="a-thumb" src={url.data} alt="" />
      ) : (
        <Paperclip size={16} aria-hidden="true" />
      )}
      <span className="a-file-name" title={value.name}>
        {value.name}
        {value.size ? (
          <span className="a-muted a-small"> · {formatFileSize(value.size)}</span>
        ) : null}
      </span>
      {url.data ? (
        <a
          className="a-btn a-btn--sm a-btn--ghost"
          href={url.data}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink aria-hidden="true" />
          Open
        </a>
      ) : null}
    </div>
  );
}

interface FileInputProps {
  def: FieldDefinition;
  value: FileValue | null;
  onChange: (value: FileValue | null) => void;
  disabled?: boolean;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

/** Uploads to private storage on selection; the record stores the reference. */
export function FileInput({ def, value, onChange, disabled, id, ...aria }: FileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const image = def.field_type === "image";
  const accept = allowedFileTypes(def).join(",");

  return (
    <div style={{ display: "grid", gap: 6 }}>
      {value ? <FilePreview value={value} image={image} /> : null}
      <div className="a-row">
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          hidden
          disabled={disabled || busy}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            setBusy(true);
            setError(null);
            try {
              onChange(await uploadFieldFile(def, file));
            } catch (err) {
              setError(toAdminError(err).message);
            } finally {
              setBusy(false);
            }
          }}
          {...aria}
        />
        <Button
          size="sm"
          loading={busy}
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? null : <Upload aria-hidden="true" />}
          {value ? "Replace" : image ? "Upload image" : "Upload file"}
        </Button>
        {value ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled || busy}
            onClick={() => onChange(null)}
          >
            <X aria-hidden="true" />
            Remove
          </Button>
        ) : null}
        <span className="a-help">Up to {maxFileSizeMb(def)} MB</span>
      </div>
      {error ? (
        <p className="a-error-text" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
