import { describe, expect, it } from "vitest";

import { csvCell, csvFileName, neutralizeFormula, toCsv } from "./csv";

describe("csv", () => {
  it("quotes separators, quotes and line breaks", () => {
    expect(csvCell('Rossi, "Srl"')).toBe('"Rossi, ""Srl"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(12.5)).toBe("12.5");
  });

  it("neutralises spreadsheet formulas but keeps negative numbers", () => {
    expect(neutralizeFormula('=HYPERLINK("x")')).toBe('\'=HYPERLINK("x")');
    expect(neutralizeFormula("+39 333")).toBe("'+39 333");
    expect(neutralizeFormula("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(neutralizeFormula("-12.5")).toBe("-12.5");
    expect(neutralizeFormula("-cmd")).toBe("'-cmd");
  });

  it("writes a BOM, a header row and CRLF line ends", () => {
    expect(toCsv(["Order", "Weight"], [["BSR-2026-00001", 1200]])).toBe(
      "\uFEFFOrder,Weight\r\nBSR-2026-00001,1200\r\n",
    );
  });

  it("builds safe file names", () => {
    expect(csvFileName("Orders 2026/10", new Date("2026-10-11T10:00:00Z"))).toBe(
      "orders-2026-10-2026-10-11.csv",
    );
  });
});
