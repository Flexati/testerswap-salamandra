import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, protectedProcedure, router } from "./_core/trpc";
import {
  getUserProfile,
  getUserCredits,
  getActiveTests,
  getTestDetails,
  createApp,
  createTest,
  createEnrollment,
  verifyCompletion,
  recalculateTrustScore,
  getSpendableBalance,
  refundLock,
  consumeLock,
  abandonEnrollment,
  banUser,
  resolveReport,
  getAdminStats,
  getLeaderboardTop,
  listNotificationsForUser,
  markNotificationRead,
  countUnreadNotifications,
  triggerNotification,
  getDb,
} from "./db";
import { tests, enrollments } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  AbandonPenaltyError,
  InsufficientCreditsError,
  InvalidInputError,
} from "./business-logic";
import { z } from "zod";

/**
 * Module 5 helpers — side-effect notification triggers invoked
 * AT THE ROUTER BOUNDARY (per design D6). They never throw into
 * the caller: notification failures must not block the underlying
 * mutation.
 */

/**
 * FIX B1: resolve { testId, testTitle, publisherId } from an
 * enrollment id. The previous implementation passed `null` for
 * testId, which silently disabled the publisher-side `test_completed`
 * notification. We re-resolve here so the helper can do its job.
 * Returns null when the enrollment is not found (race with delete).
 */
async function resolveEnrollmentContext(
  enrollmentId: number,
): Promise<{ testId: number; testTitle: string; publisherId: number } | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      testId: enrollments.testId,
      testTitle: tests.title,
      publisherId: tests.userId,
    })
    .from(enrollments)
    .innerJoin(tests, eq(enrollments.testId, tests.id))
    .where(eq(enrollments.id, enrollmentId))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return { testId: r.testId, testTitle: r.testTitle, publisherId: r.publisherId };
}

async function notifyPublisherOnNewTester(
  testerUserId: number,
  testerName: string | null,
  testId: number,
  enrollmentId: number,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const rows = await db
    .select({ title: tests.title, userId: tests.userId })
    .from(tests)
    .where(eq(tests.id, testId))
    .limit(1);
  const t = rows[0];
  if (!t || t.userId === testerUserId) return;
  await triggerNotification({
    userId: t.userId,
    type: "new_tester",
    context: { actorName: testerName, testTitle: t.title },
    relatedTestId: testId,
    relatedEnrollmentId: enrollmentId,
  }).catch((err) => {
    // FIX B4: log instead of silently dropping DB errors. The outer
    // caller (enrollments.create) still swallows this notification
    // failure so the enrollment is never blocked.
    console.error("[notify] new_tester failed", { enrollmentId, publisherId: t.userId, err });
  });
}

