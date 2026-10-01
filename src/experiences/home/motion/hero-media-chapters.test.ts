import { describe, expect, it } from "vitest";

import {
  INITIAL_MEDIA_STATE,
  type MediaEvent,
  mediaReducer,
  type MediaState,
  mediaStill,
} from "./hero-media-chapters";

function play(events: MediaEvent[], from: MediaState = INITIAL_MEDIA_STATE): MediaState {
  return events.reduce(mediaReducer, from);
}

const bothReady: MediaEvent[] = [
  { type: "ready", clip: "A" },
  { type: "ready", clip: "B" },
];

describe("phone media chapters", () => {
  it("plays clip A at the top once it is ready", () => {
    const state = play([...bothReady, { type: "progress", progress: 0.05 }]);
    expect(state.active?.clip).toBe("A");
  });

  it("never queues: B does not start while A is playing, and only one clip is ever active", () => {
    let state = play([...bothReady, { type: "progress", progress: 0.05 }]);
    state = mediaReducer(state, { type: "progress", progress: 0.4 });
    // A was cancelled by leaving its chapter; B may start — but never alongside A.
    expect(state.active?.clip).toBe("B");
    expect(state.played.A).toBe(true);
  });

  it("a fast fling past both chapters plays nothing and shows the route still", () => {
    const state = play([...bothReady, { type: "progress", progress: 0.95 }]);
    expect(state.active).toBeNull();
    expect(state.played).toEqual({ A: true, B: true });
    expect(mediaStill(state)).toBe("S4");
  });

  it("cancels a playing clip when the visitor scrolls past its chapter", () => {
    let state = play([...bothReady, { type: "progress", progress: 0.5 }]);
    expect(state.active?.clip).toBe("B");
    state = mediaReducer(state, { type: "progress", progress: 0.92 });
    expect(state.active).toBeNull();
    expect(mediaStill(state)).toBe("S4");
  });

  it("never replays a clip after returning to its chapter", () => {
    let state = play([...bothReady, { type: "progress", progress: 0.05 }]);
    state = play(
      [
        { type: "ended", clip: "A" },
        { type: "progress", progress: 0.95 },
      ],
      state,
    );
    state = mediaReducer(state, { type: "progress", progress: 0.05 });
    expect(state.active).toBeNull();
    expect(mediaStill(state)).toBe("S2");
  });

  it("stops when mostly offscreen and does not resume on return", () => {
    let state = play([...bothReady, { type: "progress", progress: 0.05 }]);
    state = mediaReducer(state, { type: "visibility", ratio: 0.1 });
    expect(state.active).toBeNull();
    state = mediaReducer(state, { type: "visibility", ratio: 1 });
    expect(state.active).toBeNull();
    expect(mediaStill(state)).toBe("S2");
  });

  it("does not start while the hero is less than half visible", () => {
    const state = play([{ type: "visibility", ratio: 0.3 }, ...bothReady]);
    expect(state.active).toBeNull();
  });

  it("degrades to stills when autoplay is refused", () => {
    let state = play([...bothReady, { type: "progress", progress: 0.05 }]);
    state = mediaReducer(state, { type: "autoplayRefused" });
    expect(state.active).toBeNull();
    state = mediaReducer(state, { type: "progress", progress: 0.5 });
    expect(state.active).toBeNull();
    expect(mediaStill(state)).toBe("S2");
  });

  it("keeps a user pause until the chapter changes", () => {
    let state = play([...bothReady, { type: "progress", progress: 0.05 }, { type: "userPause" }]);
    expect(state.active).toEqual({ clip: "A", userPaused: true });
    state = mediaReducer(state, { type: "progress", progress: 0.1 });
    expect(state.active?.userPaused).toBe(true);
    state = mediaReducer(state, { type: "progress", progress: 0.95 });
    expect(state.active).toBeNull();
  });
});
