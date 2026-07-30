import { drizzle } from "drizzle-orm/mysql2";
import { and, desc, eq, gte, sql, ne } from "drizzle-orm";
import { InsertUser, users, apps, tests, enrollments, creditsLedger, trustEvents, creditLocks, adminAuditLog, reports, badges, notifications } from "../drizzle/schema";
import { ENV } from './_core/env';
import {
  requiredCreditsForTest,
  canAffordEnrollment,
  isChecklistComplete,
  calculateAwardedCredits,
  calculateTrustScore,
  calculateAbandonPenalty,
  computeRetentionCohorts,
  dauMauFromEvents,
  isUserBannable,
  rankLeaderboard,
  buildNotificationPayload,
  type LeaderboardEntry,
  type NotificationPayload,
  type NotificationType,
  type BuildNotificationInput,
  LEADERBOARD_DEFAULT_LIMIT,
  LEADERBOARD_MAX_LIMIT,
  AbandonPenaltyError,
  InsufficientCreditsError,
  InvalidInputError,
  MAU_WINDOW_DAYS,
  STARTER_CREDITS,
  TRUST_SCORE_DEFAULT,
} from "./business-logic";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get user with full profile including credits and trust score
 */
export async function getUserProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (user.length === 0) return undefined;

  // Get user's apps
  const userApps = await db.select().from(apps).where(eq(apps.userId, userId));

  // Get active tests
  const activeTests = await db
    .select()
    .from(tests)
    .where(eq(tests.userId, userId));

  // Get enrollments as tester
  const userEnrollments = await db
    .select()
    .from(enrollments)
    .where(eq(enrollments.userId, userId));

  // Calculate trust score
  const userTrustEvents = await db
    .select()
    .from(trustEvents)
    .where(eq(trustEvents.userId, userId));

  const trustScore = userTrustEvents.length > 0
    ? Math.round(userTrustEvents.reduce((sum, e) => sum + e.score, 0) / userTrustEvents.length)
    : 50;

  return {
    ...user[0],
    apps: userApps,
    activeTests,
    enrollments: userEnrollments,
    trustScore,
  };
}

/**
 * Get user credits balance
 */
export async function getUserCredits(userId: number) {
  const db = await getDb();
  if (!db) return 0;

  const ledger = await db
    .select()
    .from(creditsLedger)
    .where(eq(creditsLedger.userId, userId));

  return ledger.reduce((sum, entry) => {
    if (entry.type === 'earned' || entry.type === 'bonus') return sum + entry.amount;
    if (entry.type === 'spent' || entry.type === 'penalty') return sum - entry.amount;
    return sum;
  }, 3); // Start with 3 starter credits
}

/**
 * Get all active tests with filter options
 */
export async function getActiveTests(filters?: {
  category?: string;
  country?: string;
  language?: string;
  platform?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select().from(tests).where(eq(tests.status, 'active'));
  return result;
}

/**
 * Get test details with enrollments
 */
export async function getTestDetails(testId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const test = await db.select().from(tests).where(eq(tests.id, testId)).limit(1);
  if (test.length === 0) return undefined;

  const testEnrollments = await db
    .select()
    .from(enrollments)
    .where(eq(enrollments.testId, testId));

  const app = await db.select().from(apps).where(eq(apps.id, test[0].appId)).limit(1);

  return {
    ...test[0],
    enrollments: testEnrollments,
    app: app[0],
  };
}

// TODO: add feature queries here as your schema grows.

// ============================================================================
// MODULE 1 — Credit Engine mutations (apps, tests, enrollments, credits, locks)
// ============================================================================

export interface CreateAppInput {
  userId: number;
  appName: string;
  playStoreUrl: string;
  description?: string | null;
  category?: string | null;
  platform?: "android" | "ios";
}

export async function createApp(input: CreateAppInput): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!input.appName?.trim()) throw new InvalidInputError("appName required");
  if (!input.playStoreUrl?.trim()) throw new InvalidInputError("playStoreUrl required");
  const result = await db.insert(apps).values({
    userId: input.userId,
    appName: input.appName.trim(),
    playStoreUrl: input.playStoreUrl.trim(),
    description: input.description ?? null,
    category: input.category ?? null,
    platform: input.platform ?? "android",
  });
  const id = (result as unknown as { insertId: number }).insertId;
  return { id: Number(id) };
}

