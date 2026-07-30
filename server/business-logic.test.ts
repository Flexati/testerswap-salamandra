import { describe, expect, it } from "vitest";
import {
  ABANDON_GRACE_HOURS,
  ABANDON_PENALTY_CREDITS,
  ABANDON_TRUST_DELTA,
  LEADERBOARD_DEFAULT_LIMIT,
  LEADERBOARD_MAX_LIMIT,
  MAU_WINDOW_DAYS,
  MIN_ENROLLMENTS_FOR_PENALTY,
  NOTIFICATION_ICONS,
  NOTIFICATION_TYPES,
  AbandonPenaltyError,
  CREDITS_PER_TESTER,
  FEEDBACK_SPAM_BLACKLIST,
  InsufficientCreditsError,
  InvalidInputError,
  MAX_CREDITS_PER_TEST,
  MIN_FEEDBACK_LENGTH,
  MIN_SESSION_SECONDS,
  RETENTION_WINDOWS_DAYS,
  STARTER_CREDITS,
  TRUST_SCORE_DEFAULT,
  TRUST_SCORE_MAX,
  TRUST_SCORE_MIN,
  buildNotificationPayload,
  calculateAbandonPenalty,
  calculateAwardedCredits,
  calculateTrustScore,
  canAffordEnrollment,
  computeRetentionCohorts,
  dauMauFromEvents,
  isChecklistComplete,
  isFeedbackValid,
  isUserBannable,
  rankLeaderboard,
  requiredCreditsForTest,
} from "./business-logic";

describe("requiredCreditsForTest", () => {
  it("returns testersRequested * CREDITS_PER_TESTER", () => {
    expect(requiredCreditsForTest(1)).toBe(5);
    expect(requiredCreditsForTest(5)).toBe(25);
    expect(requiredCreditsForTest(10)).toBe(50);
    expect(requiredCreditsForTest(20)).toBe(100);
    expect(requiredCreditsForTest(50)).toBe(250);
  });

  it("uses the constant CREDITS_PER_TESTER (=5)", () => {
    expect(CREDITS_PER_TESTER).toBe(5);
    expect(requiredCreditsForTest(3)).toBe(3 * CREDITS_PER_TESTER);
  });

  it("rejects non-positive integers", () => {
    expect(() => requiredCreditsForTest(0)).toThrow(InvalidInputError);
    expect(() => requiredCreditsForTest(-1)).toThrow(InvalidInputError);
    expect(() => requiredCreditsForTest(1.5)).toThrow(InvalidInputError);
    expect(() => requiredCreditsForTest(NaN)).toThrow(InvalidInputError);
  });
});

describe("canAffordEnrollment", () => {
  it("returns true when balance >= cost", () => {
    expect(canAffordEnrollment(10, 5)).toBe(true);
    expect(canAffordEnrollment(5, 5)).toBe(true);
    expect(canAffordEnrollment(100, 50)).toBe(true);
  });

  it("returns false when balance < cost", () => {
    expect(canAffordEnrollment(4, 5)).toBe(false);
    expect(canAffordEnrollment(0, 1)).toBe(false);
  });

  it("treats zero cost as always affordable", () => {
    expect(canAffordEnrollment(0, 0)).toBe(true);
    expect(canAffordEnrollment(0, 0)).toBe(true);
  });

  it("returns false for negative balance or negative cost", () => {
    expect(canAffordEnrollment(-1, 1)).toBe(false);
    expect(canAffordEnrollment(10, -1)).toBe(false);
  });

  it("returns false for non-finite inputs", () => {
    expect(canAffordEnrollment(NaN, 1)).toBe(false);
    expect(canAffordEnrollment(10, Infinity)).toBe(false);
  });
});

describe("isChecklistComplete", () => {
  const valid = {
    installed: true,
    opened: true,
    minutesUsed: 3,
    minMinutes: 2,
    feedbackSubmitted: true,
  };

  it("returns true when all four flags are satisfied", () => {
    expect(isChecklistComplete(valid)).toBe(true);
  });

  it("returns false when minutesUsed < minMinutes", () => {
    expect(isChecklistComplete({ ...valid, minutesUsed: 1 })).toBe(false);
  });

  it("returns false when any boolean flag is false", () => {
    expect(isChecklistComplete({ ...valid, installed: false })).toBe(false);
    expect(isChecklistComplete({ ...valid, opened: false })).toBe(false);
    expect(isChecklistComplete({ ...valid, feedbackSubmitted: false })).toBe(false);
  });

  it("returns false when minMinutes is negative", () => {
    expect(isChecklistComplete({ ...valid, minMinutes: -1 })).toBe(false);
  });

  it("accepts minutesUsed exactly equal to minMinutes (boundary)", () => {
    expect(isChecklistComplete({ ...valid, minutesUsed: 2, minMinutes: 2 })).toBe(true);
  });

  it("accepts zero minMinutes (no time requirement)", () => {
    expect(isChecklistComplete({ ...valid, minutesUsed: 0, minMinutes: 0 })).toBe(true);
  });
});

