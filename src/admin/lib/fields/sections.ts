import type { FieldDefinition } from "./types";

export interface FieldSection {
  /** Section name configured on the fields; null for fields without one. */
  name: string | null;
  fields: FieldDefinition[];
}

/**
 * Groups fields by their configured section. Sections appear in the order of
 * their first field; fields keep their configured order inside a section.
 */
export function groupBySection(fields: readonly FieldDefinition[]): FieldSection[] {
  const sections: FieldSection[] = [];
  const byName = new Map<string, FieldSection>();
  for (const field of fields) {
    const name = field.section?.trim() || null;
    const key = name ?? "\u0000";
    let section = byName.get(key);
    if (!section) {
      section = { name, fields: [] };
      byName.set(key, section);
      sections.push(section);
    }
    section.fields.push(field);
  }
  return sections;
}
