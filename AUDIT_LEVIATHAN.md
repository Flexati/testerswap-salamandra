# AUDIT LEVIATHAN — TesterSwap Salamandra Loop v2

> **Data audit:** 2026-07-30
> **Esecutore:** LLM locale (Minimax M3 / Nemotron) su hardware Celeron 4GB
> **Gate:** Leviathan (audit) → Ziz (chiusura)
> **Owner:** Posky

Questo file elenca ogni CLAIM prodotto durante il Salamandra Loop v2 (Moduli 1-5) con relativo LIVELLO ed EVIDENZA GREZZA, più i bug noti emersi dall'audit degli agenti `@forensic-debugger` e `@bug-hunter-omega` sul Modulo 5.

---

## CLAIM PRODOTTI DURANTE IL LOOP

### Modulo 1 — Credit Engine core

| # | CLAIM | LIVELLO | EVIDENZA GREZZA |
|---|---|---|---|
| 1 | Schema DB esteso con tabella `credit_locks` | `drizzle/schema.ts:113-129` + `drizzle/0002_credit_locks.sql:1-13` | tsc EXIT=0; migration SQL scritta nello stesso stile di `0001_calm_thunderbolts.sql` |
| 2 | Logica di business estratta in funzioni pure testabili | `server/business-logic.ts:1-180` | 6 funzioni + 2 classi errore + 9 costanti; zero import da drizzle-orm o db.ts |
| 3 | 37 test vitest superati sulle funzioni pure | `server/business-logic.test.ts:1-368` | `vitest run`: 37/37 passati, EXIT=0 |
| 4 | Wrapper DB con transazioni Drizzle esplicite | `server/db.ts:204-533` | tsc EXIT=0; `createTest`/`createEnrollment`/`verifyCompletion` in `db.transaction` |
| 5 | Mutation tRPC con validazione Zod + error mapping | `server/routers.ts:50-178` | tsc EXIT=0; `InsufficientCreditsError → TRPCError FORBIDDEN`, `InvalidInputError → BAD_REQUEST` |
| 6 | Race conditions esplicitamente documentate | `server/db.ts:243-252` (createTest) + `server/db.ts:333-340` (createEnrollment) | Commento: "NOT VERIFIABLE WITHOUT A REAL DB" |

### Modulo 2 — Penalità e anti-abuso

| # | CLAIM | LIVELLO | EVIDENZA GREZZA |
|---|---|---|---|
| 7 | Regole di abbandono come funzione pura testabile | `server/business-logic.ts:34-39, 213-284` | 4 costanti + `calculateAbandonPenalty` + `AbandonPenaltyError` |
| 8 | 10 test superati su `calculateAbandonPenalty` | `server/business-logic.test.ts:386-469` | `vitest run`: 47/47 passed (37+10) |
| 9 | Wrapper DB `abandonEnrollment` con transazione e idempotenza | `server/db.ts:546-644` | tsc EXIT=0; idempotente su `abandoned`, rifiuta `verified` |
| 10 | Mutation tRPC `enrollments.abandon` con mapping errori | `server/routers.ts:170-183` | tsc EXIT=0; `AbandonPenaltyError → TRPCError FORBIDDEN` |
| 11 | Zero regressioni — 48/48 test sull'intero progetto | tutti i file `*.test.ts` | `vitest run`: 48/48 passed |

### Modulo 3 — Admin reale

| # | CLAIM | LIVELLO | EVIDENZA GREZZA |
|---|---|---|---|
| 12 | Schema DB esteso per admin (enum 'banned' + tabella audit log) | `drizzle/schema.ts:15` + `drizzle/schema.ts:194-211` + `drizzle/0003_admin_actions.sql:1-19` | tsc EXIT=0; ALTER TABLE users MODIFY COLUMN role enum('user','admin','banned') |
| 13 | Protezione admin lato server — già esistente nel template | `server/_core/trpc.ts:31-41` | `adminProcedure` preesistente, NON toccata; check `ctx.user.role === 'admin'` |
| 14 | Logica admin come funzioni pure testate | `server/business-logic.ts:38-180` | 3 costanti + 3 funzioni + 3 interfacce |
| 15 | 18 test superati sulle funzioni pure admin | `server/business-logic.test.ts:486-654` | `vitest run`: 65/65 passed (47+18) |
| 16 | Wrapper DB admin con audit log transazionale | `server/db.ts:652-813` | tsc EXIT=0; `banUser`/`resolveReport` in `db.transaction` con insert su `adminAuditLog` |
| 17 | Mutation tRPC `admin.*` sotto `adminProcedure` con Zod | `server/routers.ts:193-225` | tsc EXIT=0; `admin.banUser`, `admin.resolveReport`, `admin.stats` |
| 18 | Zero regressioni — 66/66 test sull'intero progetto | tutti i file `*.test.ts` | `vitest run`: 66/66 passed |

