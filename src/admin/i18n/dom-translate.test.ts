import { describe, expect, it } from "vitest";

import { italianFor } from "./dom-translate";

describe("italianFor", () => {
  it("translates dictionary text and keeps names", () => {
    expect(italianFor("Orders")).toBe("Ordini");
    expect(italianFor("Giulia Ferri")).toBeNull();
  });

  it("translates sentences with numbers", () => {
    expect(italianFor("3 min ago")).toBe("3 min fa");
    expect(italianFor("1 new requests")).toBe("1 nuova richiesta");
    expect(italianFor("Page 2 of 5")).toBe("Pagina 2 di 5");
    expect(italianFor("Use at least 10 characters")).toBe("Usa almeno 10 caratteri");
  });

  it("translates a verb and a known noun but never half a sentence", () => {
    expect(italianFor("Search orders…")).toBe("Cerca ordini…");
    expect(italianFor("Edit BSR-2026-00001")).toBe("Modifica BSR-2026-00001");
    expect(italianFor("Search something nobody translated")).toBeNull();
  });

  it("translates the parts of a joined label and leaves the names", () => {
    expect(italianFor("customer · Notes")).toBe("cliente · Note");
    expect(italianFor("BSR-2026-00001 · Mario Rossi\nConfirmed · unassigned")).toBe(
      "BSR-2026-00001 · Mario Rossi\nConfermato · non assegnato",
    );
  });

  it("builds the audit lines", () => {
    expect(italianFor("Created field customer · Notes")).toBe("Creato campo cliente · Note");
  });

  it("translates the messages the database raises", () => {
    expect(italianFor("Name is required")).toBe("Il nome è obbligatorio");
    expect(italianFor("Order not found")).toBe("Ordine non trovato");
  });
});