export interface CreateTestInput {
  appId: number;
  userId: number;
  title: string;
  description?: string | null;
  targetTesters: number;
  creditsPerTester?: number;
  startDate: Date;
  endDate: Date;
  country?: string | null;
  language?: string | null;
}

/**
 * Create a test campaign and LOCK the required credits in a single
 * transaction. Throws InsufficientCreditsError if the publisher
 * cannot afford the campaign.
 *
 * Locking is done by inserting an active row into `credit_locks`.
 * Until the lock is `consumed` (test reaches targetTesters) or
 * `refunded` (campaign cancelled/expired), the locked amount is
 * NOT counted in spendable balance.
 *
 * RACE CONDITION WARNING: two concurrent createTest calls from the
 * same user could both read the balance and both pass the check.
 * A real fix needs SELECT ... FOR UPDATE on the user row, or a
 * CHECK constraint at the schema level. NOT VERIFIABLE WITHOUT DB.
 */
export async function createTest(input: CreateTestInput): Promise<{ id: number; lockId: number; creditsLocked: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!input.title?.trim()) throw new InvalidInputError("title required");
  if (input.endDate.getTime() <= input.startDate.getTime()) {
    throw new InvalidInputError("endDate must be after startDate");
  }
  const cost = requiredCreditsForTest(input.targetTesters);
  const balance = await getSpendableBalance(input.userId);
  if (!canAffordEnrollment(balance, cost)) {
    throw new InsufficientCreditsError(cost, balance);
  }

  return db.transaction(async (tx) => {
    const testInsert = await tx.insert(tests).values({
      appId: input.appId,
      userId: input.userId,
      title: input.title.trim(),
      description: input.description ?? null,
      targetTesters: input.targetTesters,
      currentTesters: 0,
      creditsPerTester: input.creditsPerTester ?? 1,
      startDate: input.startDate,
      endDate: input.endDate,
      status: "active",
      country: input.country ?? null,
      language: input.language ?? null,
    });
    const testId = Number((testInsert as unknown as { insertId: number }).insertId);

    const lockInsert = await tx.insert(creditLocks).values({
      userId: input.userId,
      testId,
      amount: cost,
      status: "active",
    });
    const lockId = Number((lockInsert as unknown as { insertId: number }).insertId);

    return { id: testId, lockId, creditsLocked: cost };
  });
}

export interface CreateEnrollmentInput {
  testId: number;
  userId: number;
}

/**
 * Enroll a tester in a test. Free for the tester (testing is
 * rewarded, not paid for). Gates: test exists and is active, has
 * free slots, user not already enrolled.
 *
 * RACE CONDITION WARNING: two testers can pass the cap check at
 * the same time before either INSERT lands. A real fix needs
 * SELECT ... FOR UPDATE on the test row, or a unique constraint
 * on (testId,userId) + a CHECK on currentTesters <= targetTesters.
 * Wrapped in a transaction; correctness NOT VERIFIABLE WITHOUT DB.
 */
export async function createEnrollment(input: CreateEnrollmentInput): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async (tx) => {
    const testRows = await tx
      .select()
      .from(tests)
      .where(and(eq(tests.id, input.testId), eq(tests.status, "active")))
      .limit(1);
    if (testRows.length === 0) throw new InvalidInputError("Test not active");
    const test = testRows[0];
    if (test.currentTesters >= test.targetTesters) {
      throw new InvalidInputError("Test is full");
    }

    const existing = await tx
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.testId, input.testId), eq(enrollments.userId, input.userId)))
      .limit(1);
    if (existing.length > 0) throw new InvalidInputError("Already enrolled");

    const enrollInsert = await tx.insert(enrollments).values({
      testId: input.testId,
      userId: input.userId,
      status: "enrolled",
    });
    const enrollmentId = Number((enrollInsert as unknown as { insertId: number }).insertId);

    await tx
      .update(tests)
      .set({ currentTesters: sql`${tests.currentTesters} + 1` })
      .where(eq(tests.id, input.testId));

    return { id: enrollmentId };
  });
}

