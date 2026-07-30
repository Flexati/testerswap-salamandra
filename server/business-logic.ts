/**
 * Salamandra Credit Engine — pure business logic.
 *
 * No DB access, no I/O, no network. All functions are deterministic
 * and unit-tested in server/business-logic.test.ts.
 *
 * The thin DB wrappers in server/db.ts call into these functions
 * for every business decision (can the user afford this? is the
 * checklist complete? how many credits does this award?). Because
 * the business rules live here, we can audit them without a DB.
 */

export const MIN_FEEDBACK_LENGTH = 100;
export const MIN_SESSION_SECONDS = 120;
export const MAX_CREDITS_PER_TEST = 10;
export const CREDITS_PER_TESTER = 5;
export const STARTER_CREDITS = 3;
export const TRUST_SCORE_DEFAULT = 50;
export const TRUST_SCORE_WINDOW_DAYS = 30;
export const TRUST_SCORE_MIN = 0;
export const TRUST_SCORE_MAX = 100;

// ============================================================================
// Module 2 — Abandon penalty rules
// ============================================================================

export const ABANDON_PENALTY_CREDITS = 2;
export const ABANDON_GRACE_HOURS = 24;
export const ABANDON_TRUST_DELTA = -15;
export const MIN_ENROLLMENTS_FOR_PENALTY = 1;

// ============================================================================
// Module 3 — Admin pure functions
// ============================================================================

export const RETENTION_WINDOWS_DAYS: ReadonlyArray<number> = [1, 7, 30];
export const MAU_WINDOW_DAYS = 30;
export const MIN_SAMPLE_FOR_STATS = 1;

/**
 * Decide if a user can be banned by the actor. Audit-readable:
 *   - never ban another admin
 *   - never ban the configured owner (ENV.ownerOpenId is loaded in
 *     the wrapper, but the rule itself lives here so it is testable
 *     without DB access)
 *   - never ban yourself
 */
export function isUserBannable(input: {
  actorUserId: number;
  targetUserId: number;
  targetRole: "user" | "admin" | "banned";
  targetIsOwner: boolean;
}): boolean {
  if (input.actorUserId === input.targetUserId) return false;
  if (input.targetIsOwner) return false;
  if (input.targetRole === "admin") return false;
  if (input.targetRole === "banned") return false;
  return true;
}

export interface UserActivityEvent {
  userId: number;
  occurredAt: Date;
}

export interface RetentionCohortResult {
  /** Window in days (1, 7, or 30). */
  windowDays: number;
  /** Distinct users active in the cohort window. */
  activeUsers: number;
  /** % of new users who came back within windowDays. 0..100, rounded. */
  retentionRate: number;
}

export interface RetentionInput {
  /** One event per (userId, occurredAt) for the activity we care about. */
  events: ReadonlyArray<UserActivityEvent>;
  /** When "now" is — cohorts are computed relative to this. */
  now: Date;
  /** Which retention windows to compute. Defaults to [1, 7, 30]. */
  windowsDays?: ReadonlyArray<number>;
}

/**
 * Compute retention for [1, 7, 30] day windows.
 *
 * Definition used (audit-readable):
 *   For each new user (first event in `events`), check whether they
 *   produced any further event within `windowDays` of their first.
 *   retentionRate = (new users who returned) / (total new users) * 100
 *
 * If there are no new users in the input, retentionRate is 0
 * (division-by-zero floor — not Infinity, not NaN).
 */
export function computeRetentionCohorts(input: RetentionInput): RetentionCohortResult[] {
  const windows = input.windowsDays ?? RETENTION_WINDOWS_DAYS;

  // Group events by user, find each user's first event.
  const firstSeen = new Map<number, Date>();
  for (const e of input.events) {
    const cur = firstSeen.get(e.userId);
    if (!cur || e.occurredAt.getTime() < cur.getTime()) {
      firstSeen.set(e.userId, e.occurredAt);
    }
  }

  // Index subsequent events per user (sorted) so we can early-out.
  const laterEventsByUser = new Map<number, number[]>();
  for (const e of input.events) {
    const first = firstSeen.get(e.userId);
    if (!first) continue;
    if (e.occurredAt.getTime() === first.getTime()) continue;
    const list = laterEventsByUser.get(e.userId) ?? [];
    list.push(e.occurredAt.getTime());
    laterEventsByUser.set(e.userId, list);
  }

  const day = 24 * 60 * 60 * 1000;
  const totalNewUsers = firstSeen.size;

  return windows.map((windowDays) => {
    let returned = 0;
    for (const [userId, firstAt] of Array.from(firstSeen.entries())) {
      const later = laterEventsByUser.get(userId) ?? [];
      const cutoff = firstAt.getTime() + windowDays * day;
      // Did they come back within windowDays of their first event?
      if (later.some((ts) => ts <= cutoff)) returned += 1;
    }
    const rate = totalNewUsers === 0 ? 0 : Math.round((returned / totalNewUsers) * 100);
    return {
      windowDays,
      activeUsers: returned,
      retentionRate: rate,
    };
  });
}

