# TesterSwap Salamandra — TODO

> **Stato al 2026-07-30** (audit Salamandra Loop v2 chiuso).
> Questo file documenta SOLO le cose che l'audit Salamandra ha EVIDENZA GREZZA di aver verificato. Le voci con `[?] Non verificato in questa sessione` sono lo stato del progetto consegnato che non ho aperto/testato io. Per la mappatura dettagliata di cosa è stato implementato/audited, vedere `AUDIT_LEVIATHAN.md`.

## Modulo 1 — Credit Engine core [x] IMPLEMENTATO + AUDITED

Tutti i file toccati hanno `tsc --noEmit EXIT=0` e `vitest run` verde (37 test del Modulo 1).

- [x] Schema DB: tabella `credit_locks` (`drizzle/schema.ts:113-129`, migration `0002_credit_locks.sql`)
- [x] Funzioni pure in `server/business-logic.ts`:
  - [x] `requiredCreditsForTest(testersRequested)` → `n × 5`
  - [x] `canAffordEnrollment(balance, cost)`
  - [x] `isChecklistComplete({installed, opened, minutesUsed, minMinutes, feedbackSubmitted})`
  - [x] `calculateAwardedCredits({installed, durationSeconds, feedbackLength, hasScreenshot, isConfirmedByPublisher})` — capped a 10
  - [x] `isFeedbackValid({text, userHistoryTexts})` — anti-spam + anti-duplicato
  - [x] `calculateTrustScore(events, now, windowDays)` — formula documentata
- [x] Wrapper DB in `server/db.ts`:
  - [x] `createApp({userId, appName, playStoreUrl, ...})`
  - [x] `createTest({userId, targetTesters, ...})` — transazione + lock crediti
  - [x] `createEnrollment({userId, testId})` — transazione + cap check
  - [x] `verifyCompletion({enrollmentId, checklist, hasScreenshot, feedbackText})`
  - [x] `recalculateTrustScore(userId)`
  - [x] `getActiveLockTotal(userId)` / `getSpendableBalance(userId)`
  - [x] `refundLock(lockId)` / `consumeLock(lockId)`
  - [x] `purchaseCreditsStub()` — throws NOT_IMPLEMENTED (predisposizione monetization)
- [x] Mutation tRPC in `server/routers.ts`:
  - [x] `apps.create`
  - [x] `tests.create` (con mapping `InsufficientCreditsError → TRPCError FORBIDDEN`)
  - [x] `tests.refundLock` / `tests.consumeLock`
  - [x] `enrollments.create` / `enrollments.verifyCompletion`
  - [x] `profile.spendableBalance` / `profile.trustScore`
  - [x] `credits.purchase` (stub `TRPCError NOT_IMPLEMENTED`)

### Caveat modulo 1
- Race condition su `createTest` e `createEnrollment` DOCUMENTATA ma NON risolta (richiede `SELECT ... FOR UPDATE` o CHECK constraint, non verificabile senza MySQL reale). Vedi `AUDIT_LEVIATHAN.md` § "Non verificabile senza MySQL".

## Modulo 2 — Penalità e anti-abuso [x] IMPLEMENTATO + AUDITED

- [x] Funzioni pure:
  - [x] `calculateAbandonPenalty({enrolledAt, now, userTotalEnrollments, currentBalance})` con 4 rami (grace 24h, first-enrollment warn-only, full penalty, partial penalty)
- [x] Wrapper DB: `abandonEnrollment({enrollmentId, userId})` — idempotente su `abandoned`, rifiuta `verified`, scrive su ledger 'penalty' + trust_events 'abandoned' quando applica
- [x] Mutation tRPC: `enrollments.abandon` con mapping errori
- [x] 10 nuovi test (47 totali → 47+10 → 57 dopo Modulo 2)

## Modulo 3 — Admin reale [x] IMPLEMENTATO + AUDITED

- [x] Schema DB:
  - [x] enum `users.role` esteso a `["user", "admin", "banned"]` (`drizzle/schema.ts:15`)
  - [x] tabella `adminAuditLog` con FK (8 colonne) (`drizzle/schema.ts:194-211`, migration `0003_admin_actions.sql`)
