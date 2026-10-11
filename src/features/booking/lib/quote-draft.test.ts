import { describe, expect, it } from "vitest";

import {
  draftFromParams,
  draftMessage,
  draftRows,
  email,
  emailHref,
  phone,
  whatsappHref,
} from "./quote-draft";

const params = (query: string) => new URLSearchParams(query);

const FULL =
  "nome=Mario%20Rossi&email=mario%40example.it&prefisso=%2B39&telefono=333%20123%204567" +
  "&ritiro_via=Via%20Roma%2010&ritiro_cap=41012&ritiro_citta=Carpi&ritiro_provincia=MO" +
  "&consegna_via=5%20Rue%20de%20la%20Gare&consegna_cap=69001&consegna_citta=Lione&consegna_provincia=Rh%C3%B4ne";

describe("quote draft", () => {
  it("reads the form's fields — contacts and both addresses — in order", () => {
    expect(draftRows(draftFromParams(params(FULL)))).toEqual([
      ["Nome", "Mario Rossi"],
      ["Telefono", "+39 333 123 4567"],
      ["Email", "mario@example.it"],
      ["Ritiro", "Via Roma 10, 41012 Carpi (MO)"],
      ["Consegna", "5 Rue de la Gare, 69001 Lione (Rhône)"],
    ]);
  });

  it("carries a service, sector or vehicle chosen elsewhere as context", () => {
    const draft = draftFromParams(params("servizio=dedicato&settore=retail&mezzo=motrice"));
    expect(draftRows(draft)).toEqual([
      ["Servizio", "Trasporto dedicato"],
      ["Settore", "Retail"],
      ["Mezzo", "Motrice"],
    ]);
  });

  it.each([
    ["servizio=espresso", ["Servizio", "Trasporto espresso"]],
    ["servizio=da-valutare", ["Servizio", "Da valutare insieme"]],
    ["mezzo=articolato", ["Mezzo", "Trattore + semirimorchio"]],
    ["settore=e-commerce", ["Settore", "E-commerce"]],
    ["destinazione=Turchia", ["Consegna", "Turchia"]],
    ["partenza=Carpi", ["Ritiro", "Carpi"]],
  ])("names %s", (query, row) => {
    expect(draftRows(draftFromParams(params(query)))).toEqual([row]);
  });

  it("uses the Italian prefix unless another listed one is chosen, and drops unknown ones", () => {
    expect(draftRows(draftFromParams(params("telefono=3331234567")))).toEqual([
      ["Telefono", "+39 3331234567"],
    ]);
    expect(draftRows(draftFromParams(params("prefisso=%2B33&telefono=612345678")))).toEqual([
      ["Telefono", "+33 612345678"],
    ]);
    expect(draftFromParams(params("prefisso=%2B999")).prefix).toBeUndefined();
  });

  it("accepts only a plausible email and phone", () => {
    expect(email("mario@example.it")).toBe("mario@example.it");
    expect(email("mario")).toBeUndefined();
    expect(email("a b@c.d")).toBeUndefined();
    expect(phone("333 123 4567")).toBe("333 123 4567");
    expect(phone("12")).toBeUndefined();
    expect(phone("abc")).toBeUndefined();
    expect(phone("333<script>1234567")).toBe("3331234567");
  });

  it("drops unknown choices — including inherited object keys — and caps free text", () => {
    const draft = draftFromParams(
      params(
        `servizio=volo&mezzo=toString&settore=__proto__&nome=${"x".repeat(200)}&ritiro_citta=%20%20`,
      ),
    );
    expect(draft.service).toBeUndefined();
    expect(draft.vehicle).toBeUndefined();
    expect(draft.sector).toBeUndefined();
    expect(draft.pickupCity).toBeUndefined();
    expect(draft.name).toHaveLength(80);
  });

  it("writes a short, natural message with only the filled fields", () => {
    const draft = draftFromParams(params(FULL));
    expect(draftMessage(draft)).toBe(
      "Ciao, vorrei richiedere un preventivo per un trasporto.\n\n" +
        "Nome: Mario Rossi\nTelefono: +39 333 123 4567\nEmail: mario@example.it\n" +
        "Ritiro: Via Roma 10, 41012 Carpi (MO)\nConsegna: 5 Rue de la Gare, 69001 Lione (Rhône)",
    );
    expect(whatsappHref(draft)).toMatch(/^https:\/\/wa\.me\/393279427723\?text=/);
    const mail = decodeURIComponent(emailHref(draft));
    expect(mail).toMatch(/^mailto:Bsrtrasporti@gmail\.com\?subject=Richiesta di preventivo&body=/);
    expect(mail).toContain("Consegna: 5 Rue de la Gare");
  });

  it("without a draft, still opens with the greeting", () => {
    const draft = draftFromParams(params(""));
    expect(draftRows(draft)).toEqual([]);
    expect(draftMessage(draft)).toBe("Ciao, vorrei richiedere un preventivo per un trasporto.");
  });
});