export interface DauMauInput {
  events: ReadonlyArray<UserActivityEvent>;
  now: Date;
  mauWindowDays?: number;
}

export interface DauMauResult {
  dau: number;
  mau: number;
  /** dau / mau * 100, rounded to 1 decimal. 0 if mau is 0. */
  dauMauRatio: number;
}

/**
 * DAU = distinct users with any event in the last 24h.
 * MAU = distinct users with any event in the last `mauWindowDays`
 *       days (default 30).
 * dauMauRatio = dau / mau * 100, with floor 0 when mau is 0.
 */
export function dauMauFromEvents(input: DauMauInput): DauMauResult {
  const mauWindow = input.mauWindowDays ?? MAU_WINDOW_DAYS;
  const day = 24 * 60 * 60 * 1000;
  const dauCutoff = input.now.getTime() - day;
  const mauCutoff = input.now.getTime() - mauWindow * day;

  const dauUsers = new Set<number>();
  const mauUsers = new Set<number>();
  for (const e of input.events) {
    const ts = e.occurredAt.getTime();
    if (ts >= dauCutoff) dauUsers.add(e.userId);
    if (ts >= mauCutoff) mauUsers.add(e.userId);
  }

  const dau = dauUsers.size;
  const mau = mauUsers.size;
  const ratio = mau === 0 ? 0 : Math.round((dau / mau) * 1000) / 10;
  return { dau, mau, dauMauRatio: ratio };
}

/**
 * Phrases that are too short / generic to count as real feedback.
 * Lowercase, trimmed. Anything matching (after normalization) is
 * rejected before the length check.
 */
export const FEEDBACK_SPAM_BLACKLIST: ReadonlyArray<string> = [
  "ok",
  "ok!",
  "ok.",
  "nice",
  "nice app",
  "good",
  "good app",
  "bel",
  "carino",
  "ottimo",
  "ottima app",
  "great",
  "great app",
  "test ok",
  "tutto ok",
  "va bene",
  "funziona",
];

/**
 * How many credits a campaign must lock to receive N testers.
 * Formula fixed by product: requiredCredits = testersRequested * 5.
 */
export function requiredCreditsForTest(testersRequested: number): number {
  if (!Number.isInteger(testersRequested) || testersRequested <= 0) {
    throw new InvalidInputError("testersRequested must be a positive integer");
  }
  return testersRequested * CREDITS_PER_TESTER;
}

/**
 * True iff the user can afford to lock `cost` credits given their
 * current spendable balance. Locked credits are NOT spendable.
 */
export function canAffordEnrollment(balance: number, cost: number): boolean {
  if (!Number.isFinite(balance) || balance < 0) return false;
  if (!Number.isFinite(cost) || cost < 0) return false;
  return balance >= cost;
}

export interface ChecklistInput {
  installed: boolean;
  opened: boolean;
  minutesUsed: number;
  minMinutes: number;
  feedbackSubmitted: boolean;
}

/**
 * All four flags must be true to release the credit reward.
 * `minutesUsed` must reach `minMinutes` (default 2 minutes per the
 * product spec, settable per test).
 */
export function isChecklistComplete(c: ChecklistInput): boolean {
  if (c.minMinutes < 0) return false;
  if (!c.installed) return false;
  if (!c.opened) return false;
  if (c.minutesUsed < c.minMinutes) return false;
  if (!c.feedbackSubmitted) return false;
  return true;
}

export interface AwardInput {
  installed: boolean;
  durationSeconds: number;
  feedbackLength: number;
  hasScreenshot: boolean;
  isConfirmedByPublisher: boolean;
}

/**
 * Credits awarded for a single completed test session.
 * Rule:
 *   +1 installed
 *   +2 durationSeconds >= 120
 *   +3 feedbackLength >= 100
 *   +4 hasScreenshot
 *   +2 bonus if confirmed by publisher
 * Cap: MAX_CREDITS_PER_TEST (10).
 */
