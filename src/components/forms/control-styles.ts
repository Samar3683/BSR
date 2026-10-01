/*
 * Shared control styling. Labels always sit above controls (no floating or
 * placeholder-only labels), so a filled field looks like a default field
 * holding a value. State is shown by border + message with icon + text.
 */

const CONTROL_BASE =
  "block w-full min-h-12 rounded-md border border-border-strong bg-surface-field px-4 py-3 type-body-md text-text-primary transition-ui " +
  "hover:border-border-interactive " +
  "aria-invalid:border-danger-graphic aria-invalid:hover:border-danger-graphic " +
  "data-[state=success]:border-success-graphic " +
  "disabled:cursor-not-allowed disabled:border-border-default disabled:bg-transparent disabled:text-text-disabled";

/** Text inputs and textareas. Read-only fields are dashed and unfilled. */
export const textControlStyles =
  CONTROL_BASE +
  " placeholder:text-text-muted " +
  "[&[readonly]]:border-dashed [&[readonly]]:bg-transparent [&[readonly]]:hover:border-border-strong";

/** Native select (read-only does not apply to selects). */
export const selectControlStyles = CONTROL_BASE + " appearance-none pr-12 cursor-pointer";