### Modulo 4 — Leaderboard corretta

| # | CLAIM | LIVELLO | EVIDENZA GREZZA |
|---|---|---|---|
| 19 | Ranking puro con 4 tiebreaker documentati | `server/business-logic.ts:430-483` | 2 costanti + 2 interfacce; sort: `trustScore > completedTests > creditsEarned > lastActivityAt` |
| 20 | 11 test superati su `rankLeaderboard` | `server/business-logic.test.ts:658-770` | `vitest run`: 76/76 passed (65+11) |
| 21 | Wrapper DB che esclude utenti bannati e conta solo `verified` | `server/db.ts:819-920` | tsc EXIT=0; `users WHERE role != 'banned'`, `enrollments WHERE status = 'verified'` |
| 22 | Router `leaderboard.top` pubblico con Zod opzionale | `server/routers.ts:232-237` | tsc EXIT=0; `publicProcedure` |
| 23 | Bug del prompt Salamandra risolto in `Leaderboard.tsx` | `client/src/pages/Leaderboard.tsx:11` | `trpc.tests.list.useQuery()` → `trpc.leaderboard.top.useQuery()` |
| 24 | Zero regressioni — 77/77 test sull'intero progetto | tutti i file `*.test.ts` | `vitest run`: 77/77 passed |

### Modulo 5 — Notifiche

| # | CLAIM | LIVELLO | EVIDENZA GREZZA |
|---|---|---|---|
| 25 | Schema DB esteso per "richiesta ricevuta" | `drizzle/schema.ts:185` + `drizzle/0004_notifications_request_received.sql:1-3` | tsc EXIT=0; enum esteso a 7 valori |
| 26 | Payload notifiche come funzione pura testata | `server/business-logic.ts:512-649` | 7 tipi + 7 icone lucide-react + 6 link interni |
| 27 | 12 test superati su `buildNotificationPayload` | `server/business-logic.test.ts:786-898` | `vitest run`: 88/88 passed (76+12) |
| 28 | Wrapper DB CRUD + trigger helper | `server/db.ts:923-1094` | tsc EXIT=0; 6 funzioni + `sendEmailStub` |
| 29 | Trigger integration al boundary (D6) | `server/routers.ts:38-101` (helpers) + `server/routers.ts:148-159` (enrollments.create) + `server/routers.ts:238-262` (enrollments.verifyCompletion) | 2 helper + 2 punti di aggancio |
| 30 | Router `notifications` con 3 endpoint protetti | `server/routers.ts:325-354` | tsc EXIT=0; `list`, `unreadCount`, `markRead` |
| 31 | Zero regressioni — 89/89 test sull'intero progetto | tutti i file `*.test.ts` | `vitest run`: 89/89 passed |

### Fix post-audit (B1, B4, B6)

| # | CLAIM | LIVELLO | EVIDENZA GREZZA |
|---|---|---|---|
| 32 | FIX B1: publisher notification dead branch risolto | `server/routers.ts:17-35` (resolveEnrollmentContext) + `server/routers.ts:248-262` (verifyCompletion) | tsc EXIT=0; `resolveEnrollmentContext` fa INNER JOIN `enrollments × tests` |
| 33 | FIX B4: silent DB error swallow sostituito con logging | `server/routers.ts:54-70, 78-93, 159, 256` | 4 `.catch((err) => console.error(...))` sostituiti |
| 34 | FIX B6: messaggio credits_received dinamico per source | `server/business-logic.ts:612-630` + `server/business-logic.test.ts:2 nuovi test` | `creditsSource` field; 2 nuovi test passati |
| 35 | Zero regressioni dopo fix — 91/91 test | tutti i file `*.test.ts` | `vitest run`: 91/91 passed |

---

## NON VERIFICABILE SENZA MySQL REALE

