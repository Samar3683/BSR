import { describe, expect, it } from "vitest";

import { isDesignPreviewEnabled } from "./dev";

describe("isDesignPreviewEnabled", () => {
  it("is always available in development", () => {
    expect(isDesignPreviewEnabled({ NODE_ENV: "development" })).toBe(true);
  });

  it("is hidden from production builds by default", () => {
    expect(isDesignPreviewEnabled({ NODE_ENV: "production" })).toBe(false);
  });

  it("can be enabled explicitly for production-mode testing", () => {
    expect(isDesignPreviewEnabled({ NODE_ENV: "production", BSR_DESIGN_PREVIEW: "true" })).toBe(
      true,
    );
  });
});
