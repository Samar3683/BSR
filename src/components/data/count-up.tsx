"use client";

import { useEffect, useRef } from "react";

const DURATION = 1100;

/** Every integer in `value`, replaced by `f(n)` (so "24–48" counts both ends). */
const mapNumbers = (value: string, f: (n: number) => number) =>
  value.replace(/\d+/g, (digits) => String(f(Number(digits))));

/**
 * A figure that counts up once, the first time it scrolls into view.
 *
 * - The server (and a page without JavaScript) renders the final value.
 * - Layout never shifts: the final value reserves the space, the counting
 *   copy is laid over it.
 * - Assistive technology only ever reads the final value.
 * - Reduced motion, or a figure already on screen at load: no counting.
 * The counting copy is written straight to its text node (a leaf React never
 * re-renders with other content): no re-render per frame.
 */
export function CountUp({
  value,
  className,
  delay = 0,
}: {
  value: string;
  className?: string;
  /** Wait this long (ms) after entering before counting: figures run in sequence. */
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const counter = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    const output = counter.current;
    if (!element || !output || !/\d/.test(value)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = element.getBoundingClientRect();
    if (box.top < window.innerHeight && box.bottom > 0) return;

    let frame = 0;
    let timer = 0;
    const start = () => {
      timer = window.setTimeout(count, delay);
    };
    const count = () => {
      const t0 = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / DURATION);
        const eased = 1 - (1 - t) ** 3;
        output.textContent = mapNumbers(value, (n) => Math.round(n * eased));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    output.textContent = mapNumbers(value, () => 0);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        start();
      },
      { threshold: 0.6 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      output.textContent = value;
    };
  }, [value, delay]);

  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true" className="relative inline-block tabular-nums">
        <span className="invisible">{value}</span>
        <span ref={counter} className="absolute inset-y-0 left-0 whitespace-nowrap">
          {value}
        </span>
      </span>
    </span>
  );
}