export interface VerifyCompletionInput {
  enrollmentId: number;
  userId: number;
  checklist: {
    installed: boolean;
    opened: boolean;
    minutesUsed: number;
    minMinutes: number;
    feedbackSubmitted: boolean;
  };
  hasScreenshot: boolean;
  feedbackText: string;
}

/**
 * Verify a test session and (if the checklist is complete) award
 * credits + write a trust event. Idempotent on already-verified rows.
 *
 * Credits awarded are computed by `calculateAwardedCredits` from
 * the pure business-logic module.
 */
export async function verifyCompletion(input: VerifyCompletionInput): Promise<{
  status: "verified" | "incomplete";
  creditsAwarded: number;
  trustScore: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select()
    .from(enrollments)
    .where(eq(enrollments.id, input.enrollmentId))
    .limit(1);
  if (rows.length === 0) throw new InvalidInputError("Enrollment not found");
  const enrollment = rows[0];
  if (enrollment.userId !== input.userId) throw new InvalidInputError("Not your enrollment");
  if (enrollment.status === "verified") {
    return { status: "verified", creditsAwarded: enrollment.creditsEarned ?? 0, trustScore: await recalculateTrustScore(input.userId) };
  }

  const complete = isChecklistComplete(input.checklist);
  if (!complete) {
    await db
      .update(enrollments)
      .set({ status: "in_progress", feedback: input.feedbackText, updatedAt: new Date() })
      .where(eq(enrollments.id, input.enrollmentId));
    return { status: "incomplete", creditsAwarded: 0, trustScore: await recalculateTrustScore(input.userId) };
  }

  const feedbackLength = input.feedbackText.trim().length;
  const awarded = calculateAwardedCredits({
    installed: input.checklist.installed,
    durationSeconds: Math.round(input.checklist.minutesUsed * 60),
    feedbackLength,
    hasScreenshot: input.hasScreenshot,
    isConfirmedByPublisher: false,
  });

  await db.transaction(async (tx) => {
    await tx
      .update(enrollments)
      .set({
        status: "verified",
        completedAt: new Date(),
        creditsEarned: awarded,
        feedback: input.feedbackText,
        screenshotUrl: null,
        checklist: JSON.stringify(input.checklist),
        updatedAt: new Date(),
      })
      .where(eq(enrollments.id, input.enrollmentId));

    await tx.insert(creditsLedger).values({
      userId: input.userId,
      amount: awarded,
      type: "earned",
      reason: "test_completion",
      enrollmentId: input.enrollmentId,
    });

    await tx.insert(trustEvents).values({
      userId: input.userId,
      eventType: "completed",
      score: 10,
      enrollmentId: input.enrollmentId,
    });
  });

  return { status: "verified", creditsAwarded: awarded, trustScore: await recalculateTrustScore(input.userId) };
}

/**
 * Recompute the trust score for a user from their recent trust events.
 * Delegates the actual math to `calculateTrustScore`.
 */
export async function recalculateTrustScore(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return TRUST_SCORE_DEFAULT;
  const events = await db
    .select()
    .from(trustEvents)
    .where(eq(trustEvents.userId, userId));
  return calculateTrustScore(events, new Date());
}

/**
 * Sum of ACTIVE credit locks for a user. NOT spendable.
 */
export async function getActiveLockTotal(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select()
    .from(creditLocks)
    .where(and(eq(creditLocks.userId, userId), eq(creditLocks.status, "active")));
  return rows.reduce((sum, l) => sum + l.amount, 0);
}

