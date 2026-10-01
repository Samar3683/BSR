interface SkipLinkProps {
  targetId: string;
  label: string;
}

/** First focusable element on every page; visible only while focused. */
export function SkipLink({ targetId, label }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only rounded-md bg-background-inverse px-5 py-3 type-label-md text-text-inverse focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-(--z-skip-link)"
    >
      {label}
    </a>
  );
}
