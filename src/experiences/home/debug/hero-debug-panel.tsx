"use client";

import { type RefObject, useEffect, useState } from "react";

import type { ScrollTrigger } from "@/lib/animation/gsap";

import { HERO_CHECKPOINTS, HERO_STATES } from "../config/hero-states";
import type { HeroInspector } from "../components/hero-cinematic";

/*
 * ⚠ DEVELOPMENT / TEST ONLY. Loaded through a dynamic import behind a
 * build-time guard, so it is compiled out of production bundles. Plain DOM — no
 * GUI dependency. Enable with `?hero-debug`.
 */

interface HeroDebugPanelProps {
  inspector: HeroInspector;
  trigger: RefObject<ScrollTrigger | null>;
}

function scrollToProgress(trigger: ScrollTrigger | null, progress: number) {
  if (!trigger) return;
  // Lenis ignores native scrolls while it interpolates a wheel gesture. The
  // smooth-scroll provider already settles that animation on scroll keys, so a
  // synthetic key (no default action: it never scrolls by itself) settles it
  // before the jump. Dev-only; production scrolling is untouched.
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
  window.scrollTo({
    top: trigger.start + progress * (trigger.end - trigger.start),
    behavior: "instant",
  });
}

function reloadWith(param: string, value: string | null) {
  const url = new URL(window.location.href);
  if (value === null) url.searchParams.delete(param);
  else url.searchParams.set(param, value);
  window.location.assign(url.toString());
}

const fixed = (value: number, digits = 3) => value.toFixed(digits);