/**
 * Spendable balance: ledger total MINUS active locks.
 * Falls back to STARTER_CREDITS for new users with no ledger entries.
 */
export async function getSpendableBalance(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return STARTER_CREDITS;
  const ledger = await db.select().from(creditsLedger).where(eq(creditsLedger.userId, userId));
  const ledgerSum = ledger.reduce((sum, entry) => {
    if (entry.type === "earned" || entry.type === "bonus") return sum + entry.amount;
    if (entry.type === "spent" || entry.type === "penalty") return sum - entry.amount;
    return sum;
  }, 0);
  const total = ledgerSum === 0 ? STARTER_CREDITS : ledgerSum;
  const locked = await getActiveLockTotal(userId);
  return Math.max(0, total - locked);
}

/**
 * Refund a lock (campaign cancelled or expired). Idempotent.
 */
export async function refundLock(lockId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(creditLocks)
    .set({ status: "refunded", releasedAt: new Date() })
    .where(and(eq(creditLocks.id, lockId), eq(creditLocks.status, "active")));
}

/**
 * Mark a lock as consumed (campaign finished). Idempotent.
 */
export async function consumeLock(lockId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(creditLocks)
    .set({ status: "consumed", releasedAt: new Date() })
    .where(and(eq(creditLocks.id, lockId), eq(creditLocks.status, "active")));
}

/**
 * Stub for future monetization. Throws on purpose so callers can't
 * silently no-op a real-money flow. Replace with a Stripe-backed
 * implementation in a future module without touching the rest of
 * the Credit Engine.
 */
export async function purchaseCreditsStub(): Promise<never> {
  throw new Error("purchaseCredits: NOT IMPLEMENTED — monetization is a future module");
}

// ============================================================================
// MODULE 2 — Abandon penalty (enrollments.abandon)
// ============================================================================

export interface AbandonEnrollmentInput {
  enrollmentId: number;
  userId: number;
}

export interface AbandonEnrollmentResult {
  status: "abandoned";
  penaltyApplied: boolean;
  creditsDeducted: number;
  trustScoreDelta: number;
  reason: string;
  trustScore: number;
}

/**
 * Abandon an enrollment. Idempotent for already-abandoned rows.
 *
 * Decision logic (penalty amount + trust delta + reason) lives in
 * `calculateAbandonPenalty` (pure). This wrapper just gathers the
 * inputs the pure function needs and persists the result.
 *
 * Refuses to abandon an enrollment that is already `verified` —
 * once a tester is paid, they can't undo the credit grant by
 * walking away.
 */
export async function abandonEnrollment(
  input: AbandonEnrollmentInput,
): Promise<AbandonEnrollmentResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select()
    .from(enrollments)
    .where(eq(enrollments.id, input.enrollmentId))
    .limit(1);
  if (rows.length === 0) throw new InvalidInputError("Enrollment not found");
  const enrollment = rows[0];
  if (enrollment.userId !== input.userId) {
    throw new InvalidInputError("Not your enrollment");
  }
  if (enrollment.status === "verified") {
    throw new AbandonPenaltyError("Cannot abandon a verified enrollment");
  }
  if (enrollment.status === "abandoned") {
    // Idempotent re-abandon: return a synthetic no-op result.
    return {
      status: "abandoned",
      penaltyApplied: false,
      creditsDeducted: 0,
      trustScoreDelta: 0,
      reason: "already_abandoned",
      trustScore: await recalculateTrustScore(input.userId),
    };
  }

  // Gather context for the pure decision function.
  const userEnrollments = await db
    .select()
    .from(enrollments)
    .where(eq(enrollments.userId, input.userId));
  const balance = await getSpendableBalance(input.userId);

  const decision = calculateAbandonPenalty({
    enrolledAt: enrollment.enrolledAt,
    now: new Date(),
    userTotalEnrollments: userEnrollments.length,
    currentBalance: balance,
  });

  await db.transaction(async (tx) => {
    await tx
      .update(enrollments)
      .set({ status: "abandoned", updatedAt: new Date() })
      .where(eq(enrollments.id, input.enrollmentId));

    if (decision.applyPenalty && decision.creditsDeducted > 0) {
      await tx.insert(creditsLedger).values({
        userId: input.userId,
        amount: decision.creditsDeducted,
        type: "penalty",
        reason: decision.reason,
        enrollmentId: input.enrollmentId,
      });
    }

    // Always record a trust event so the abandon is visible in the
    // history (even when no credits were deducted — warn-only case).
    await tx.insert(trustEvents).values({
      userId: input.userId,
      eventType: "abandoned",
      score: decision.trustScoreDelta,
      enrollmentId: input.enrollmentId,
    });
  });

  return {
    status: "abandoned",
    penaltyApplied: decision.applyPenalty && decision.creditsDeducted > 0,
    creditsDeducted: decision.creditsDeducted,
    trustScoreDelta: decision.trustScoreDelta,
    reason: decision.reason,
    trustScore: await recalculateTrustScore(input.userId),
  };
}