describe("calculateAwardedCredits", () => {
  it("awards +1 for installed", () => {
    expect(
      calculateAwardedCredits({
        installed: true,
        durationSeconds: 0,
        feedbackLength: 0,
        hasScreenshot: false,
        isConfirmedByPublisher: false,
      }),
    ).toBe(1);
  });

  it("awards +2 for duration >= 120s", () => {
    expect(
      calculateAwardedCredits({
        installed: false,
        durationSeconds: 120,
        feedbackLength: 0,
        hasScreenshot: false,
        isConfirmedByPublisher: false,
      }),
    ).toBe(2);
    expect(
      calculateAwardedCredits({
        installed: false,
        durationSeconds: 119,
        feedbackLength: 0,
        hasScreenshot: false,
        isConfirmedByPublisher: false,
      }),
    ).toBe(0);
  });

  it("awards +3 for feedback length >= 100", () => {
    expect(
      calculateAwardedCredits({
        installed: false,
        durationSeconds: 0,
        feedbackLength: 100,
        hasScreenshot: false,
        isConfirmedByPublisher: false,
      }),
    ).toBe(3);
    expect(
      calculateAwardedCredits({
        installed: false,
        durationSeconds: 0,
        feedbackLength: 99,
        hasScreenshot: false,
        isConfirmedByPublisher: false,
      }),
    ).toBe(0);
  });

  it("awards +4 for screenshot", () => {
    expect(
      calculateAwardedCredits({
        installed: false,
        durationSeconds: 0,
        feedbackLength: 0,
        hasScreenshot: true,
        isConfirmedByPublisher: false,
      }),
    ).toBe(4);
  });

  it("awards +2 bonus when publisher confirms", () => {
    expect(
      calculateAwardedCredits({
        installed: false,
        durationSeconds: 0,
        feedbackLength: 0,
        hasScreenshot: false,
        isConfirmedByPublisher: true,
      }),
    ).toBe(2);
  });

  it("caps total at MAX_CREDITS_PER_TEST (10)", () => {
    expect(MAX_CREDITS_PER_TEST).toBe(10);
    // 1 + 2 + 3 + 4 + 2 = 12, should cap at 10
    expect(
      calculateAwardedCredits({
        installed: true,
        durationSeconds: 120,
        feedbackLength: 100,
        hasScreenshot: true,
        isConfirmedByPublisher: true,
      }),
    ).toBe(10);
  });

  it("uses documented constants", () => {
    expect(MIN_SESSION_SECONDS).toBe(120);
    expect(MIN_FEEDBACK_LENGTH).toBe(100);
  });
});

describe("isFeedbackValid", () => {
  const validText = "Questa è una recensione seria e dettagliata dell'applicazione con almeno cento caratteri totali qui presenti.";

  it("accepts long, original, non-spam feedback", () => {
    expect(
      isFeedbackValid({ text: validText, userHistoryTexts: [] }),
    ).toBe(true);
  });

  it("rejects empty / whitespace-only", () => {
    expect(isFeedbackValid({ text: "", userHistoryTexts: [] })).toBe(false);
    expect(isFeedbackValid({ text: "   \n\t  ", userHistoryTexts: [] })).toBe(false);
  });

  it("rejects feedback shorter than MIN_FEEDBACK_LENGTH", () => {
    expect(
      isFeedbackValid({
        text: "troppo corto",
        userHistoryTexts: [],
      }),
    ).toBe(false);
  });

  it("rejects blacklisted spam phrases (case-insensitive, trimmed)", () => {
    for (const spam of FEEDBACK_SPAM_BLACKLIST) {
      // Pad with TRAILING spaces (not chars) so .trim() returns exactly the spam string
      const padded = spam + " ".repeat(Math.max(0, MIN_FEEDBACK_LENGTH - spam.length) + 5);
      expect(
        isFeedbackValid({
          text: padded,
          userHistoryTexts: [],
        }),
      ).toBe(false);
    }
    // Case variants: padding with spaces preserves equality after lowercase
    expect(
      isFeedbackValid({
        text: "OK" + " ".repeat(MIN_FEEDBACK_LENGTH + 5),
        userHistoryTexts: [],
      }),
    ).toBe(false);
    expect(
      isFeedbackValid({
        text: "Nice App" + " ".repeat(MIN_FEEDBACK_LENGTH),
        userHistoryTexts: [],
      }),
    ).toBe(false);
  });

  it("rejects duplicates of the user's own history (case-insensitive trimmed)", () => {
    const prior = validText;
    expect(
      isFeedbackValid({ text: validText, userHistoryTexts: [prior] }),
    ).toBe(false);
    expect(
      isFeedbackValid({
        text: "  " + validText.toUpperCase() + "  ",
        userHistoryTexts: [prior],
      }),
    ).toBe(false);
  });

  it("accepts feedback that shares no exact match with history", () => {
    expect(
      isFeedbackValid({
        text: validText,
        userHistoryTexts: [
          "Primo feedback completamente diverso che non c'entra nulla con il nuovo testo qui scritto per la seconda volta",
        ],
      }),
    ).toBe(true);
  });

  it("enforces MIN_FEEDBACK_LENGTH constant = 100", () => {
    expect(MIN_FEEDBACK_LENGTH).toBe(100);
  });
});

