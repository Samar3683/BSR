# Content audit (internal — never published)

Every business claim on the public site, where it comes from and what we may say. Customer-facing
copy may only use claims marked **VERIFIED**, in the wording given under _Site wording_. Update this
file whenever a claim is added, changed or confirmed by BSR.

Last audit: 1 October 2026.

## Sources

| Key          | Source                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------- |
| `LIVE`       | The official site, https://bsrtrasporti.com — home, `/chi-siamo`, `/privacy` (read 2026-10-01) |
| `BRIEF`      | Client brief supplied during the project (contacts, services copy, routes, FAQ, sectors)     |
| `BUILD`      | Verifiable facts about this implementation (code, tests)                                     |

Facts live once, in `src/config/site-content.ts`; this audit is the reason each one is there.

## Statuses

**VERIFIED** — stated by a source above, used as stated. **NEEDS CONFIRMATION** — plausible or
stated somewhere but contradicted, vague or unconfirmed: not published. **UNSUPPORTED** — no
source: not published. **REMOVE** — was on this site and has been taken out.

## Company identity

| Claim                                                                    | Source                  | Status   | Site wording / action                                        |
| ------------------------------------------------------------------------ | ----------------------- | -------- | ------------------------------------------------------------ |
| BSR is an "impresa di autotrasporto merci" based in Carpi (MO)           | LIVE (chi siamo)        | VERIFIED | Identity sentence, about, metadata                           |
| Legal name "B.S.R. di Ashraf Barjees Tahir"                              | LIVE (footer, privacy)  | VERIFIED | Footer legal line, about, privacy, structured data           |
| Brand "BSR Trasporti"                                                    | LIVE (title), BRIEF     | VERIFIED | Titles, eyebrow                                              |
| Ashraf Barjees Tahir is the _titolare_                                   | LIVE (footer, about)    | VERIFIED | "Titolare" (was "Il tuo referente" — an inference, REMOVED)  |
| Ashraf personally follows every shipment                                 | —                       | UNSUPPORTED | Never stated. "Un unico referente" stays unnamed.         |
| Address Viale G. (Giosuè) Carducci 18/C, 41012 Carpi (MO)                | LIVE, BRIEF             | VERIFIED | Short form in contact lists, full form in legal texts         |
| P.IVA 03989650365, REA MO-434008                                         | LIVE, BRIEF             | VERIFIED |                                                              |
| Phone / WhatsApp +39 327 942 7723                                        | LIVE, BRIEF             | VERIFIED |                                                              |
| Email Bsrtrasporti@gmail.com                                             | LIVE, BRIEF             | VERIFIED |                                                              |
| PEC **b.s.r@legalmail.it**                                               | LIVE (3 places)         | VERIFIED | Replaces `bsr@legalmail.it` (from the brief) — confirm with BSR |
| "Oltre 40 autisti" (distribuiti sul territorio)                          | LIVE (4 places)         | VERIFIED | Identity dashboard: "40+ autisti"                            |
| Founding year, years of experience, fleet size, vehicle counts           | — ("anni di esperienza" is vague) | UNSUPPORTED | Not published                       |
| Warehouse / storage                                                      | —                       | UNSUPPORTED | Not published                                             |
| Certifications ("mezzi revisionati e certificati")                       | LIVE (bullet, no detail) | NEEDS CONFIRMATION | Not published                                  |

## Services

