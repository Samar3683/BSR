// Local Windows patch applied by tools/supabase-local/cli.mjs (setup) to the storage-api checkout.
//
// storage-api's file backend keeps object metadata (content-type, cache-control,
// content-encoding, etag) in extended attributes via the native `fs-xattr`
// package, which does not support win32. On NTFS, alternate data streams
// ("file:stream") give the same "named blob attached to a file" semantics and
// follow the file on rename/copy, so this module implements the three calls
// file.ts uses on top of them. Missing attributes raise ENODATA like fs-xattr.
import * as fs from "node:fs";

function streamPath(file: string, attribute: string): string {
  return `${file}:${attribute.replace(/[:\\/]/g, "_")}`;
}

function missingAttribute(file: string, attribute: string): NodeJS.ErrnoException {
  const err: NodeJS.ErrnoException = new Error(
    `ENODATA: no data available, xattr '${attribute}' on '${file}'`,
  );
  err.code = "ENODATA";
  return err;
}

function isMissingStream(error: unknown, file: string): boolean {
  return (error as NodeJS.ErrnoException)?.code === "ENOENT" && fs.existsSync(file);
}

export function getAttributeSync(file: string, attribute: string): Buffer {
  try {
    return fs.readFileSync(streamPath(file, attribute));
  } catch (error) {
    if (isMissingStream(error, file)) throw missingAttribute(file, attribute);
    throw error;
  }
}

export function setAttributeSync(file: string, attribute: string, value: string | Buffer): void {
  fs.writeFileSync(streamPath(file, attribute), value);
}

export function removeAttributeSync(file: string, attribute: string): void {
  try {
    fs.unlinkSync(streamPath(file, attribute));
  } catch (error) {
    if (isMissingStream(error, file)) throw missingAttribute(file, attribute);
    throw error;
  }
}