export default function HeroDebugPanel({ inspector, trigger }: HeroDebugPanelProps) {
  const [, setTick] = useState(0);
  const [zones, setZones] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 250);
    return () => window.clearInterval(id);
  }, []);

  const runtime = inspector.runtime;
  const metrics = runtime?.metrics() ?? null;
  const info = runtime?.rendererInfo() ?? null;
  const audit = runtime?.audit ?? null;

  const row = (label: string, value: string) => (
    <div className="flex justify-between gap-4">
      <span className="text-text-muted">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );

  return (
    <>
      {zones && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-(--z-cinematic-ui)"
        >
          {/* Text safe zone (left 42% wide/standard; lower 45% compact) and truck zone. */}
          <div className="absolute inset-y-0 left-0 w-[42%] border-2 border-dashed border-[#ff2bd6] max-md:inset-x-0 max-md:top-auto max-md:h-[45%] max-md:w-full">
            <span className="absolute top-2 left-2 bg-carbon px-1 text-[11px] text-[#ff2bd6]">
              TEXT SAFE ZONE
            </span>
          </div>
          <div className="absolute inset-y-0 right-0 w-[58%] border-2 border-dashed border-[#2bd6ff] max-md:inset-x-0 max-md:bottom-auto max-md:h-[55%] max-md:w-full">
            <span className="absolute top-2 right-2 bg-carbon px-1 text-[11px] text-[#2bd6ff]">
              TRUCK ZONE
            </span>
          </div>
        </div>
      )}

      <aside
        aria-label="Hero debug panel (development only)"
        className="fixed bottom-3 left-3 z-(--z-toast) max-h-[80vh] w-80 overflow-auto rounded-md border border-border-default bg-surface-elevated p-3 font-mono text-[11px] leading-snug text-text-primary shadow-overlay"
      >
        <div className="mb-2 flex items-center justify-between">
          <strong>HERO DEBUG · dev only</strong>
          <button type="button" className="underline" onClick={() => setOpen((value) => !value)}>
            {open ? "hide" : "show"}
          </button>
        </div>
        {open && (
          <div className="flex flex-col gap-2">
            <section>
              {row("path / tier", `${inspector.path} / ${inspector.tier}`)}
              {row("realtime", `${inspector.realtime} (${inspector.phase ?? "—"})`)}
              {inspector.failure && row("failure", inspector.failure)}
              {row(
                "raw / displayed",
                `${fixed(inspector.progress.raw)} / ${fixed(inspector.progress.displayed)}`,
              )}
              {row("ladder still", `S${inspector.ladderIndex + 1}`)}
              {row("hero ScrollTriggers", String(inspector.heroScrollTriggers))}
            </section>

            {metrics && (
              <section>
                {row("story / state", `${fixed(metrics.storyProgress)} · ${metrics.state}`)}
                {row(
                  "world / mode",
                  `${metrics.world} · ${metrics.mode}${metrics.returnFrom !== null ? ` from ${fixed(metrics.returnFrom)}` : ""}`,
                )}
                {row("rebased", String(metrics.rebased))}
                {row("dock distance D", `${fixed(metrics.dockDistance, 2)} m`)}
                {row(
                  "speed dock / road",
                  `${fixed(metrics.dockSpeed, 2)} / ${fixed(metrics.roadSpeed, 2)} m/s`,
                )}
                {row("braking", String(metrics.braking))}
                {row("wheel travel", `${fixed(metrics.wheelTravel, 1)} m`)}
                {row("trailer coverage", `${fixed(metrics.coverage * 100, 1)} %`)}
                {row("framing bucket", metrics.bucket)}
                {row("camera fov", fixed(metrics.camera.fov, 1))}
                {row("camera pos", metrics.camera.position.map((v) => fixed(v, 1)).join(", "))}
                {row("quality level", metrics.settings.level)}
                {row(
                  "render ratio / shadows",
                  `${fixed(metrics.pixelRatio, 2)} / ${metrics.settings.shadowMapSize}`,
                )}
                {row("frame", `${fixed(runtime?.frameMs ?? 0, 1)} ms`)}
                {info && row("calls / tris", `${info.calls} / ${info.triangles}`)}
                {info && row("textures / programs", `${info.textures} / ${info.programs}`)}
                {audit && row("invariant violations", String(audit.violations.length))}
                {audit &&
                  row("rebases / switches", `${audit.rebases.length} / ${audit.switches.length}`)}
              </section>
            )}

            <section className="flex flex-col gap-1">
              <label className="flex flex-col gap-1">
                <span className="text-text-muted">scrub progress</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.001}
                  value={inspector.progress.raw}
                  onChange={(event) =>
                    scrollToProgress(trigger.current, Number(event.target.value))
                  }
                />
              </label>
              <div className="flex flex-wrap gap-1">
                {HERO_STATES.map((state) => (
                  <button
                    key={state.name}
                    type="button"
                    className="rounded-sm border border-border-default px-1"
                    onClick={() => scrollToProgress(trigger.current, state.start + 0.005)}
                  >
                    {state.name}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(HERO_CHECKPOINTS).map(([name, value]) => (
                  <button
                    key={name}
                    type="button"
                    className="rounded-sm border border-border-default px-1"
                    onClick={() => scrollToProgress(trigger.current, value)}
                  >
                    ◎ {name}
                  </button>
                ))}
              </div>
            </section>

            <section className="flex flex-wrap gap-1">
              {runtime && (
                <button
                  type="button"
                  className="rounded-sm border border-border-default px-1"
                  onClick={() => runtime.toggleFrozen()}
                >
                  {runtime.frozen ? "unfreeze sim" : "freeze sim"}
                </button>
              )}
              <button
                type="button"
                className="rounded-sm border border-border-default px-1"
                onClick={() => setZones((value) => !value)}
              >
                safe zones
              </button>
              {runtime && (
                <button
                  type="button"
                  className="rounded-sm border border-border-default px-1"
                  onClick={() => runtime.simulateContextLoss()}
                >
                  lose context
                </button>
              )}
              <button
                type="button"
                className="rounded-sm border border-border-default px-1"
                onClick={() => reloadWith("hero-fail", "assets")}
              >
                fail assets
              </button>
            </section>

            <section className="flex flex-wrap gap-1">
              {(["realtime", "media", "reduced", "fallback"] as const).map((path) => (
                <button
                  key={path}
                  type="button"
                  className="rounded-sm border border-border-default px-1"
                  onClick={() => reloadWith("hero-path", path)}
                >
                  path: {path}
                </button>
              ))}
              {(["high", "medium", "low"] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  className="rounded-sm border border-border-default px-1"
                  onClick={() => reloadWith("hero-tier", tier)}
                >
                  tier: {tier}
                </button>
              ))}
              <button
                type="button"
                className="rounded-sm border border-border-default px-1"
                onClick={() => reloadWith("hero-allow-software", "")}
              >
                allow software GL
              </button>
            </section>
          </div>
        )}
      </aside>
    </>
  );
}