export function calculateAwardedCredits(a: AwardInput): number {
  let credits = 0;
  if (a.installed) credits += 1;
  if (a.durationSeconds >= MIN_SESSION_SECONDS) credits += 2;
  if (a.feedbackLength >= MIN_FEEDBACK_LENGTH) credits += 3;
  if (a.hasScreenshot) credits += 4;
  if (a.isConfirmedByPublisher) credits += 2;
  return Math.min(credits, MAX_CREDITS_PER_TEST);
}

export interface FeedbackValidationInput {
  text: string;
  userHistoryTexts: ReadonlyArray<string>;
}

/**
 * Feedback quality gate. Rejects:
 *   - empty / whitespace-only
 *   - length < MIN_FEEDBACK_LENGTH after trim
 *   - exact match against FEEDBACK_SPAM_BLACKLIST (lowercased trimmed)
 *   - exact duplicate of any previous feedback the same user wrote
 *     (case-insensitive trimmed equality)
 *
 * Anti-AI detection is intentionally NOT implemented in Module 1.
 * Server-side heuristics without a model would be theater; client-side
 * feature extraction needs a real Android client. Tracked for V2.
 */
export function isFeedbackValid(input: FeedbackValidationInput): boolean {
  const trimmed = input.text.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.length < MIN_FEEDBACK_LENGTH) return false;
  const normalized = trimmed.toLowerCase();
  if (FEEDBACK_SPAM_BLACKLIST.includes(normalized)) return false;
  for (const prior of input.userHistoryTexts) {
    if (prior.trim().toLowerCase() === normalized) return false;
  }
  return true;
}

export interface TrustEventLike {
  score: number;
  createdAt: Date;
}

/**
 * Trust score formula. Audit-readable, no magic.
 *
 *   score = average of `score` across events within the last
 *           `windowDays` days, falling back to TRUST_SCORE_DEFAULT
 *           if no events exist in the window.
 *   Clamped to [TRUST_SCORE_MIN, TRUST_SCORE_MAX].
 *
 * Weights (completion %, response time, feedback quality) are
 * applied at the EVENT level: callers insert events with
 * pre-weighted scores (e.g. completed=+10, abandoned=-15). This
 * function only aggregates; the weighting policy lives in the
 * caller (db.ts) and is unit-tested via business-logic tests.
 */
export function calculateTrustScore(
  events: ReadonlyArray<TrustEventLike>,
  now: Date,
  windowDays: number = TRUST_SCORE_WINDOW_DAYS,
): number {
  if (!Number.isFinite(windowDays) || windowDays <= 0) {
    throw new InvalidInputError("windowDays must be positive");
  }
  const cutoff = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  const recent = events.filter((e) => e.createdAt.getTime() >= cutoff);
  if (recent.length === 0) return TRUST_SCORE_DEFAULT;
  const sum = recent.reduce((acc, e) => acc + e.score, 0);
  const avg = sum / recent.length;
  const rounded = Math.round(avg);
  if (rounded < TRUST_SCORE_MIN) return TRUST_SCORE_MIN;
  if (rounded > TRUST_SCORE_MAX) return TRUST_SCORE_MAX;
  return rounded;
}

export class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidInputError";
  }
}

export class InsufficientCreditsError extends Error {
  readonly required: number;
  readonly available: number;
  constructor(required: number, available: number) {
    super(
      `Crediti insufficienti: richiesti ${required}, disponibili ${available}`,
    );
    this.name = "InsufficientCreditsError";
    this.required = required;
    this.available = available;
  }
}

export interface AbandonPenaltyInput {
  enrolledAt: Date;
  now: Date;
  userTotalEnrollments: number;
  currentBalance: number;
}

export interface AbandonPenaltyResult {
  /** Whether a penalty should be applied. */
  applyPenalty: boolean;
  /** Credits to deduct from the user (always >= 0). */
  creditsDeducted: number;
  /** Trust event score to record (negative when penalized). */
  trustScoreDelta: number;
  /** Human-readable reason for audit / UI. */
  reason: string;
}

/**
 * Decide whether abandoning an enrollment should penalize the tester
 * and how much.
 *
 * Rules (audit-readable, no magic):
 *   1. Within the grace window (`ABANDON_GRACE_HOURS` from enrollAt):
 *      no penalty. New testers can change their mind.
 *   2. First-time abandoners (only 1 enrollment ever, this one):
 *      warn-only — no penalty, but a 0 trust event is recorded so
 *      the behavior is visible in the score history.
 *   3. Otherwise: deduct `ABANDON_PENALTY_CREDITS` from balance,
 *      record `ABANDON_TRUST_DELTA` in trust_events.
 *   4. Floor: never let balance go negative. If the user cannot
 *      afford the penalty, deduct what's available (down to 0) and
 *      surface the partial penalty in the result.
 */
