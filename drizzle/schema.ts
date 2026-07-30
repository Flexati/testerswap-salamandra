import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "banned"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Developer apps registered on the platform
 */
export const apps = mysqlTable("apps", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  appName: varchar("appName", { length: 255 }).notNull(),
  playStoreUrl: varchar("playStoreUrl", { length: 512 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 64 }),
  platform: mysqlEnum("platform", ["android", "ios"]).default("android").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type App = typeof apps.$inferSelect;
export type InsertApp = typeof apps.$inferInsert;

/**
 * Tests created by developers (14-day closed testing campaigns)
 */
export const tests = mysqlTable("tests", {
  id: int("id").autoincrement().primaryKey(),
  appId: int("appId").notNull().references(() => apps.id),
  userId: int("userId").notNull().references(() => users.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  targetTesters: int("targetTesters").default(12).notNull(),
  currentTesters: int("currentTesters").default(0).notNull(),
  creditsPerTester: int("creditsPerTester").default(1).notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  status: mysqlEnum("status", ["active", "completed", "expired", "cancelled"]).default("active").notNull(),
  country: varchar("country", { length: 64 }),
  language: varchar("language", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Test = typeof tests.$inferSelect;
export type InsertTest = typeof tests.$inferInsert;

/**
 * Enrollments: tester joins a test
 */
export const enrollments = mysqlTable("enrollments", {
  id: int("id").autoincrement().primaryKey(),
  testId: int("testId").notNull().references(() => tests.id),
  userId: int("userId").notNull().references(() => users.id),
  status: mysqlEnum("status", ["enrolled", "in_progress", "completed", "abandoned", "verified"]).default("enrolled").notNull(),
  enrolledAt: timestamp("enrolledAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  creditsEarned: int("creditsEarned").default(0),
  feedback: text("feedback"),
  screenshotUrl: varchar("screenshotUrl", { length: 512 }),
  checklist: text("checklist"), // JSON: {installed, opened, usedMinutes, feedbackProvided}
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Enrollment = typeof enrollments.$inferSelect;
export type InsertEnrollment = typeof enrollments.$inferInsert;

/**
 * Credits ledger: track all credit transactions
 */
export const creditsLedger = mysqlTable("credits_ledger", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  amount: int("amount").notNull(),
  type: mysqlEnum("type", ["earned", "spent", "penalty", "bonus", "refund"]).notNull(),
  reason: varchar("reason", { length: 255 }),
  enrollmentId: int("enrollmentId").references(() => enrollments.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CreditsLedger = typeof creditsLedger.$inferSelect;
export type InsertCreditsLedger = typeof creditsLedger.$inferInsert;

/**
 * Credit locks: credits held while a test campaign is active.
 *
 * Separate from credits_ledger to preserve the ledger's append-only
 * history. A lock is mutable state (active -> consumed | refunded).
 * The lock amount is NOT counted in getUserCredits() until consumed;
 * this prevents double-counting while a campaign is running.
 */
export const creditLocks = mysqlTable("credit_locks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  testId: int("testId").notNull().references(() => tests.id),
  amount: int("amount").notNull(),
  status: mysqlEnum("status", ["active", "consumed", "refunded"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  releasedAt: timestamp("releasedAt"),
});

export type CreditLock = typeof creditLocks.$inferSelect;
export type InsertCreditLock = typeof creditLocks.$inferInsert;

/**
 * Trust events: track tester reliability
 */
export const trustEvents = mysqlTable("trust_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  eventType: mysqlEnum("eventType", ["completed", "abandoned", "feedback_quality", "response_time"]).notNull(),
  score: int("score").notNull(),
  enrollmentId: int("enrollmentId").references(() => enrollments.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TrustEvent = typeof trustEvents.$inferSelect;
export type InsertTrustEvent = typeof trustEvents.$inferInsert;

/**
 * Badges: gamification rewards
 */
export const badges = mysqlTable("badges", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  badgeType: mysqlEnum("badgeType", ["rookie_tester", "reliable_tester", "top_tester", "100_tests", "early_supporter"]).notNull(),
  level: mysqlEnum("level", ["bronze", "silver", "gold", "platinum"]).default("bronze").notNull(),
  earnedAt: timestamp("earnedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Badge = typeof badges.$inferSelect;
export type InsertBadge = typeof badges.$inferInsert;

/**
 * Reports: spam/abuse reporting
 */
export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  reporterId: int("reporterId").notNull().references(() => users.id),
  reportedUserId: int("reportedUserId").references(() => users.id),
  reportedEnrollmentId: int("reportedEnrollmentId").references(() => enrollments.id),
  reason: varchar("reason", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["pending", "reviewed", "resolved", "dismissed"]).default("pending").notNull(),
  actionTaken: varchar("actionTaken", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

/**
 * Notifications: in-app notifications
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  type: mysqlEnum("type", ["new_tester", "test_completed", "timer_expiring", "credits_received", "badge_earned", "system"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  relatedTestId: int("relatedTestId").references(() => tests.id),
  relatedEnrollmentId: int("relatedEnrollmentId").references(() => enrollments.id),
  read: int("read").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/**
 * Admin audit log: every privileged action (ban, resolve report,
 * unban) leaves a trail. Append-only — never updated or deleted.
 */
export const adminAuditLog = mysqlTable("admin_audit_log", {
  id: int("id").autoincrement().primaryKey(),
  actorUserId: int("actorUserId").notNull().references(() => users.id),
  targetUserId: int("targetUserId").references(() => users.id),
  targetReportId: int("targetReportId").references(() => reports.id),
  action: mysqlEnum("action", ["ban_user", "unban_user", "resolve_report", "dismiss_report"]).notNull(),
  reason: varchar("reason", { length: 500 }),
  metadata: text("metadata"), // JSON blob for action-specific extras
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLog.$inferInsert;