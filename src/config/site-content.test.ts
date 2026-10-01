import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { company, contact, coverage, europeList } from "./site-content";

const SRC = join(__dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Business facts that must be written once, in site-content.ts. */
const FACTS = [
  "327 942",
  "3279427723",
  "Bsrtrasporti@",
  "legalmail",
  "03989650365",
  "MO-434008",
  "Carducci",
  "Ashraf",
];

describe("business facts", () => {
  it("are written once, in config/site-content.ts", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => !file.endsWith("site-content.ts"))
      .flatMap((file) => {
        const text = readFileSync(file, "utf8");
        return FACTS.filter((fact) => text.includes(fact)).map(
          (fact) => `${relative(SRC, file)}: ${fact}`,
        );
      });
    expect(offenders).toEqual([]);
  });

  it("are the verified values (docs/content-audit.md)", () => {
    expect(contact.phoneHref).toBe("tel:+393279427723");
    expect(contact.whatsappHref).toBe("https://wa.me/393279427723");
    expect(contact.pec).toBe("b.s.r@legalmail.it");
    expect(company.legalName).toBe("B.S.R. di Ashraf Barjees Tahir");
    expect(coverage.europe.map((route) => route.country)).toEqual([
      "Francia",
      "Spagna",
      "Ungheria",
      "Portogallo",
      "Romania",
      "Grecia",
      "Turchia",
    ]);
    expect(europeList).toBe("Francia, Spagna, Ungheria, Portogallo, Romania, Grecia e Turchia");
  });
});