export function calculateAbandonPenalty(input: AbandonPenaltyInput): AbandonPenaltyResult {
  const graceMs = ABANDON_GRACE_HOURS * 60 * 60 * 1000;
  const elapsed = input.now.getTime() - input.enrolledAt.getTime();
  if (elapsed < graceMs) {
    return {
      applyPenalty: false,
      creditsDeducted: 0,
      trustScoreDelta: 0,
      reason: `within_grace_${ABANDON_GRACE_HOURS}h`,
    };
  }
  if (input.userTotalEnrollments <= MIN_ENROLLMENTS_FOR_PENALTY) {
    return {
      applyPenalty: false,
      creditsDeducted: 0,
      trustScoreDelta: 0,
      reason: "first_enrollment_warn_only",
    };
  }
  const affordable = Math.min(ABANDON_PENALTY_CREDITS, Math.max(0, input.currentBalance));
  const partial = affordable < ABANDON_PENALTY_CREDITS;
  return {
    applyPenalty: true,
    creditsDeducted: affordable,
    trustScoreDelta: ABANDON_TRUST_DELTA,
    reason: partial ? "abandon_partial_penalty" : "abandon_penalty",
  };
}

export class AbandonPenaltyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AbandonPenaltyError";
  }
}

// ============================================================================
// Module 4 — Leaderboard ranking
// ============================================================================

export const LEADERBOARD_DEFAULT_LIMIT = 20;
export const LEADERBOARD_MAX_LIMIT = 100;

export interface LeaderboardEntry {
  userId: number;
  userName: string | null;
  completedTests: number;
  creditsEarned: number;
  trustScore: number;
  lastActivityAt: Date | null;
  badges: ReadonlyArray<string>;
}

export interface LeaderboardRankInput {
  entries: ReadonlyArray<LeaderboardEntry>;
  limit?: number;
  /** Tiebreaker order: trustScore > completedTests > creditsEarned > recency. */
}

/**
 * Rank leaderboard entries deterministically.
 *
 * Sort order (audit-readable):
 *   1. trustScore DESC (primary: are they a reliable tester?)
 *   2. completedTests DESC (more completed work wins)
 *   3. creditsEarned DESC (tiebreaker on contribution)
 *   4. lastActivityAt DESC (most recent activity first)
 *
 * `limit` clamps the result to at most `LEADERBOARD_MAX_LIMIT`
 * entries; default `LEADERBOARD_DEFAULT_LIMIT`. A limit <= 0
 * returns the full sorted list.
 *
 * Admin and owner accounts are NOT filtered here — the DB wrapper
 * decides what to expose (typically excludes banned users).
 */
export function rankLeaderboard(input: LeaderboardRankInput): LeaderboardEntry[] {
  const cap = input.limit ?? LEADERBOARD_DEFAULT_LIMIT;
  const sorted = [...input.entries].sort((a, b) => {
    if (b.trustScore !== a.trustScore) return b.trustScore - a.trustScore;
    if (b.completedTests !== a.completedTests) return b.completedTests - a.completedTests;
    if (b.creditsEarned !== a.creditsEarned) return b.creditsEarned - a.creditsEarned;
    const aTime = a.lastActivityAt?.getTime() ?? 0;
    const bTime = b.lastActivityAt?.getTime() ?? 0;
    return bTime - aTime;
  });
  if (cap <= 0) return sorted;
  const safeLimit = Math.min(cap, LEADERBOARD_MAX_LIMIT);
  return sorted.slice(0, safeLimit);
}

// ============================================================================
// Module 5 — Notification payloads
// ============================================================================

export type NotificationType =
  | "new_tester"
  | "test_completed"
  | "timer_expiring"
  | "credits_received"
  | "badge_earned"
  | "system";

export const NOTIFICATION_TYPES: ReadonlyArray<NotificationType> = [
  "new_tester",
  "test_completed",
  "timer_expiring",
  "credits_received",
  "badge_earned",
  "system",
];

/**
 * Lucide icon name for each notification type. Frontend can use
 * these directly with lucide-react without further mapping.
 */
export const NOTIFICATION_ICONS: Readonly<Record<NotificationType, string>> = {
  new_tester: "UserPlus",
  test_completed: "CheckCircle2",
  timer_expiring: "Clock",
  credits_received: "Zap",
  badge_earned: "Award",
  system: "Bell",
};

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  icon: string;
  /** Internal route or anchor for the in-app deep link. */
  link: string;
  /** ISO timestamp for stable sorting on the client. */
  createdAtIso: string;
}