| Claim                                                                                     | Source            | Status   | Site wording / action                          |
| ----------------------------------------------------------------------------------------- | ----------------- | -------- | ---------------------------------------------- |
| Express and dedicated transport, all Italy and main European routes                       | LIVE, BRIEF       | VERIFIED |                                                |
| Express: urgent pickups, pickup "anche in giornata" when route/availability/time allow    | LIVE, BRIEF       | VERIFIED | Always with the condition                      |
| Dedicated: vehicle reserved to one shipment, no intermediate stops or transhipment        | LIVE (FAQ), BRIEF | VERIFIED | "senza soste intermedie né trasbordi"          |
| European dedicated transport "pianificati porta a porta"                                  | LIVE              | VERIFIED |                                                |
| One contact person from departure to delivery, no call centre                             | LIVE, BRIEF       | VERIFIED |                                                |
| Pickup time slot agreed at confirmation; contact warns when the vehicle is arriving       | LIVE (FAQ)        | VERIFIED | Process step 03                                |
| Updates by WhatsApp or phone at pickup, during the journey, at delivery                   | LIVE (FAQ)        | VERIFIED | "Aggiornamenti in tempo reale" / "sempre raggiungibile" REMOVED (hyperbole) |
| Online / GPS tracking                                                                     | —                 | UNSUPPORTED | Never claimed                               |
| Vehicle, times and price confirmed before the transport                                   | LIVE              | VERIFIED |                                                |
| Price depends on distance, vehicle type and urgency                                      | LIVE (FAQ), BRIEF | VERIFIED |                                                |
| 24/7 availability, instant quotations                                                    | —                 | UNSUPPORTED | Never claimed                               |

## Timings and response

| Claim                                                                  | Source                        | Status             | Site wording / action |
| ---------------------------------------------------------------------- | ----------------------------- | ------------------ | --------------------- |
| Italy express 24–48 h, "in molti casi anche in giornata"              | LIVE (FAQ), BRIEF             | VERIFIED           | Always "indicativamente"; never a guarantee |
| Europe "in genere da 2 a 5 giorni a seconda della destinazione"        | LIVE (FAQ), BRIEF             | VERIFIED           | "in genere" — Turchia exceeds it (below) |
| Per country: Francia 24–48 h · Spagna 48–72 h · Ungheria 48–72 h · Portogallo 72–96 h · Romania 72–96 h · Grecia 72–96 h · Turchia 5–7 giorni | LIVE (coverage) | VERIFIED | Coverage table, "tempi indicativi" |
| Reply with confirmation and price "entro / in circa 30 minuti"         | LIVE — contradicted by "in poche ore" on the same page; no working hours | NEEDS CONFIRMATION | REMOVED everywhere (hero note, form, quote page, FAQ). Neutral: "Ti ricontattiamo per confermare mezzo, tempi e prezzo." |
| "Tempi certi", "sicurezza garantita", guaranteed delivery              | LIVE (marketing)              | REMOVE             | Hyperbole — never used |

## Coverage

| Claim                                                                     | Source      | Status   | Site wording / action                                |
| ------------------------------------------------------------------------- | ----------- | -------- | ---------------------------------------------------- |
| All Italy, north to south and islands                                     | LIVE, BRIEF | VERIFIED |                                                      |
| Europe: Francia, Spagna, Portogallo, Romania, Ungheria, Grecia, Turchia   | LIVE, BRIEF | VERIFIED | "Turchia" (Italian) replaces "Türkiye"               |
| Operational base in Carpi                                                  | LIVE        | VERIFIED | "Base operativa a Carpi (MO)"; pickups stated as nationwide, so the map's Carpi origin is not read as "every shipment starts in Carpi" |
| Countries in the live form's phone-prefix list (Germania, Austria, …)     | LIVE (form) | UNSUPPORTED as coverage | Phone prefixes only — never listed as routes |

## Fleet

| Claim                                                                                  | Source            | Status   | Site wording / action |
| -------------------------------------------------------------------------------------- | ----------------- | -------- | --------------------- |
| Vans: internal load space about 4 × 2 × 2 m, payload up to about 1,000–1,200 kg      | LIVE (FAQ), BRIEF | VERIFIED | "interni" confirms it is the load space |
| Rigid trucks (motrici)                                                                | LIVE, BRIEF       | VERIFIED | No figures           |
| Large trucks and articulated trucks (bilici) for bulky loads and industrial shipments  | LIVE (FAQ)        | VERIFIED | Articolato use case  |
| Vehicle assigned to what you ship                                                     | LIVE, BRIEF       | VERIFIED |                       |
| Payload / volume of motrici and bilici; number of vehicles                             | —                 | UNSUPPORTED | "Configurazione in base alla spedizione." |

