import { describe, expect, it } from "vitest";

import { jsonLdScript, organizationJsonLd } from "./structured-data";

describe("structured data", () => {
  const data = organizationJsonLd();

  it("describes BSR with the verified facts", () => {
    expect(data).toMatchObject({
      "@type": "LocalBusiness",
      name: "BSR Trasporti",
      legalName: "B.S.R. di Ashraf Barjees Tahir",
      telephone: "+393279427723",
      email: "Bsrtrasporti@gmail.com",
      vatID: "IT03989650365",
      url: "https://bsrtrasporti.com",
    });
    expect(data.address).toMatchObject({ postalCode: "41012", addressLocality: "Carpi" });
    expect(data.areaServed.map((area) => area.name)).toContain("Turchia");
  });

  it("never claims what BSR has not supplied", () => {
    for (const key of [
      "openingHours",
      "openingHoursSpecification",
      "aggregateRating",
      "review",
      "priceRange",
      "foundingDate",
      "numberOfEmployees",
    ]) {
      expect(data).not.toHaveProperty(key);
    }
  });

  it("escapes markup in the script payload", () => {
    expect(jsonLdScript({ name: "</script>" })).not.toContain("</script>");
  });
});
