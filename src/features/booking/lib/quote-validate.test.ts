import { describe, expect, it } from "vitest";

import { draftFromParams } from "./quote-draft";
import { firstError, quotePayload, validateQuote } from "./quote-validate";

const complete = {
  name: "Mario Rossi",
  phone: "333 123 4567",
  pickupStreet: "Via Roma 10",
  pickupZip: "41012",
  pickupCity: "Carpi",
  pickupProvince: "MO",
  deliveryStreet: "5 Rue de la Gare",
  deliveryZip: "69001",
  deliveryCity: "Lione",
  deliveryProvince: "Rhône",
};

describe("validateQuote", () => {
  it("accepts a complete request without email", () => {
    expect(validateQuote(complete)).toEqual({});
  });

  it("names every missing field and finds the first one in form order", () => {
    const errors = validateQuote({ name: "x" });
    expect(Object.keys(errors).sort()).toEqual(
      [
        "phone",
        "pickupStreet",
        "pickupZip",
        "pickupCity",
        "pickupProvince",
        "deliveryStreet",
        "deliveryZip",
        "deliveryCity",
        "deliveryProvince",
      ].sort(),
    );
    expect(firstError(errors)).toBe("phone");
  });

  it("checks the optional email and the phone", () => {
    expect(validateQuote({ ...complete, email: "not-an-email" }).email).toBeTruthy();
    expect(validateQuote({ ...complete, email: "mario@example.it" }).email).toBeUndefined();
    expect(validateQuote({ ...complete, phone: "12" }).phone).toBeTruthy();
  });
});

describe("quotePayload", () => {
  it("sends the cleaned draft with the phone prefix and the context", () => {
    const params = new URLSearchParams({
      nome: "  Mario   Rossi ",
      prefisso: "+33",
      telefono: "6 12 34 56 78",
      ritiro_via: "Via Roma 10",
      ritiro_cap: "41012",
      ritiro_citta: "Carpi",
      ritiro_provincia: "MO",
      consegna_via: "5 Rue de la Gare",
      consegna_cap: "69001",
      consegna_citta: "Lione",
      consegna_provincia: "Rhône",
      servizio: "volo",
    });
    const payload = quotePayload(draftFromParams(params), 4200);
    expect(payload.name).toBe("Mario Rossi");
    expect(payload.phone).toBe("+33 6 12 34 56 78");
    expect(payload.pickup).toEqual({
      street: "Via Roma 10",
      zip: "41012",
      city: "Carpi",
      province: "MO",
    });
    // Unknown choices are dropped, like everywhere else on the page.
    expect(payload.context.service).toBeUndefined();
    expect(payload.elapsed).toBe(4200);
  });
});