1. **Integrazione DB**: insert/update/transazioni reali — `getDb()` ritorna `null` senza `DATABASE_URL` settato. I wrapper passano tsc (static type-check) ma l'esecuzione effettiva non è stata verificata.
2. **Correttezza race condition fix** in `createTest` e `createEnrollment` — transazione scritta, ma correttezza sotto concorrenza richiede test d'integrazione con MySQL.
3. **Migration SQL** (`0002_credit_locks.sql`, `0003_admin_actions.sql`, `0004_notifications_request_received.sql`) — scritte a mano nello stesso stile di `0001_*`. Non eseguite con `drizzle-kit migrate` perché `drizzle.config.ts` richiede `DATABASE_URL`.
4. **Comportamento end-to-end del router tRPC** sotto carico — protetto da Zod a livello sintattico, ma i contratti business (es. "publisher non può creare test su app altrui") sono in scope dei Moduli successivi.
5. **`ALTER TABLE users MODIFY COLUMN role`** per aggiungere `'banned'` — sintassi valida MySQL 5.7+/8.0+, ma non eseguita su DB reale. Su un DB esistente potrebbe richiedere downtime se la colonna è referenziata.
6. **`ALTER TABLE notifications MODIFY COLUMN type`** per aggiungere `'request_received'` — idem.
7. **`getLeaderboardTop` query con `IN (?, ?, ?)` su array di userId** — sintassi Drizzle valida, ma un numero molto grande di userIds (es. 10000+) potrebbe superare il `max_placeholders` packet di MySQL.
8. **`getAdminStats` chiama `calculateTrustScore` in loop (N+1 query)** — inefficiente per DB con migliaia di utenti. Da ottimizzare con 1 query aggregata sui trust_events raggruppati per user.
9. **DAU/MAU da `users.lastSignedIn + enrollments.{completedAt|enrolledAt}`** — proxy. Senza tabella `analytics_events` esplicita, le metriche potrebbero divergere dalla realtà.
10. **`adminProcedure` enforcement** — verificato da code review del file `_core/trpc.ts:31-41`, ma il path completo di un request che tenta `admin.banUser` come non-admin → TRPCError FORBIDDEN non è stato testato end-to-end (richiede sessione auth + mock context).

---

## BUG NOTI (NON RISOLTI) — MODULO 5

Questi bug sono stati trovati dagli agenti `@forensic-debugger` e `@bug-hunter-omega` durante l'audit del Modulo 5. Sono documentati qui per la revisione di Posky prima della chiusura Ziz.

| # | BUG-ID | SEVERITY | LIVELLO | DESCRIZIONE |
|---|---|---|---|---|
| B2 | `request-received-dead-type` | medium | `drizzle/schema.ts:185` + `drizzle/0004_*.sql` + `server/business-logic.ts:589-600` | Schema + payload + icona esistono ma **nessun caller** emette `request_received`. Dead code. |
| B3 | `notify-publisher-after-test-deleted` | low | `server/routers.ts:50-64` | Race: publisher può cancellare il test tra `createEnrollment` e la SELECT del trigger. Silenzioso, benigno. |
| B5 | `read-flag-lost-update-on-race` | low | `server/db.ts:1013-1024` | `countUnreadNotifications` non ha isolation contro `markNotificationRead` concorrente. Eventualmente consistente. |
| B7 | `icon-mirror-divergence-risk` | medium | `server/db.ts:1065-1075` vs `server/business-logic.ts:513-521` | Due mappe icone duplicate a mano. Drift futuro garantito se si aggiungono tipi. |
| B8 | `list-notifications-no-total-count` | low | `server/db.ts:981-998` | `listNotificationsForUser` senza pagination né indice su `(userId, read)`. Unbounded growth. |
| BH-B | `silent-mark-read-cross-user` | low | `server/db.ts:1022-1034` | `markNotificationRead` ritorna `success: true` anche quando 0 row affected (no-op su notification di altro utente). |
| BH-C | `tester-name-leaked-to-publisher` | low | `server/routers.ts:54,159` | `ctx.user.name` forwarded verbatim al publisher. Nessun filtro privacy al boundary. |
| BH-E | `createNotification-no-truncation-on-message` | low | `server/db.ts:929-952` | `title` troncato a 255, `message` no. TEXT column senza cap esplicito. |

### Bug risolti (per riferimento)

| # | Severità | Descrizione | Fix |
|---|---|---|---|
| B1 | critical | Publisher `test_completed` notification dead branch (testId=null) | `resolveEnrollmentContext` + re-resolve testId |
| B4 | high | `.catch(() => undefined)` mangia errori DB | `.catch((err) => console.error(...))` |
| B6 | high | Messaggio `credits_received` hardcoded "per il completamento del test" | `creditsSource` field dinamico |

---

## STATO FINALE DEL PROGETTO

| Metrica | Valore |
|---|---|
| File toccati da Salamandra Loop | 9 |
| Righe totali aggiunte | ~1900 |
| Funzioni pure nuove | 15 |
| Wrapper DB nuovi | 14 |
| Router tRPC nuovi endpoint | 19 |
| Test vitest | 91 (90 nuovi + 1 preesistente) |
| `tsc --noEmit` | EXIT=0 |
| Bug critici/alti risolti | 3 |
| Bug noti non risolti | 9 |
| Migration SQL nuove | 3 |
| Tabelle nuove | 2 |
| Enum estesi | 2 |
| Modulo 6 (Android wrapper) | sospeso |

---

## PRONTO PER REVISIONE POSKY

Questo audit è completo. Tutti i CLAIM hanno EVIDENZA GREZZA verificabile. I bug noti sono documentati con LIVELLO e SEVERITÀ. Il Modulo 6 resta sospeso per decisione esplicita di Posky.

**Prossimo passo:** revisione di Posky → chiusura Ziz.