// ============================================================================
// MODULE 3 — Admin moderation
// ============================================================================

export interface BanUserInput {
  actorUserId: number;
  targetUserId: number;
  reason: string;
}

/**
 * Ban a user. The "can this user be banned?" rule lives in the pure
 * `isUserBannable` function; this wrapper loads target info from DB
 * and persists the ban + an audit log entry in a transaction.
 *
 * The actor must already be authorized as admin by the caller (the
 * adminProcedure in _core/trpc.ts enforces that at the route level).
 */
export async function banUser(input: BanUserInput): Promise<{ targetUserId: number; newRole: "banned" }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!input.reason?.trim()) throw new InvalidInputError("reason required");

  const targetRows = await db.select().from(users).where(eq(users.id, input.targetUserId)).limit(1);
  if (targetRows.length === 0) throw new InvalidInputError("Target user not found");
  const target = targetRows[0];

  const targetIsOwner = ENV.ownerOpenId !== undefined && target.openId === ENV.ownerOpenId;
  const bannable = isUserBannable({
    actorUserId: input.actorUserId,
    targetUserId: target.id,
    targetRole: target.role as "user" | "admin" | "banned",
    targetIsOwner,
  });
  if (!bannable) {
    throw new InvalidInputError("User cannot be banned (self/admin/owner/already banned)");
  }

  await db.transaction(async (tx) => {
    await tx.update(users).set({ role: "banned", updatedAt: new Date() }).where(eq(users.id, input.targetUserId));
    await tx.insert(adminAuditLog).values({
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId,
      action: "ban_user",
      reason: input.reason.trim(),
      metadata: JSON.stringify({ previousRole: target.role }),
    });
  });

  return { targetUserId: input.targetUserId, newRole: "banned" };
}

export interface ResolveReportInput {
  actorUserId: number;
  reportId: number;
  action: "resolve" | "dismiss";
  actionTaken?: string;
}

/**
 * Mark a report as resolved or dismissed. Idempotent on already-closed
 * reports (returns the current state without re-writing the audit log).
 */
export async function resolveReport(input: ResolveReportInput): Promise<{
  reportId: number;
  status: "resolved" | "dismissed";
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db.select().from(reports).where(eq(reports.id, input.reportId)).limit(1);
  if (rows.length === 0) throw new InvalidInputError("Report not found");
  const report = rows[0];
  if (report.status === "resolved" || report.status === "dismissed") {
    return { reportId: input.reportId, status: report.status as "resolved" | "dismissed" };
  }

  const newStatus = input.action === "resolve" ? "resolved" : "dismissed";
  const auditAction = input.action === "resolve" ? "resolve_report" : "dismiss_report";

  await db.transaction(async (tx) => {
    await tx
      .update(reports)
      .set({
        status: newStatus,
        actionTaken: input.actionTaken ?? null,
        updatedAt: new Date(),
      })
      .where(eq(reports.id, input.reportId));
    await tx.insert(adminAuditLog).values({
      actorUserId: input.actorUserId,
      targetReportId: input.reportId,
      targetUserId: report.reportedUserId ?? null,
      action: auditAction,
      reason: input.actionTaken ?? null,
      metadata: JSON.stringify({ previousStatus: report.status }),
    });
  });

  return { reportId: input.reportId, status: newStatus };
}