- [x] Protezione admin lato server: `adminProcedure` in `server/_core/trpc.ts:31-41` — **era preesistente, non toccata**
- [x] Funzioni pure:
  - [x] `isUserBannable({actorUserId, targetUserId, targetRole, targetIsOwner})`
  - [x] `computeRetentionCohorts({events, now, windowsDays?})` → day 1/7/30 retention
  - [x] `dauMauFromEvents({events, now, mauWindowDays?})` → ratio 1 decimal
- [x] Wrapper DB: `banUser`, `resolveReport`, `getAdminStats`
- [x] Mutation tRPC sotto `adminProcedure`:
  - [x] `admin.banUser({targetUserId, reason})`
  - [x] `admin.resolveReport({reportId, action, actionTaken?})`
  - [x] `admin.stats()`

### Caveat modulo 3
- DAU/MAU usa `users.lastSignedIn + enrollments.{completedAt|enrolledAt}` come proxy "user showed up". Per metriche precise serve tabella `analytics_events` (scope futuro). Vedi `AUDIT_LEVIATHAN.md`.
- `getAdminStats` chiama `calculateTrustScore` in loop (N+1 query). Documentato come hot-spot futuro.

## Modulo 4 — Leaderboard corretta [x] IMPLEMENTATO + AUDITED

- [x] Funzione pura: `rankLeaderboard({entries, limit})` — sort `trustScore > completedTests > creditsEarned > lastActivityAt`, limit clamp a 100
- [x] Wrapper DB: `getLeaderboardTop(limit)` — esclude `role='banned'`, conta solo `enrollments.status='verified'`, somma creditsLedger `earned|bonus`, badges per user
- [x] Router tRPC: `leaderboard.top({limit?})` — pubblico
- [x] Bug fix frontend: `client/src/pages/Leaderboard.tsx:11` — `trpc.tests.list.useQuery()` → `trpc.leaderboard.top.useQuery()`

## Modulo 5 — Notifiche [x] IMPLEMENTATO + AUDIT + FIX

- [x] Schema DB: enum `notifications.type` esteso a `+ 'request_received'` (migration `0004_notifications_request_received.sql`)
- [x] Funzione pura: `buildNotificationPayload({type, context?, now?})` con 7 rami (new_tester, request_received, timer_expiring, test_completed, credits_received, badge_earned, system). Include icone lucide-react e link interni
- [x] Wrapper DB: `createNotification`, `triggerNotification`, `listNotificationsForUser`, `markNotificationRead` (idempotente), `countUnreadNotifications`, `sendEmailStub` (NOT_IMPLEMENTED)
- [x] Trigger integration al router boundary (D6 — non nei wrapper DB):
  - [x] `enrollments.create` → triggera `new_tester` al publisher
  - [x] `enrollments.verifyCompletion` → triggera `credits_received` al tester + `test_completed` al publisher
- [x] Router tRPC: `notifications.list({limit?, onlyUnread?})`, `notifications.unreadCount()`, `notifications.markRead({notificationId})`

### Fix post-audit (B1, B4, B6)
- [x] **FIX B1** (critical): aggiunto `resolveEnrollmentContext(enrollmentId)` che fa INNER JOIN `enrollments × tests` per recuperare `{testId, testTitle, publisherId}`. Sostituito il `testId=null` che disabilitava la notifica `test_completed` al publisher.
- [x] **FIX B4** (high): tutti i `.catch(() => undefined)` sostituiti con `.catch((err) => console.error("[notify] ... failed", ctx, err))`. Best-effort guarantee mantenuta, errori ora osservabili.
- [x] **FIX B6** (high): aggiunto campo `creditsSource` ("completion" | "refund" | "bonus" | "other") al context di `buildNotificationPayload`. Il messaggio `credits_received` ora rispecchia la vera fonte.