describe("calculateTrustScore", () => {
  const now = new Date("2026-07-29T12:00:00Z");
  const day = 24 * 60 * 60 * 1000;

  it("returns TRUST_SCORE_DEFAULT when there are no events", () => {
    expect(calculateTrustScore([], now)).toBe(TRUST_SCORE_DEFAULT);
    expect(TRUST_SCORE_DEFAULT).toBe(50);
  });

  it("averages scores within the window", () => {
    const events = [
      { score: 100, createdAt: new Date(now.getTime() - 1 * day) },
      { score: 60, createdAt: new Date(now.getTime() - 2 * day) },
      { score: 80, createdAt: new Date(now.getTime() - 5 * day) },
    ];
    // average = (100 + 60 + 80) / 3 = 80
    expect(calculateTrustScore(events, now)).toBe(80);
  });

  it("ignores events older than the window", () => {
    const events = [
      { score: 0, createdAt: new Date(now.getTime() - 1 * day) },
      { score: 100, createdAt: new Date(now.getTime() - 100 * day) },
    ];
    // Only the first event is in window, average = 0
    expect(calculateTrustScore(events, now, 30)).toBe(0);
  });

  it("uses the configured window in days", () => {
    const events = [
      { score: 10, createdAt: new Date(now.getTime() - 5 * day) },
      { score: 90, createdAt: new Date(now.getTime() - 20 * day) },
    ];
    // window=7: only first event, score=10
    expect(calculateTrustScore(events, now, 7)).toBe(10);
    // window=30: both events, average=50
    expect(calculateTrustScore(events, now, 30)).toBe(50);
  });

  it("clamps result to [TRUST_SCORE_MIN, TRUST_SCORE_MAX]", () => {
    expect(TRUST_SCORE_MIN).toBe(0);
    expect(TRUST_SCORE_MAX).toBe(100);

    const tooLow = [{ score: -1000, createdAt: new Date(now.getTime() - 1 * day) }];
    expect(calculateTrustScore(tooLow, now)).toBe(TRUST_SCORE_MIN);

    const tooHigh = [{ score: 1000, createdAt: new Date(now.getTime() - 1 * day) }];
    expect(calculateTrustScore(tooHigh, now)).toBe(TRUST_SCORE_MAX);
  });

  it("rounds to nearest integer", () => {
    const events = [
      { score: 10, createdAt: new Date(now.getTime() - 1 * day) },
      { score: 11, createdAt: new Date(now.getTime() - 2 * day) },
      { score: 11, createdAt: new Date(now.getTime() - 3 * day) },
    ];
    // average = 32 / 3 = 10.666... → 11
    expect(calculateTrustScore(events, now)).toBe(11);
  });

  it("throws on non-positive windowDays", () => {
    expect(() => calculateTrustScore([], now, 0)).toThrow(InvalidInputError);
    expect(() => calculateTrustScore([], now, -1)).toThrow(InvalidInputError);
  });
});