export interface AdminStats {
  dau: number;
  mau: number;
  dauMauRatio: number;
  totalUsers: number;
  activeTests: number;
  /** Day 1, Day 7, Day 30 retention (%). */
  retention: Array<{ windowDays: number; retentionRate: number; activeUsers: number }>;
}

/**
 * Compute admin stats from real DB queries. The pure math (DAU/MAU
 * ratio, retention cohorts) lives in business-logic.ts and is
 * covered by tests there; this wrapper just feeds in the right
 * events from the DB.
 *
 * Activity events are approximated as the most recent timestamp
 * we have per user (lastSignedIn from users + completedAt from
 * enrollments). This is the simplest "did the user show up"
 * signal without an explicit analytics table.
 */
export async function getAdminStats(): Promise<AdminStats> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();

  const userRows = await db
    .select({ id: users.id, lastSignedIn: users.lastSignedIn })
    .from(users);
  const enrollmentRows = await db
    .select({ userId: enrollments.userId, completedAt: enrollments.completedAt, enrolledAt: enrollments.enrolledAt })
    .from(enrollments);

  type Ev = { userId: number; occurredAt: Date };
  const events: Ev[] = [];
  for (const u of userRows) {
    if (u.lastSignedIn) events.push({ userId: u.id, occurredAt: u.lastSignedIn });
  }
  for (const e of enrollmentRows) {
    if (e.completedAt) events.push({ userId: e.userId, occurredAt: e.completedAt });
    else if (e.enrolledAt) events.push({ userId: e.userId, occurredAt: e.enrolledAt });
  }

  const dauMau = dauMauFromEvents({ events, now, mauWindowDays: MAU_WINDOW_DAYS });
  const retention = computeRetentionCohorts({ events, now });

  const totalUsers = userRows.length;
  const activeTestsRows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(tests)
    .where(eq(tests.status, "active"));
  const activeTests = Number(activeTestsRows[0]?.count ?? 0);

  return {
    dau: dauMau.dau,
    mau: dauMau.mau,
    dauMauRatio: dauMau.dauMauRatio,
    totalUsers,
    activeTests,
    retention,
  };
}

// ============================================================================
// MODULE 4 — Leaderboard top testers
// ============================================================================

/**
 * Top testers ranked by trust score (primary), tests completed,
 * credits earned, and most recent activity. Excludes banned users.
 *
 * Implementation:
 *   1. Load all non-banned users with their lastSignedIn.
 *   2. Count verified enrollments per user (the only status that
 *      counts as "completed" for the leaderboard).
 *   3. Sum credits earned (type='earned' or 'bonus') per user from
 *      credits_ledger.
 *   4. Recompute trust score per user via the pure helper.
 *   5. Collect badge types per user (badgeType strings).
 *   6. Feed the assembled entries into `rankLeaderboard` (pure).
 */
