import { describe, expect, it } from "vitest";

import { draftFromParams, draftMessage, draftRows, emailHref, whatsappHref } from "./quote-draft";

const params = (query: string) => new URLSearchParams(query);

describe("quote draft", () => {
  it("reads every field a home-page action can pass, in order", () => {
    const draft = draftFromParams(
      params(
        "partenza=Carpi&destinazione=Roma&servizio=dedicato&settore=retail&mezzo=motrice&merce=2%20bancali&quando=luned%C3%AC",
      ),
    );
    expect(draftRows(draft)).toEqual([
      ["Partenza", "Carpi"],
      ["Destinazione", "Roma"],
      ["Servizio", "Trasporto dedicato"],
      ["Settore", "Retail"],
      ["Mezzo", "Motrice"],
      ["Merce", "2 bancali"],
      ["Quando", "lunedì"],
    ]);
  });

  it.each([
    ["servizio=espresso", ["Servizio", "Trasporto espresso"]],
    ["servizio=dedicato", ["Servizio", "Trasporto dedicato"]],
    ["servizio=da-valutare", ["Servizio", "Da valutare insieme"]],
    ["mezzo=furgone", ["Mezzo", "Furgone"]],
    ["mezzo=articolato", ["Mezzo", "Trattore + semirimorchio"]],
    ["mezzo=da-valutare", ["Mezzo", "Da valutare insieme"]],
    ["settore=e-commerce", ["Settore", "E-commerce"]],
    ["settore=aziende-commerciali", ["Settore", "Aziende commerciali"]],
    ["destinazione=Francia", ["Destinazione", "Francia"]],
  ])("names %s", (query, row) => {
    expect(draftRows(draftFromParams(params(query)))).toEqual([row]);
  });

  it("drops unknown choices — including inherited object keys — and caps free text", () => {
    const draft = draftFromParams(
      params(
        `servizio=volo&mezzo=toString&settore=__proto__&partenza=${"x".repeat(200)}&destinazione=%20%20`,
      ),
    );
    expect(draft.service).toBeUndefined();
    expect(draft.vehicle).toBeUndefined();
    expect(draft.sector).toBeUndefined();
    expect(draft.destination).toBeUndefined();
    expect(draft.origin).toHaveLength(80);
  });

  it("writes a short, natural message with only the filled fields", () => {
    const draft = draftFromParams(params("partenza=Carpi&destinazione=Lione&servizio=espresso"));
    expect(draftMessage(draft)).toBe(
      "Ciao, vorrei richiedere un preventivo per un trasporto.\n\nPartenza: Carpi\nDestinazione: Lione\nServizio: Trasporto espresso",
    );
    expect(whatsappHref(draft)).toMatch(/^https:\/\/wa\.me\/393279427723\?text=/);
    const mail = decodeURIComponent(emailHref(draft));
    expect(mail).toMatch(/^mailto:Bsrtrasporti@gmail\.com\?subject=Richiesta di preventivo&body=/);
    expect(mail).toContain("Destinazione: Lione");
  });

  it("without a draft, still opens with the greeting", () => {
    const draft = draftFromParams(params(""));
    expect(draftRows(draft)).toEqual([]);
    expect(draftMessage(draft)).toBe("Ciao, vorrei richiedere un preventivo per un trasporto.");
  });
});
