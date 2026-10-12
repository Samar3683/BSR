import { describe, expect, it } from "vitest";

import { IT } from "./dictionary";
import { translate } from "./provider";

describe("translate", () => {
  it("returns English text unchanged", () => {
    expect(translate("en", "Orders")).toBe("Orders");
  });
  it("translates known text and keeps unknown text", () => {
    expect(translate("it", "Orders")).toBe("Ordini");
    expect(translate("it", "Something not in the dictionary")).toBe(
      "Something not in the dictionary",
    );
  });
  it("fills placeholders", () => {
    expect(translate("it", "Show {n} empty fields", { n: 3 })).toBe("Mostra 3 campi vuoti");
    expect(translate("en", "Show {n} empty fields", { n: 3 })).toBe("Show 3 empty fields");
  });
  it("keeps placeholders intact between languages", () => {
    for (const [en, it] of Object.entries(IT)) {
      const names = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(names(it), en).toEqual(names(en));
    }
  });
});
