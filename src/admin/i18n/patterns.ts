/**
 * Interface text with numbers or names in it ("3 min ago", "Page 2 of 5").
 * Each rule turns the English sentence into Italian. `tr` translates a part
 * that is itself interface text (a status, a field label) and gives up on the
 * whole rule when it is not; `tr.keep` lets names and ids through unchanged.
 */
export type Translator = ((text: string) => string) & { keep: (text: string) => string };
type Rule = [RegExp, (match: RegExpExecArray, tr: Translator) => string];

const plural = (n: string, one: string, many: string) => (Number(n) === 1 ? one : many);
const count = (n: string, one: string, many: string) => `${n} ${plural(n, one, many)}`;
/** A record's name or number ("BSR-2026-00001", "Mario Rossi") passes through; a noun has to be known. */
const named = (tr: Translator, text: string) =>
  /^[A-Z0-9]/.test(text) && !/^(All|Orders|Vehicles|Drivers|Customers)/.test(text)
    ? tr.keep(text)
    : lower(tr(text));
const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

export const PATTERNS: Rule[] = [
  [/^Use at least (\d+) characters$/, (m) => `Usa almeno ${m[1]} caratteri`],
  [/^Use at most (\d+) characters$/, (m) => `Usa al massimo ${m[1]} caratteri`],
  [/^Must be at most (\d+) characters$/, (m) => `Al massimo ${m[1]} caratteri`],
  [/^Request failed \((\d+)\)$/, (m) => `Richiesta non riuscita (${m[1]})`],
  [/^Unexpected response \((\d+)\)$/, (m) => `Risposta imprevista (${m[1]})`],
  // Counts and badges
  [/^(\d+) messages waiting$/, (m) => count(m[1]!, "messaggio in attesa", "messaggi in attesa")],
  [/^(\d+) new requests?$/, (m) => count(m[1]!, "nuova richiesta", "nuove richieste")],
  [/^(\d+) overdue$/, (m) => `${m[1]} in ritardo`],
  [/^(\d+) awaiting dispatch$/, (m) => `${m[1]} in attesa di dispatch`],
  [/^(\d+) delivered$/, (m) => count(m[1]!, "consegnato", "consegnati")],
  [/^(\d+) selected$/, (m) => count(m[1]!, "selezionato", "selezionati")],
  [/^(\d+) results?$/, (m) => count(m[1]!, "risultato", "risultati")],
  [/^(\d+) orders?$/, (m) => count(m[1]!, "ordine", "ordini")],
  [/^(\d+) requests?$/, (m) => count(m[1]!, "richiesta", "richieste")],
  [/^(\d+) messages?$/, (m) => count(m[1]!, "messaggio", "messaggi")],
  [/^(\d+) new$/, (m) => count(m[1]!, "nuovo", "nuovi")],
  [/^(\d+) days?$/, (m) => count(m[1]!, "giorno", "giorni")],
  [/^(\d+) items?$/, (m) => count(m[1]!, "elemento", "elementi")],
  [/^(\d+) files?$/, (m) => `${m[1]} file`],
  [/^(\d+) records?$/, (m) => `${m[1]} record`],
  [/^(\d+) records? in the selection\.?$/, (m) => `${m[1]} record nella selezione.`],
  [/^Up to (\d+) MB$/, (m) => `Fino a ${m[1]} MB`],
  [/^Show (\d+) empty fields?$/, (m) => `Mostra ${count(m[1]!, "campo vuoto", "campi vuoti")}`],
  [/^Show archived \((\d+)\)$/, (m) => `Mostra archiviati (${m[1]})`],
  // Time
  [/^just now$/, () => "adesso"],
  [/^(\d+) min ago$/, (m) => `${m[1]} min fa`],
  [/^(\d+) h ago$/, (m) => `${m[1]} h fa`],
  [/^yesterday$/, () => "ieri"],
  [/^Page (\d+) of (\d+)$/, (m) => `Pagina ${m[1]} di ${m[2]}`],
  [/^(\d+) of (\d+)$/, (m) => `${m[1]} di ${m[2]}`],
  [/^Showing (\d+)[–-](\d+) of (\d+)$/, (m) => `Mostrati ${m[1]}–${m[2]} di ${m[3]}`],
  // Calendar day labels: "lun 28 set 2026, 3 orders"
  [/^(.+), (\d+) orders?$/, (m) => `${m[1]}, ${count(m[2]!, "ordine", "ordini")}`],

  // Audit log lines built from the change
  [
    /^Changed primary display field of entity settings (.+)$/,
    (m, tr) => `Modificato il campo principale delle impostazioni di ${tr.keep(m[1]!)}`,
  ],
  [
    /^Changed primary display field of (.+)$/,
    (m, tr) => `Modificato il campo principale di ${tr.keep(m[1]!)}`,
  ],
  [
    /^Changed (.+?)( \+\d+)? of (field option|entity settings|\w+) (.+)$/,
    (m, tr) =>
      `Modificato ${m[1]!.split(", ").map(tr.keep).join(", ")}${m[2] ?? ""} di ${tr(m[3]!)} ${tr.keep(m[4]!)}`,
  ],
  [
    /^Moved (.+) from (.+) to (.+)$/,
    (m, tr) => `Spostato ${tr.keep(m[1]!)} da ${tr.keep(m[2]!)} a ${tr.keep(m[3]!)}`,
  ],
  [
    /^(Assigned|Reassigned) (.+) to (.+)$/,
    (m, tr) =>
      `${m[1] === "Assigned" ? "Assegnati" : "Riassegnati"} ${crew(m[2]!, tr)} a ${tr.keep(m[3]!)}`,
  ],
  [/^Removed (.+) from (.+)$/, (m, tr) => `Rimossi ${crew(m[1]!, tr)} da ${tr.keep(m[2]!)}`],
  [/^Paired (.+) with (.+)$/, (m, tr) => `Abbinato ${tr.keep(m[1]!)} a ${tr.keep(m[2]!)}`],
  [
    /^Ended the pairing of (.+) and (.+)$/,
    (m, tr) => `Terminato l'abbinamento di ${tr.keep(m[1]!)} e ${tr.keep(m[2]!)}`,
  ],
  [/^Changed (.+)$/, (m, tr) => `Modificato ${tr.keep(m[1]!)}`],
  [
    /^Created (field option|entity settings|\w+) (.+)$/,
    (m, tr) => `Creato ${tr(m[1]!)} ${tr.keep(m[2]!)}`,
  ],
  [
    /^Archived (field option|entity settings|\w+) (.+)$/,
    (m, tr) => `Archiviato ${tr(m[1]!)} ${tr.keep(m[2]!)}`,
  ],
  [
    /^Deleted (field option|entity settings|\w+) (.+)$/,
    (m, tr) => `Eliminato ${tr(m[1]!)} ${tr.keep(m[2]!)}`,
  ],
  [
    /^Restored (field option|entity settings|\w+) (.+)$/,
    (m, tr) => `Ripristinato ${tr(m[1]!)} ${tr.keep(m[2]!)}`,
  ],

  // Verbs in front of a known noun: "Search orders…", "Select all customers on this page"
  [/^(.+)…$/, (m, tr) => `${tr(m[1]!)}…`],
  [
    /^Select all (.+) on this page$/,
    (m, tr) => `Seleziona tutti gli elementi della pagina: ${lower(tr(m[1]!))}`,
  ],
  [/^(.+) list$/, (m, tr) => `Elenco ${lower(tr(m[1]!))}`],
  [/^Move (.+) up$/, (m, tr) => `Sposta ${tr.keep(m[1]!)} su`],
  [/^Move (.+) down$/, (m, tr) => `Sposta ${tr.keep(m[1]!)} giù`],
  [/^Rename (.+)$/, (m, tr) => `Rinomina ${tr.keep(m[1]!)}`],
  [/^Disable (.+)$/, (m, tr) => `Disattiva ${tr.keep(m[1]!)}`],
  [/^Archive (.+)$/, (m, tr) => `Archivia ${tr.keep(m[1]!)}`],
  [/^Add (.+)$/, (m, tr) => `Aggiungi ${lower(tr(m[1]!))}`],
  [/^New (.+)$/, (m, tr) => `Nuovo ${lower(tr(m[1]!))}`],
  [/^Edit (.+)$/, (m, tr) => `Modifica ${named(tr, m[1]!)}`],
  [/^Delete (.+)$/, (m, tr) => `Elimina ${named(tr, m[1]!)}`],
  [/^Create (.+)$/, (m, tr) => `Crea ${lower(tr(m[1]!))}`],
  [/^Search (.+)$/, (m, tr) => `Cerca ${lower(tr(m[1]!))}`],
  [/^Select (.+)$/, (m, tr) => `Seleziona ${named(tr, m[1]!)}`],
  [/^Open (.+)$/, (m, tr) => `Apri ${named(tr, m[1]!)}`],
  [/^Remove (.+)$/, (m, tr) => `Rimuovi ${lower(tr(m[1]!))}`],
  [/^(.+) \(required\)$/, (m, tr) => `${tr(m[1]!)} (obbligatorio)`],
  [/^(.+) is required\.?$/, (m, tr) => `${tr(m[1]!)} è obbligatorio.`],
  [/^(.+) accepts (.+)$/, (m, tr) => `${tr(m[1]!)} accetta ${m[2]}`],

  // Pieces joined by punctuation: "customer · Notes", "Confirmed · unassigned", "List, Record page"
  [/^(.+) ·$/, (m, tr) => `${tr(m[1]!)} ·`],
  [/^· (.+)$/, (m, tr) => `· ${tr(m[1]!)}`],
  [/^→ (.+)$/, (m, tr) => `→ ${tr(m[1]!)}`],
  [/^(.+) → (.+)$/, (m, tr) => `${tr(m[1]!)} → ${tr.keep(m[2]!)}`],
  [/^[^\n]+(\n[^\n]+)+$/, (m, tr) => joined(m[0]!, "\n", tr)],
  [/^(.+) · (.+)$/, (m, tr) => joined(m[0]!, " · ", tr)],
  [/^(.+): (.+)$/, (m, tr) => joined(m[0]!, ": ", tr)],
  [/^(.+), (.+)$/, (m, tr) => joined(m[0]!, ", ", tr)],
];

/** "Anna Rossi and AB123CD": the names stay, the "and" becomes "e". */
function crew(text: string, tr: Translator): string {
  return text
    .split(" and ")
    .map((name) => tr.keep(name))
    .join(" e ");
}

/** Translates the parts of "a · b"; at least one has to be known, the others are names. */
function joined(text: string, separator: string, tr: Translator): string {
  let known = 0;
  const parts = text.split(separator).map((part) => {
    try {
      const found = tr(part);
      known++;
      return found;
    } catch {
      return part;
    }
  });
  if (!known) tr("");
  return parts.join(separator);
}