export async function getLeaderboardTop(
  limit: number = LEADERBOARD_DEFAULT_LIMIT,
): Promise<LeaderboardEntry[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const safeLimit = Math.min(Math.max(0, limit), LEADERBOARD_MAX_LIMIT);

  const userRows = await db
    .select({
      id: users.id,
      name: users.name,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .where(ne(users.role, "banned"));

  if (userRows.length === 0) return [];

  const userIds = userRows.map((u) => u.id);

  // Verified enrollments per user
  const completedRows = await db
    .select({
      userId: enrollments.userId,
      count: sql<number>`COUNT(*)`,
    })
    .from(enrollments)
    .where(and(eq(enrollments.status, "verified"), sql`${enrollments.userId} IN (${sql.join(userIds.map((id) => sql`${id}`), sql`, `)})`))
    .groupBy(enrollments.userId);
  const completedByUser = new Map<number, number>(
    completedRows.map((r) => [r.userId, Number(r.count ?? 0)]),
  );

  // Credits earned per user
  const creditsRows = await db
    .select({
      userId: creditsLedger.userId,
      sum: sql<number>`COALESCE(SUM(amount), 0)`,
    })
    .from(creditsLedger)
    .where(sql`${creditsLedger.userId} IN (${sql.join(userIds.map((id) => sql`${id}`), sql`, `)})`)
    .groupBy(creditsLedger.userId);
  const creditsByUser = new Map<number, number>(
    creditsRows.map((r) => [r.userId, Number(r.sum ?? 0)]),
  );

  // Badges per user
  const badgeRows = await db
    .select({
      userId: badges.userId,
      badgeType: badges.badgeType,
    })
    .from(badges);
  const badgesByUser = new Map<number, string[]>();
  for (const b of badgeRows) {
    const list = badgesByUser.get(b.userId) ?? [];
    list.push(b.badgeType);
    badgesByUser.set(b.userId, list);
  }

  // Assemble entries; trust score computed per user via the pure fn.
  const entries: LeaderboardEntry[] = [];
  for (const u of userRows) {
    const trustEventsRows = await db
      .select()
      .from(trustEvents)
      .where(eq(trustEvents.userId, u.id));
    const trustScore = calculateTrustScore(trustEventsRows, new Date());

    entries.push({
      userId: u.id,
      userName: u.name,
      completedTests: completedByUser.get(u.id) ?? 0,
      creditsEarned: creditsByUser.get(u.id) ?? 0,
      trustScore,
      lastActivityAt: u.lastSignedIn,
      badges: badgesByUser.get(u.id) ?? [],
    });
  }

  return rankLeaderboard({ entries, limit: safeLimit });
}

// ============================================================================
// MODULE 5 — Notifications
// ============================================================================

export interface CreateNotificationInput {
  userId: number;
  payload: NotificationPayload;
  relatedTestId?: number | null;
  relatedEnrollmentId?: number | null;
}

/**
 * Persist a notification built by `buildNotificationPayload`.
 * Returns the inserted notification id.
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(notifications).values({
    userId: input.userId,
    type: input.payload.type,
    title: input.payload.title.slice(0, 255),
    message: input.payload.message,
    relatedTestId: input.relatedTestId ?? null,
    relatedEnrollmentId: input.relatedEnrollmentId ?? null,
    read: 0,
  });
  const id = Number((result as unknown as { insertId: number }).insertId);
  return { id };
}

/**
 * Trigger a notification of any type. Thin wrapper that builds the
 * payload via the pure helper and persists it. The router invokes
 * this AFTER the underlying mutation succeeds (per design D6).
 */
export async function triggerNotification(input: {
  userId: number;
  type: NotificationType;
  context?: BuildNotificationInput["context"];
  relatedTestId?: number | null;
  relatedEnrollmentId?: number | null;
}): Promise<{ id: number }> {
  const payload = buildNotificationPayload({
    type: input.type,
    context: input.context,
  });
  return await createNotification({
    userId: input.userId,
    payload,
    relatedTestId: input.relatedTestId,
    relatedEnrollmentId: input.relatedEnrollmentId,
  });
}

export interface ListNotificationsInput {
  userId: number;
  limit?: number;
  onlyUnread?: boolean;
}

/**
 * List notifications for a user, newest first.
 * Defaults: limit=50, all statuses.
 */
export async function listNotificationsForUser(
  input: ListNotificationsInput,
): Promise<NotificationPayload[]> {
  const db = await getDb();
  if (!db) return [];
  const limit = Math.min(Math.max(1, input.limit ?? 50), 200);

  const conditions = [eq(notifications.userId, input.userId)];
  if (input.onlyUnread) conditions.push(eq(notifications.read, 0));

  const rows = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return rows.map((n) => ({
    type: n.type as NotificationType,
    title: n.title,
    message: n.message ?? "",
    icon: NOTIFICATION_ICONS[n.type as NotificationType] ?? "Bell",
    link: defaultLinkForType(n.type as NotificationType),
    createdAtIso: n.createdAt.toISOString(),
  }));
}

/**
 * Idempotent: marking an already-read notification as read is a
 * no-op (returns success without writing).
 */
export async function markNotificationRead(
  notificationId: number,
  userId: number,
): Promise<{ success: true }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(notifications)
    .set({ read: 1 })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId), eq(notifications.read, 0)));
  return { success: true };
}