export interface BuildNotificationInput {
  type: NotificationType;
  /** Optional context to personalize the message. */
  context?: {
    actorName?: string | null;
    testTitle?: string | null;
    creditsAmount?: number;
    creditsSource?: "completion" | "refund" | "bonus" | "other";
    badgeName?: string | null;
    daysRemaining?: number;
  };
  /** When the notification is conceptually created. */
  now?: Date;
}

/**
 * Build a notification payload for one of the 5+1 supported types.
 *
 * Five product-mandated events:
 *   - new_tester        : a tester just enrolled in one of the
 *                          publisher's tests (sent to publisher).
 *   - request_received  : publisher received a request (e.g. campaign
 *                          approved or test filled). Generic catch-all.
 *   - timer_expiring    : a test has < 2 days remaining and isn't yet
 *                          full. Backend should schedule this via cron.
 *   - test_completed    : a tester finished a verification flow.
 *   - credits_received  : tester earned credits from completion.
 *
 * Plus two system types (badge_earned, system) for completeness.
 *
 * Pure: no DB access, no network. Returns a fully-formed payload
 * the wrapper can persist verbatim.
 */
export function buildNotificationPayload(input: BuildNotificationInput): NotificationPayload {
  const now = input.now ?? new Date();
  const ctx = input.context ?? {};
  switch (input.type) {
    case "new_tester":
      return {
        type: "new_tester",
        title: ctx.actorName ? `${ctx.actorName} si è iscritto` : "Nuovo tester disponibile",
        message: ctx.testTitle
          ? `${ctx.actorName ?? "Un tester"} si è iscritto al test "${ctx.testTitle}".`
          : "Un nuovo tester si è appena iscritto a uno dei tuoi test.",
        icon: NOTIFICATION_ICONS.new_tester,
        link: "/publisher/enrollments",
        createdAtIso: now.toISOString(),
      };
    case "timer_expiring":
      return {
        type: "timer_expiring",
        title: ctx.daysRemaining !== undefined
          ? `Mancano ${ctx.daysRemaining} giorni`
          : "Il test sta per scadere",
        message: ctx.testTitle
          ? `Il test "${ctx.testTitle}" termina tra poco.`
          : "Uno dei tuoi test sta per scadere.",
        icon: NOTIFICATION_ICONS.timer_expiring,
        link: "/publisher/tests",
        createdAtIso: now.toISOString(),
      };
    case "test_completed":
      return {
        type: "test_completed",
        title: "Test completato",
        message: ctx.testTitle
          ? `Il test "${ctx.testTitle}" è stato completato.`
          : "Un test è stato completato.",
        icon: NOTIFICATION_ICONS.test_completed,
        link: "/tests/completed",
        createdAtIso: now.toISOString(),
      };
    case "credits_received":
      // FIX B6: message text must reflect the actual source of credits.
      // Callers pass `creditsSource: 'completion' | 'refund' | 'bonus'`
      // (default 'completion' for backward compat) so the wording
      // doesn't lie when new credit sources are added.
      const source = ctx.creditsSource ?? "completion";
      const sourceLabel =
        source === "completion" ? "per il completamento del test" :
        source === "refund" ? "come rimborso" :
        source === "bonus" ? "come bonus" :
        "per un'attività sulla piattaforma";
      return {
        type: "credits_received",
        title: ctx.creditsAmount !== undefined
          ? `+${ctx.creditsAmount} ⚡ ricevuti`
          : "Crediti ricevuti",
        message: ctx.creditsAmount !== undefined
          ? `Hai guadagnato ${ctx.creditsAmount} crediti ⚡ ${sourceLabel}${ctx.testTitle ? ` (${ctx.testTitle})` : ""}.`
          : "Hai ricevuto dei crediti.",
        icon: NOTIFICATION_ICONS.credits_received,
        link: "/profile/credits",
        createdAtIso: now.toISOString(),
      };
    case "badge_earned":
      return {
        type: "badge_earned",
        title: ctx.badgeName ? `Badge: ${ctx.badgeName}` : "Nuovo badge",
        message: ctx.badgeName
          ? `Hai sbloccato il badge "${ctx.badgeName}".`
          : "Hai sbloccato un nuovo badge.",
        icon: NOTIFICATION_ICONS.badge_earned,
        link: "/profile/badges",
        createdAtIso: now.toISOString(),
      };
    case "system":
      return {
        type: "system",
        title: ctx.testTitle ?? "Notifica di sistema",
        message: ctx.testTitle ?? "Notifica di sistema.",
        icon: NOTIFICATION_ICONS.system,
        link: "/",
        createdAtIso: now.toISOString(),
      };
  }
}