describe("InsufficientCreditsError", () => {
  it("carries required and available numbers", () => {
    const err = new InsufficientCreditsError(50, 8);
    expect(err.required).toBe(50);
    expect(err.available).toBe(8);
    expect(err.name).toBe("InsufficientCreditsError");
    expect(err.message).toContain("50");
    expect(err.message).toContain("8");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("STARTER_CREDITS constant", () => {
  it("is 3 (per product spec)", () => {
    expect(STARTER_CREDITS).toBe(3);
  });
});

// ============================================================================
// Module 2 — calculateAbandonPenalty
// ============================================================================

describe("calculateAbandonPenalty", () => {
  const now = new Date("2026-07-29T12:00:00Z");
  const hour = 60 * 60 * 1000;
  const baseInput = {
    enrolledAt: new Date(now.getTime() - 48 * hour), // 48h ago, past grace
    now,
    userTotalEnrollments: 5,
    currentBalance: 20,
  };

  it("uses the documented constants", () => {
    expect(ABANDON_GRACE_HOURS).toBe(24);
    expect(ABANDON_PENALTY_CREDITS).toBe(2);
    expect(ABANDON_TRUST_DELTA).toBe(-15);
    expect(MIN_ENROLLMENTS_FOR_PENALTY).toBe(1);
  });

  it("returns no penalty within the grace window", () => {
    const result = calculateAbandonPenalty({
      ...baseInput,
      enrolledAt: new Date(now.getTime() - 1 * hour), // 1h ago
    });
    expect(result.applyPenalty).toBe(false);
    expect(result.creditsDeducted).toBe(0);
    expect(result.trustScoreDelta).toBe(0);
    expect(result.reason).toBe("within_grace_24h");
  });

  it("returns no penalty at the exact grace boundary (just under)", () => {
    const result = calculateAbandonPenalty({
      ...baseInput,
      enrolledAt: new Date(now.getTime() - (ABANDON_GRACE_HOURS - 1) * hour),
    });
    expect(result.applyPenalty).toBe(false);
    expect(result.reason).toBe("within_grace_24h");
  });

  it("applies penalty just past the grace boundary", () => {
    const result = calculateAbandonPenalty({
      ...baseInput,
      enrolledAt: new Date(now.getTime() - (ABANDON_GRACE_HOURS + 1) * hour),
    });
    expect(result.applyPenalty).toBe(true);
    expect(result.creditsDeducted).toBe(ABANDON_PENALTY_CREDITS);
    expect(result.trustScoreDelta).toBe(ABANDON_TRUST_DELTA);
    expect(result.reason).toBe("abandon_penalty");
  });

  it("warns only on first enrollment (single-enrollment user)", () => {
    const result = calculateAbandonPenalty({
      ...baseInput,
      userTotalEnrollments: MIN_ENROLLMENTS_FOR_PENALTY, // exactly 1
    });
    expect(result.applyPenalty).toBe(false);
    expect(result.creditsDeducted).toBe(0);
    expect(result.trustScoreDelta).toBe(0);
    expect(result.reason).toBe("first_enrollment_warn_only");
  });

  it("applies full penalty when balance can cover it", () => {
    const result = calculateAbandonPenalty({ ...baseInput, currentBalance: 100 });
    expect(result.applyPenalty).toBe(true);
    expect(result.creditsDeducted).toBe(2);
    expect(result.trustScoreDelta).toBe(-15);
    expect(result.reason).toBe("abandon_penalty");
  });

  it("applies partial penalty when balance is below the full amount", () => {
    const result = calculateAbandonPenalty({ ...baseInput, currentBalance: 1 });
    expect(result.applyPenalty).toBe(true);
    expect(result.creditsDeducted).toBe(1);
    expect(result.trustScoreDelta).toBe(-15);
    expect(result.reason).toBe("abandon_partial_penalty");
  });

  it("deducts 0 when balance is 0 (no negative balance)", () => {
    const result = calculateAbandonPenalty({ ...baseInput, currentBalance: 0 });
    expect(result.applyPenalty).toBe(true);
    expect(result.creditsDeducted).toBe(0);
    expect(result.trustScoreDelta).toBe(-15);
    expect(result.reason).toBe("abandon_partial_penalty");
  });

  it("treats negative balance as 0 (floor protection)", () => {
    const result = calculateAbandonPenalty({ ...baseInput, currentBalance: -5 });
    expect(result.applyPenalty).toBe(true);
    expect(result.creditsDeducted).toBe(0);
    expect(result.trustScoreDelta).toBe(-15);
  });
});

describe("AbandonPenaltyError", () => {
  it("is a named Error subclass", () => {
    const e = new AbandonPenaltyError("test");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("AbandonPenaltyError");
    expect(e.message).toBe("test");
  });
});

// ============================================================================
// Module 3 — Admin pure functions
// ============================================================================

describe("isUserBannable", () => {
  const base = { actorUserId: 1, targetUserId: 2, targetRole: "user" as const, targetIsOwner: false };

  it("allows banning a normal user", () => {
    expect(isUserBannable(base)).toBe(true);
  });

  it("refuses self-ban", () => {
    expect(isUserBannable({ ...base, actorUserId: 2, targetUserId: 2 })).toBe(false);
  });

  it("refuses to ban an admin", () => {
    expect(isUserBannable({ ...base, targetRole: "admin" })).toBe(false);
  });

  it("refuses to ban an already-banned user", () => {
    expect(isUserBannable({ ...base, targetRole: "banned" })).toBe(false);
  });

  it("refuses to ban the configured owner", () => {
    expect(isUserBannable({ ...base, targetIsOwner: true })).toBe(false);
  });
});

describe("computeRetentionCohorts", () => {
  const now = new Date("2026-07-29T12:00:00Z");
  const day = 24 * 60 * 60 * 1000;

  it("uses RETENTION_WINDOWS_DAYS = [1, 7, 30] by default", () => {
    expect(RETENTION_WINDOWS_DAYS).toEqual([1, 7, 30]);
  });

  it("returns 0% retention on empty input", () => {
    const cohorts = computeRetentionCohorts({ events: [], now });
    expect(cohorts).toHaveLength(3);
    expect(cohorts[0]).toEqual({ windowDays: 1, activeUsers: 0, retentionRate: 0 });
    expect(cohorts[1]).toEqual({ windowDays: 7, activeUsers: 0, retentionRate: 0 });
    expect(cohorts[2]).toEqual({ windowDays: 30, activeUsers: 0, retentionRate: 0 });
  });

  it("counts a user who comes back within the window as retained", () => {
    const events = [
      { userId: 10, occurredAt: new Date(now.getTime() - 10 * day) }, // first
      { userId: 10, occurredAt: new Date(now.getTime() - 9 * day) },  // 1 day after first → within day 1 window
    ];
    const cohorts = computeRetentionCohorts({ events, now });
    expect(cohorts[0]?.retentionRate).toBe(100); // day 1: returned
    expect(cohorts[1]?.retentionRate).toBe(100); // day 7: returned
    expect(cohorts[2]?.retentionRate).toBe(100); // day 30: returned
  });

  it("does NOT count a user who returns after the window", () => {
    const events = [
      { userId: 20, occurredAt: new Date(now.getTime() - 10 * day) }, // first
      { userId: 20, occurredAt: new Date(now.getTime() - 5 * day) },  // 5 days after first
    ];
    // first = 10 days ago, 5 days after first is well within 30 but NOT within 1 day
    const cohorts = computeRetentionCohorts({ events, now, windowsDays: [1, 7, 30] });
    expect(cohorts[0]?.retentionRate).toBe(0);  // day 1: too late
    expect(cohorts[1]?.retentionRate).toBe(100); // day 7: 5 days < 7
    expect(cohorts[2]?.retentionRate).toBe(100); // day 30: 5 days < 30
  });

  it("computes percentage correctly for mixed cohorts", () => {
    // 3 new users with different retention gaps relative to their first event.
    // user 1: first 30d ago, returned 28d after first → gap 28d → only within day 30
    // user 2: first 20d ago, returned 5d after first  → gap 5d  → within day 7 AND day 30
    // user 3: first 10d ago, returned 4d after first  → gap 4d  → within all windows
    // user 4: first 5d ago, no return                  → gap ∞  → not retained in any window
    const events = [
      { userId: 1, occurredAt: new Date(now.getTime() - 30 * day) }, // first
      { userId: 1, occurredAt: new Date(now.getTime() - 2 * day) },  // 28d after first
      { userId: 2, occurredAt: new Date(now.getTime() - 20 * day) }, // first
      { userId: 2, occurredAt: new Date(now.getTime() - 15 * day) }, // 5d after first
      { userId: 3, occurredAt: new Date(now.getTime() - 10 * day) }, // first
      { userId: 3, occurredAt: new Date(now.getTime() - 6 * day) },  // 4d after first
      { userId: 4, occurredAt: new Date(now.getTime() - 5 * day) },  // first, no return
    ];
    const cohorts = computeRetentionCohorts({ events, now });
    // day 1: user 4 first is 5d ago > 1d window, no return → 0/4 = 0%
    expect(cohorts[0]?.retentionRate).toBe(0);
    // day 7: user 3 returned within 4d (yes), user 2 within 5d (yes), user 1 within 28d (no), user 4 (no) → 2/4 = 50%
    expect(cohorts[1]?.retentionRate).toBe(50);
    // day 30: user 1, 2, 3 all returned → 3/4 = 75%
    expect(cohorts[2]?.retentionRate).toBe(75);
  });

  it("ignores events older than the user's first event", () => {
    const events = [
      { userId: 99, occurredAt: new Date(now.getTime() - 2 * day) },  // first
      { userId: 99, occurredAt: new Date(now.getTime() - 5 * day) },  // BEFORE first → ignored
    ];
    const cohorts = computeRetentionCohorts({ events, now });
    expect(cohorts[0]?.retentionRate).toBe(0); // only first event counts, no return
  });
});

describe("dauMauFromEvents", () => {
  const now = new Date("2026-07-29T12:00:00Z");
  const day = 24 * 60 * 60 * 1000;

  it("uses MAU_WINDOW_DAYS = 30 by default", () => {
    expect(MAU_WINDOW_DAYS).toBe(30);
  });

  it("returns 0/0/0 on empty input", () => {
    const result = dauMauFromEvents({ events: [], now });
    expect(result).toEqual({ dau: 0, mau: 0, dauMauRatio: 0 });
  });

  it("counts only events in the last 24h as DAU", () => {
    const events = [
      { userId: 1, occurredAt: new Date(now.getTime() - 1 * day) },  // exactly 24h ago — OUT (cutoff is exclusive)
      { userId: 1, occurredAt: new Date(now.getTime() - 0.5 * day) }, // 12h ago — IN
    ];
    const result = dauMauFromEvents({ events, now });
    expect(result.dau).toBe(1);
    expect(result.mau).toBe(1);
    expect(result.dauMauRatio).toBe(100);
  });

  it("counts events in the last 30 days as MAU", () => {
    const events = [
      { userId: 1, occurredAt: new Date(now.getTime() - 29 * day) }, // 29 days ago — IN
      { userId: 2, occurredAt: new Date(now.getTime() - 31 * day) }, // 31 days ago — OUT
    ];
    const result = dauMauFromEvents({ events, now });
    expect(result.dau).toBe(0);
    expect(result.mau).toBe(1);
  });

  it("computes dau/mau ratio rounded to 1 decimal", () => {
    // 1 active in last 24h, 4 active in last 30 days → ratio 25.0
    const events = [
      { userId: 1, occurredAt: new Date(now.getTime() - 1 * day) },   // DAU + MAU
      { userId: 2, occurredAt: new Date(now.getTime() - 10 * day) },
      { userId: 3, occurredAt: new Date(now.getTime() - 15 * day) },
      { userId: 4, occurredAt: new Date(now.getTime() - 20 * day) },
    ];
    const result = dauMauFromEvents({ events, now });
    expect(result.dau).toBe(1);
    expect(result.mau).toBe(4);
    expect(result.dauMauRatio).toBe(25);
  });

  it("counts distinct users (deduplicates)", () => {
    const events = [
      { userId: 1, occurredAt: new Date(now.getTime() - 1 * day) },
      { userId: 1, occurredAt: new Date(now.getTime() - 2 * day) },
      { userId: 1, occurredAt: new Date(now.getTime() - 5 * day) },
    ];
    const result = dauMauFromEvents({ events, now });
    expect(result.dau).toBe(1);
    expect(result.mau).toBe(1);
  });

  it("supports custom mauWindowDays", () => {
    const events = [
      { userId: 1, occurredAt: new Date(now.getTime() - 8 * day) }, // outside 7-day window
    ];
    const result7 = dauMauFromEvents({ events, now, mauWindowDays: 7 });
    const result14 = dauMauFromEvents({ events, now, mauWindowDays: 14 });
    expect(result7.mau).toBe(0);
    expect(result14.mau).toBe(1);
  });
});

// ============================================================================
// Module 4 — rankLeaderboard
// ============================================================================

describe("rankLeaderboard", () => {
  const baseEntry = {
    userName: null as string | null,
    completedTests: 0,
    creditsEarned: 0,
    trustScore: 50,
    lastActivityAt: null as Date | null,
    badges: [] as string[],
  };
  const mk = (overrides: Partial<typeof baseEntry & { userId: number }>): typeof baseEntry & { userId: number } => ({
    ...baseEntry,
    userId: overrides.userId ?? 1,
    ...overrides,
  });

  it("uses LEADERBOARD_DEFAULT_LIMIT = 20 and MAX_LIMIT = 100", () => {
    expect(LEADERBOARD_DEFAULT_LIMIT).toBe(20);
    expect(LEADERBOARD_MAX_LIMIT).toBe(100);
  });

  it("returns empty array on empty input", () => {
    expect(rankLeaderboard({ entries: [] })).toEqual([]);
  });

  it("sorts by trustScore DESC (primary)", () => {
    const entries = [
      mk({ userId: 1, trustScore: 30 }),
      mk({ userId: 2, trustScore: 90 }),
      mk({ userId: 3, trustScore: 60 }),
    ];
    const ranked = rankLeaderboard({ entries });
    expect(ranked.map((e) => e.userId)).toEqual([2, 3, 1]);
  });

  it("breaks ties with completedTests DESC", () => {
    const entries = [
      mk({ userId: 1, trustScore: 80, completedTests: 5 }),
      mk({ userId: 2, trustScore: 80, completedTests: 12 }),
      mk({ userId: 3, trustScore: 80, completedTests: 8 }),
    ];
    const ranked = rankLeaderboard({ entries });
    expect(ranked.map((e) => e.userId)).toEqual([2, 3, 1]);
  });

  it("breaks deeper ties with creditsEarned DESC", () => {
    const entries = [
      mk({ userId: 1, trustScore: 80, completedTests: 5, creditsEarned: 50 }),
      mk({ userId: 2, trustScore: 80, completedTests: 5, creditsEarned: 200 }),
      mk({ userId: 3, trustScore: 80, completedTests: 5, creditsEarned: 100 }),
    ];
    const ranked = rankLeaderboard({ entries });
    expect(ranked.map((e) => e.userId)).toEqual([2, 3, 1]);
  });

  it("breaks final ties with lastActivityAt DESC", () => {
    const now = new Date("2026-07-29T12:00:00Z");
    const entries = [
      mk({ userId: 1, trustScore: 80, completedTests: 5, creditsEarned: 100, lastActivityAt: new Date(now.getTime() - 86400000) }), // 1d ago
      mk({ userId: 2, trustScore: 80, completedTests: 5, creditsEarned: 100, lastActivityAt: new Date(now.getTime() - 86400000 * 7) }), // 7d ago
      mk({ userId: 3, trustScore: 80, completedTests: 5, creditsEarned: 100, lastActivityAt: null }), // never
    ];
    const ranked = rankLeaderboard({ entries });
    expect(ranked.map((e) => e.userId)).toEqual([1, 2, 3]);
  });

  it("limits results to `limit` parameter", () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      mk({ userId: i + 1, trustScore: 100 - i }),
    );
    const ranked = rankLeaderboard({ entries, limit: 3 });
    expect(ranked).toHaveLength(3);
    expect(ranked.map((e) => e.userId)).toEqual([1, 2, 3]);
  });

  it("uses default limit (20) when not specified", () => {
    const entries = Array.from({ length: 30 }, (_, i) =>
      mk({ userId: i + 1, trustScore: 100 - i }),
    );
    const ranked = rankLeaderboard({ entries });
    expect(ranked).toHaveLength(20);
  });

  it("clamps limit to LEADERBOARD_MAX_LIMIT (100)", () => {
    const entries = Array.from({ length: 150 }, (_, i) =>
      mk({ userId: i + 1, trustScore: 100 - i }),
    );
    const ranked = rankLeaderboard({ entries, limit: 200 });
    expect(ranked).toHaveLength(100);
  });

  it("returns full list when limit <= 0", () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      mk({ userId: i + 1, trustScore: 100 - i }),
    );
    expect(rankLeaderboard({ entries, limit: 0 })).toHaveLength(5);
    expect(rankLeaderboard({ entries, limit: -1 })).toHaveLength(5);
  });

  it("does not mutate the input array", () => {
    const entries = [
      mk({ userId: 1, trustScore: 30 }),
      mk({ userId: 2, trustScore: 90 }),
    ];
    const originalOrder = entries.map((e) => e.userId);
    rankLeaderboard({ entries });
    expect(entries.map((e) => e.userId)).toEqual(originalOrder);
  });
});