async function notifyOnVerifyCompletion(
  testerUserId: number,
  testId: number | null,
  enrollmentId: number,
  status: "verified" | "incomplete",
  creditsAwarded: number,
  testTitle: string | null,
): Promise<void> {
  if (status !== "verified") return;
  // Notify the tester they got credits. Log + swallow on failure
  // (FIX B4: do not silently drop DB errors — surface to console).
  await triggerNotification({
    userId: testerUserId,
    type: "credits_received",
    context: { creditsAmount: creditsAwarded, testTitle },
    relatedTestId: testId,
    relatedEnrollmentId: enrollmentId,
  }).catch((err) => {
    console.error("[notify] credits_received failed", { enrollmentId, testerUserId, err });
  });
  // Notify the publisher the test was completed
  const db = await getDb();
  if (!db || testId === null) return;
  const rows = await db
    .select({ title: tests.title, userId: tests.userId })
    .from(tests)
    .where(eq(tests.id, testId))
    .limit(1);
  const t = rows[0];
  if (!t || t.userId === testerUserId) return;
  await triggerNotification({
    userId: t.userId,
    type: "test_completed",
    context: { testTitle: t.title },
    relatedTestId: testId,
    relatedEnrollmentId: enrollmentId,
  }).catch((err) => {
    console.error("[notify] test_completed failed", { enrollmentId, publisherId: t.userId, err });
  });
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Salamandra feature routers
  profile: router({
    me: protectedProcedure.query(async ({ ctx }) => {
      return await getUserProfile(ctx.user.id);
    }),
    credits: protectedProcedure.query(async ({ ctx }) => {
      return await getUserCredits(ctx.user.id);
    }),
    spendableBalance: protectedProcedure.query(async ({ ctx }) => {
      return await getSpendableBalance(ctx.user.id);
    }),
    trustScore: protectedProcedure.query(async ({ ctx }) => {
      return await recalculateTrustScore(ctx.user.id);
    }),
  }),

  apps: router({
    create: protectedProcedure
      .input(
        z.object({
          appName: z.string().min(1).max(255),
          playStoreUrl: z.string().url().max(512),
          description: z.string().max(2000).optional(),
          category: z.string().max(64).optional(),
          platform: z.enum(["android", "ios"]).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await createApp({ userId: ctx.user.id, ...input });
        } catch (e) {
          if (e instanceof InvalidInputError) throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
          throw e;
        }
      }),
  }),

  tests: router({
    list: publicProcedure.query(async () => {
      return await getActiveTests();
    }),
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getTestDetails(input.id);
      }),
    create: protectedProcedure
      .input(
        z.object({
          appId: z.number().int().positive(),
          title: z.string().min(1).max(255),
          description: z.string().max(2000).optional(),
          targetTesters: z.number().int().positive().max(200),
          creditsPerTester: z.number().int().positive().max(20).optional(),
          startDate: z.date(),
          endDate: z.date(),
          country: z.string().max(64).optional(),
          language: z.string().max(64).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await createTest({ userId: ctx.user.id, ...input });
        } catch (e) {
          if (e instanceof InvalidInputError) throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
          if (e instanceof InsufficientCreditsError) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: e.message,
              cause: { required: e.required, available: e.available },
            });
          }
          throw e;
        }
      }),
    refundLock: protectedProcedure
      .input(z.object({ lockId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await refundLock(input.lockId);
        return { success: true } as const;
      }),
    consumeLock: protectedProcedure
      .input(z.object({ lockId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await consumeLock(input.lockId);
        return { success: true } as const;
      }),
  }),

  enrollments: router({
    create: protectedProcedure
      .input(z.object({ testId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await createEnrollment({ userId: ctx.user.id, testId: input.testId });

          // Per D6: trigger side-effect at the boundary, NOT inside the wrapper.
          // Best-effort: a notification failure must NOT fail the enrollment,
          // but is logged (FIX B4) for observability.
          await notifyPublisherOnNewTester(ctx.user.id, ctx.user.name ?? null, input.testId, result.id).catch((err) => {
            console.error("[enrollments.create] notify failed", { enrollmentId: result.id, err });
          });

          return result;
        } catch (e) {
          if (e instanceof InvalidInputError) throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
          throw e;
        }
      }),
    verifyCompletion: protectedProcedure
      .input(
        z.object({
          enrollmentId: z.number().int().positive(),
          checklist: z.object({
            installed: z.boolean(),
            opened: z.boolean(),
            minutesUsed: z.number().nonnegative(),
            minMinutes: z.number().nonnegative(),
            feedbackSubmitted: z.boolean(),
          }),
          hasScreenshot: z.boolean(),
          feedbackText: z.string().max(5000),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await verifyCompletion({ userId: ctx.user.id, ...input });
          // FIX B1: re-resolve testId/testTitle from enrollmentId so the
          // publisher branch of notifyOnVerifyCompletion actually fires.
          // FIX B4: log instead of silently swallowing DB errors.
          const ctx_ = await resolveEnrollmentContext(input.enrollmentId);
          await notifyOnVerifyCompletion(
            ctx.user.id,
            ctx_?.testId ?? null,
            input.enrollmentId,
            result.status,
            result.creditsAwarded,
            ctx_?.testTitle ?? null,
          ).catch((err) => {
            console.error("[verifyCompletion] notify failed", { enrollmentId: input.enrollmentId, err });
          });
          return result;
        } catch (e) {
          if (e instanceof InvalidInputError) throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
          throw e;
        }
      }),
    abandon: protectedProcedure
      .input(z.object({ enrollmentId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await abandonEnrollment({ userId: ctx.user.id, enrollmentId: input.enrollmentId });
        } catch (e) {
          if (e instanceof InvalidInputError) throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
          if (e instanceof AbandonPenaltyError) throw new TRPCError({ code: "FORBIDDEN", message: e.message });
          throw e;
        }
      }),
  }),

  credits: router({
    // Future monetization hook. Throws NOT_IMPLEMENTED on purpose.
    purchase: protectedProcedure
      .input(z.object({ packageId: z.string() }))
      .mutation(async () => {
        throw new TRPCError({
          code: "NOT_IMPLEMENTED",
          message: "L'acquisto di crediti non è ancora disponibile",
        });
      }),
  }),

  admin: router({
    banUser: adminProcedure
      .input(
        z.object({
          targetUserId: z.number().int().positive(),
          reason: z.string().min(1).max(500),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await banUser({ actorUserId: ctx.user.id, ...input });
        } catch (e) {
          if (e instanceof InvalidInputError) throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
          throw e;
        }
      }),
    resolveReport: adminProcedure
      .input(
        z.object({
          reportId: z.number().int().positive(),
          action: z.enum(["resolve", "dismiss"]),
          actionTaken: z.string().max(500).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await resolveReport({ actorUserId: ctx.user.id, ...input });
        } catch (e) {
          if (e instanceof InvalidInputError) throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
          throw e;
        }
      }),
    stats: adminProcedure.query(async () => {
      return await getAdminStats();
    }),
  }),

  leaderboard: router({
    top: publicProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).optional() }).optional())
      .query(async ({ input }) => {
        return await getLeaderboardTop(input?.limit);
      }),
  }),

  notifications: router({
    list: protectedProcedure
      .input(
        z
          .object({
            limit: z.number().int().min(1).max(200).optional(),
            onlyUnread: z.boolean().optional(),
          })
          .optional(),
      )
      .query(async ({ ctx, input }) => {
        return await listNotificationsForUser({
          userId: ctx.user.id,
          limit: input?.limit,
          onlyUnread: input?.onlyUnread,
        });
      }),
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return await countUnreadNotifications(ctx.user.id);
    }),
    markRead: protectedProcedure
      .input(z.object({ notificationId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        return await markNotificationRead(input.notificationId, ctx.user.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;