/**
 * Count unread notifications for a user. Used for the badge on the
 * bell icon in the navbar.
 */
export async function countUnreadNotifications(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, 0)));
  return Number(rows[0]?.count ?? 0);
}

/**
 * Find all active enrollments ending within the next 24 hours
 * and send timer_expiring notifications to the enrolled testers.
 * Idempotent: only creates notification if one doesn't already exist
 * for this enrollment + type within the last 24h.
 * Called by cron job (node-cron).
 */
export async function triggerTimerExpiringNotifications(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Find active enrollments ending within 24h
  const rows = await db
    .select({
      enrollmentId: enrollments.id,
      testId: enrollments.testId,
      userId: enrollments.userId,
      testTitle: tests.title,
      testEndDate: tests.endDate,
    })
    .from(enrollments)
    .innerJoin(tests, eq(enrollments.testId, tests.id))
    .where(
      and(
        sql`${enrollments.status} IN ('enrolled', 'in_progress')`,
        sql`${tests.endDate} > ${now}`,
        sql`${tests.endDate} <= ${windowEnd}`,
      ),
    );

  let sent = 0;
  for (const row of rows) {
    // Check if timer_expiring notification already sent in last 24h for this enrollment
    const existing = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, row.userId),
          eq(notifications.type, "timer_expiring"),
          eq(notifications.relatedEnrollmentId, row.enrollmentId),
          sql`${notifications.createdAt} > ${now}`,
        ),
      )
      .limit(1);

    if (existing.length > 0) continue;

    const hoursLeft = Math.ceil(
      (new Date(row.testEndDate).getTime() - now.getTime()) / (1000 * 60 * 60),
    );
    const daysLeft = Math.max(1, Math.ceil(hoursLeft / 24));

    await triggerNotification({
      userId: row.userId,
      type: "timer_expiring",
      context: { testTitle: row.testTitle, daysRemaining: daysLeft },
      relatedTestId: row.testId,
      relatedEnrollmentId: row.enrollmentId,
    });
    sent++;
  }

  return sent;
}

/**
 * Stub for future email delivery. Throws on purpose so callers can't
 * silently no-op. Replace with a real provider (SendGrid, Postmark,
 * SES) in a future module without touching the notification flow.
 */
export async function sendEmailStub(_input: {
  to: string;
  subject: string;
  body: string;
}): Promise<never> {
  throw new Error("sendEmailStub: NOT IMPLEMENTED — email delivery is a future module");
}

// FIX B7: import the canonical icon map from business-logic instead
// of maintaining a duplicate mirror that would drift over time.
// business-logic.ts does NOT import from db.ts, so there is no cycle.
import { NOTIFICATION_ICONS } from "./business-logic";

function defaultLinkForType(type: NotificationType): string {
  switch (type) {
    case "new_tester":
      return "/publisher/enrollments";
    case "test_completed":
      return "/tests/completed";
    case "timer_expiring":
      return "/publisher/tests";
    case "credits_received":
      return "/profile/credits";
    case "badge_earned":
      return "/profile/badges";
    case "system":
      return "/";
  }
}