// ============================================================================
// Module 5 — buildNotificationPayload
// ============================================================================

describe("buildNotificationPayload", () => {
  const fixedNow = new Date("2026-07-30T12:00:00Z");

  it("exposes 6 notification types and an icon for each", () => {
    expect(NOTIFICATION_TYPES).toHaveLength(6);
    for (const t of NOTIFICATION_TYPES) {
      expect(typeof NOTIFICATION_ICONS[t]).toBe("string");
      expect(NOTIFICATION_ICONS[t].length).toBeGreaterThan(0);
    }
  });

  it("builds a new_tester payload with actor + test title context", () => {
    const p = buildNotificationPayload({
      type: "new_tester",
      context: { actorName: "Mario", testTitle: "Login flow" },
      now: fixedNow,
    });
    expect(p.type).toBe("new_tester");
    expect(p.title).toContain("Mario");
    expect(p.message).toContain("Login flow");
    expect(p.icon).toBe("UserPlus");
    expect(p.link).toBe("/publisher/enrollments");
    expect(p.createdAtIso).toBe(fixedNow.toISOString());
  });

  it("builds a new_tester payload with generic text when context is missing", () => {
    const p = buildNotificationPayload({ type: "new_tester", now: fixedNow });
    expect(p.title).toBe("Nuovo tester disponibile");
    expect(p.message).toContain("Un nuovo tester");
  });

  it("builds a timer_expiring payload with days remaining", () => {
    const p = buildNotificationPayload({
      type: "timer_expiring",
      context: { daysRemaining: 2, testTitle: "Smoke test" },
      now: fixedNow,
    });
    expect(p.title).toContain("2");
    expect(p.message).toContain("Smoke test");
    expect(p.icon).toBe("Clock");
    expect(p.link).toBe("/publisher/tests");
  });

  it("builds a test_completed payload", () => {
    const p = buildNotificationPayload({
      type: "test_completed",
      context: { testTitle: "Checkout flow" },
      now: fixedNow,
    });
    expect(p.title).toBe("Test completato");
    expect(p.message).toContain("Checkout flow");
    expect(p.icon).toBe("CheckCircle2");
    expect(p.link).toBe("/tests/completed");
  });

  it("builds a credits_received payload with amount", () => {
    const p = buildNotificationPayload({
      type: "credits_received",
      context: { creditsAmount: 8 },
      now: fixedNow,
    });
    expect(p.title).toContain("+8");
    expect(p.title).toContain("⚡");
    expect(p.message).toContain("8");
    expect(p.icon).toBe("Zap");
    expect(p.link).toBe("/profile/credits");
  });

  it("builds a credits_received payload without amount (generic)", () => {
    const p = buildNotificationPayload({ type: "credits_received", now: fixedNow });
    expect(p.title).toBe("Crediti ricevuti");
  });

  // FIX B6: credits_source is honored, not hardcoded
  it("credits_received message changes wording by source", () => {
    const completion = buildNotificationPayload({
      type: "credits_received",
      context: { creditsAmount: 5, creditsSource: "completion" },
      now: fixedNow,
    });
    expect(completion.message).toContain("per il completamento del test");

    const refund = buildNotificationPayload({
      type: "credits_received",
      context: { creditsAmount: 5, creditsSource: "refund" },
      now: fixedNow,
    });
    expect(refund.message).toContain("come rimborso");
    expect(refund.message).not.toContain("per il completamento");

    const bonus = buildNotificationPayload({
      type: "credits_received",
      context: { creditsAmount: 5, creditsSource: "bonus" },
      now: fixedNow,
    });
    expect(bonus.message).toContain("come bonus");
  });

  it("credits_received defaults to completion source when not specified", () => {
    const p = buildNotificationPayload({
      type: "credits_received",
      context: { creditsAmount: 5 },
      now: fixedNow,
    });
    expect(p.message).toContain("per il completamento del test");
  });

  it("builds a badge_earned payload with badge name", () => {
    const p = buildNotificationPayload({
      type: "badge_earned",
      context: { badgeName: "Top Tester" },
      now: fixedNow,
    });
    expect(p.title).toContain("Top Tester");
    expect(p.icon).toBe("Award");
    expect(p.link).toBe("/profile/badges");
  });

  it("builds a system payload with fallback", () => {
    const p = buildNotificationPayload({ type: "system", now: fixedNow });
    expect(p.title).toBe("Notifica di sistema");
    expect(p.icon).toBe("Bell");
  });

  it("always returns a valid ISO timestamp", () => {
    for (const t of NOTIFICATION_TYPES) {
      const p = buildNotificationPayload({ type: t, now: fixedNow });
      expect(() => new Date(p.createdAtIso).toISOString()).not.toThrow();
      expect(p.createdAtIso).toBe(fixedNow.toISOString());
    }
  });

  it("uses Date.now() when `now` is not provided", () => {
    const before = Date.now();
    const p = buildNotificationPayload({ type: "system" });
    const after = Date.now();
    const ts = new Date(p.createdAtIso).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});