### Bug noti modulo 5 (NON fixati — vedi AUDIT)
- [?] **B2** (medium): `request_received` è dead type — nessun caller. Schema + payload + icona esistono ma nessuno emette. Da decidere: rimuovere o aggiungere un caller.
- [?] **B3** (low): race su publisher-dopo-test-deleted (silenzioso, benigno)
- [?] **B5** (low): `countUnreadNotifications` non ha isolation contro markRead concorrente (eventualmente consistente)
- [?] **B7** (medium): icon map duplicata in `db.ts` (drift futuro garantito se si aggiungono tipi)
- [?] **B8** (low): `listNotificationsForUser` senza pagination né indice su `(userId, read)` — unbounded growth
- [?] **BH-B** (low): `markNotificationRead` ritorna `success: true` anche quando 0 row affected (no-op su notification di altro utente)
- [?] **BH-C** (low): `ctx.user.name` forwarded al publisher — nessun filtro privacy al boundary
- [?] **BH-E** (low): `createNotification` tronca `title` a 255 ma non `message` (TEXT column senza cap esplicito)

## Modulo 6 — Android wrapper [?] SOSPESO PER DECISIONE

- [x] Decisione Posky: **Capacitor** chosen (requires push notifications, min SDK 21)
- Il template `ANDROID_PLAYSTORE_CONFIG.md` descrive permessi/manifest come se l'APK esistesse ma **non c'è alcuna cartella `android/` né Capacitor/TWA**. Non ho toccato nulla di questo modulo.

### Implementation steps for Capacitor Android wrapper
- [ ] Install Capacitor core and CLI (`pnpm add @capacitor/core @capacitor/cli`).
- [ ] Initialize Capacitor project (`npx cap init testerswap-salamandra com.example.testerswap`).
- [ ] Add Android platform (`npx cap add android`).
- [ ] Set `minSdkVersion` to 21 in `android/app/build.gradle`.
- [ ] Install Push Notifications plugin (`pnpm add @capacitor/push-notifications`).
- [ ] Add Firebase `google-services.json` placeholder and configure Gradle plugin.
- [ ] Implement push notification registration in React code (e.g., in app entry). 
- [ ] Run `npx cap sync android` to apply changes.
- [ ] Build APK (`cd android && ./gradlew assembleRelease`).
- [ ] Verify APK builds and push notification handling.

---

## Stato PREESISTENTE non verificato in questa sessione

Questi punti avevano `[x]` nel `todo.md` originale ma **io non li ho aperti né verificati**. Sono dello stato consegnato del progetto.

### Phase 2 — Brand Identity & Design System [?] Non verificato
- [x] Logo Salamandra / palette / tipografia / animazioni — verificato da fonti esterne (ANALYSIS_REPORT.md), non ispezionato io

### Phase 3 — Schema DB & Backend API
- [x] Schema DB tabelle users/apps/tests/enrollments/creditsLedger/trustEvents/badges/reports/notifications — verificato leggendo `drizzle/schema.ts` ma il loro contenuto è del template, non mio
- [x] API `profile.me` / `profile.credits` / `tests.list` / `tests.get` — verificato leggendo `server/routers.ts:50-93`, del template, non mie
- [x] Le mutation del Modulo 1 sono state aggiunte da me

### Phase 4 — Landing Page & Auth [?] Non verificato
- [x] Landing page / animazioni / Google OAuth — template preesistente
- [ ] Onboarding <60s / Profilo sviluppatore form / Starter +3 crediti — non implementato/verificato

### Phase 5 — Dashboard Road to 12 & Profilo [?] Non verificato
- [x] Dashboard, timer, storico, crediti, app registrate, trust score, profilo — componenti preesistenti (`RoadTo12Progress.tsx`, `StatCard.tsx`); non ho ispezionato il wiring al router tRPC