## Protection and insurance

| Claim                                                                                              | Source      | Status   | Site wording / action |
| -------------------------------------------------------------------------------------------------- | ----------- | -------- | --------------------- |
| Load secured with straps and suitable protection                                                    | LIVE (FAQ)  | VERIFIED | Principle 01          |
| Every transport travels with the carrier's insurance; supplementary cover on request (high value)   | LIVE (FAQ), BRIEF | VERIFIED | Principle 04 renamed "Assicurazione" (was "Affidabilità": title and text disagreed) |
| "Copertura assicurativa completa", "sicurezza garantita"                                             | LIVE (marketing) | REMOVE | Contradicted by the precise FAQ wording |

## Sectors, clients, testimonials

| Claim                                                                  | Source | Status | Site wording / action |
| ---------------------------------------------------------------------- | ------ | ------ | --------------------- |
| Sectors: Industria, Retail, E-commerce, Aziende commerciali             | BRIEF  | VERIFIED (as a positioning) | Recognition only — no client names, no counts |
| "Distribuzione" as a separate clients category                          | BRIEF (clients list only) | REMOVE | One sector list for the whole site |
| Client logos on the live site (Transcoop, Transmec Group, One Express, LogiCo, Done! Deliveries, Expedia) | LIVE | NEEDS CONFIRMATION | Not shown. Relationships and the right to show each mark must be confirmed in writing (`permission: true`) |
| Testimonials, ratings, review counts                                    | —      | UNSUPPORTED | None exist; the component renders only approved entries |

## Legal and privacy

| Item                                         | Source      | Status | Notes |
| -------------------------------------------- | ----------- | ------ | ----- |
| Controller: B.S.R. di Ashraf Barjees Tahir   | LIVE (privacy) | VERIFIED | |
| Legal basis art. 6.1.b GDPR                  | LIVE (privacy) | VERIFIED | |
| Retention: as needed for the request; if a contract follows, per tax and contract law | LIVE (privacy) | VERIFIED | |
| Privacy contact: Bsrtrasporti@gmail.com      | LIVE (privacy) | VERIFIED | |
| WhatsApp messages handled by Meta Platforms Ireland Ltd. | LIVE (privacy) | VERIFIED | |
| No cookies, no browser storage, no analytics, self-hosted fonts | BUILD (code search 2026-10-01) | VERIFIED | Re-check whenever analytics, maps, embeds or a form backend are added |
| The request form sends nothing to BSR; the visitor sends the message | BUILD | VERIFIED | Worded "non invia la richiesta" — the fields do travel in the page URL (GET), so hosting logs may record them: stated in the privacy notice |
| Hosting provider (server logs)               | —           | NEEDS CONFIRMATION | Depends on deployment; add to the privacy page then |

## Production readiness

**BLOCKER** — none in code. Before launch: legal review of `/privacy` and the hosting provider
paragraph (deployment-dependent).

**NEEDS BSR CONFIRMATION**
- PEC `b.s.r@legalmail.it` (live site) vs `bsr@legalmail.it` (brief). The site uses the live one.
- Reply time (30 minutes? working hours?) — removed until confirmed.
- "Oltre 40 autisti" is still current.
- Client logos and permissions; any testimonial with the author's consent.
- The four sectors as BSR's positioning.

**FUTURE MEDIA** — real van, rigid truck, articulated truck, driver, loading, cargo, warehouse,
Italian motorway, Carpi base, a consented portrait of the titolare (`src/config/site-media.ts`).

**OPTIONAL** — video loops for services, process, fleet and the final call to action (slots
accept `kind: "video"`).