### Phase 6 — Marketplace & Test Verification [?] Parziale
- [x] Marketplace lista + filtri paese/lingua/tempo — preesistente
- [ ] Filtri categoria/piattaforma/stato — non implementato
- [x] **Enrollment a test**: l'API `enrollments.create` c'è (Modulo 1). **Mancante**: il bottone UI nella pagina Marketplace per chiamarla.
- [ ] Sistema verifica screenshot — non implementato (l'API prende `hasScreenshot: boolean` come flag, non c'è upload)
- [x] **Checklist pre-credito**: implementata in Modulo 1 (`isChecklistComplete`)
- [x] **Penalità dropout**: implementata in Modulo 2 (`calculateAbandonPenalty`, `enrollments.abandon`)
- [ ] Check-in verificato pre-credito — ambiguo, vedi sopra

### Phase 7 — Notifications, Gamification & Admin [?] Parziale
- [x] Notifiche struttura DB — verificato (template)
- [x] **Notifiche in-app trigger**: implementato Modulo 5
- [ ] Notifiche email — `sendEmailStub` predisposto, **non implementato**
- [x] Badge gamification — Modulo 4 conta badges per user nel leaderboard; il sistema di tier Bronze/Silver/Gold/Platinum resta **rimosso per design** (prompt Salamandra v2 + decisione esplicita)
- [x] Leaderboard tester più attivi — Modulo 4 ha la pagina wired al nuovo endpoint
- [x] Admin panel ban/rimozione/stats — Modulo 3 ha le mutation; il wiring UI di `AdminPanel.tsx` alle nuove mutation **non è stato fatto**
- [ ] Banner AdMob — non toccato

### Phase 8 — Testing, Optimization & Delivery [?] Parziale
- [x] Unit tests vitest — 91 test passing (90 business-logic + 1 auth.logout), aggiunti da me
- [ ] Integration tests — non implementato (richiede MySQL reale)
- [ ] Performance optimization / Mobile responsiveness / Accessibility — non verificato
- [ ] Create checkpoint / Generate ZIP / Publish link / Documentation — fuori scope Salamandra

### Phase 9 — Refactoring & Completamento UI [?] Non verificato
- [x] Generazione loghi / Completamento box / Refactoring helpers / Performance / SEO / PWA / Favicon / Responsive / Accessibility — voci preesistenti, non ispezionate

### Phase 10 — Ottimizzazione Android Play Store [?] Non verificato
- [x] AndroidManifest / Privacy / App description / Performance / Security headers / HTTPS / Crash / Analytics / Deep linking — preesistente, non ispezionato. **Nota**: la "manifest" è solo documentazione in `ANDROID_PLAYSTORE_CONFIG.md`, non un progetto Android reale (vedi Modulo 6 sospeso).

---

## Riassunto numerico

| Metrica | Valore | EVIDENZA GREZZA |
|---|---|---|
| File toccati da Salamandra Loop | 9 | drizzle/schema.ts, drizzle/0002+0003+0004.sql, server/business-logic.ts, server/business-logic.test.ts, server/db.ts, server/routers.ts, client/src/pages/Leaderboard.tsx |
| Righe totali aggiunte | ~1900 | somma modifiche Moduli 1-5 |
| Funzioni pure nuove | 15 | business-logic.ts esporta 15 simboli puri |
| Wrapper DB nuovi | 14 | db.ts: da 207 a 1094 righe |
| Router tRPC nuovi endpoint | 19 | routers.ts: da 36 a 357 righe |
| Test vitest | 91 (90 nuovi + 1 preesistente) | `vitest run` finale: 91/91 passato |
| `tsc --noEmit` | EXIT=0 | finale: zero errori su server/drizzle |
| Bug critici/alti risolti | 3 | B1 (dead notification), B4 (silent DB error), B6 (hardcoded message) |
| Bug noti non risolti | 9 | vedi AUDIT_LEVIATHAN.md § "Known issues modulo 5" |
| Migration SQL nuove | 3 | 0002_credit_locks.sql, 0003_admin_actions.sql, 0004_notifications_request_received.sql |
| Tabelle nuove | 2 | credit_locks, admin_audit_log |
| Enum estesi | 2 | users.role (+banned), notifications.type (+request_received) |
| Modulo 6 (Android wrapper) | sospeso | decisione Posky pending |
