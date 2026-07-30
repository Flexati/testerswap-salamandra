CREATE TABLE `apps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`appName` varchar(255) NOT NULL,
	`playStoreUrl` varchar(512) NOT NULL,
	`description` text,
	`category` varchar(64),
	`platform` enum('android','ios') NOT NULL DEFAULT 'android',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `apps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `badges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`badgeType` enum('rookie_tester','reliable_tester','top_tester','100_tests','early_supporter') NOT NULL,
	`level` enum('bronze','silver','gold','platinum') NOT NULL DEFAULT 'bronze',
	`earnedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `badges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credits_ledger` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amount` int NOT NULL,
	`type` enum('earned','spent','penalty','bonus','refund') NOT NULL,
	`reason` varchar(255),
	`enrollmentId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credits_ledger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `enrollments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`testId` int NOT NULL,
	`userId` int NOT NULL,
	`status` enum('enrolled','in_progress','completed','abandoned','verified') NOT NULL DEFAULT 'enrolled',
	`enrolledAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`creditsEarned` int DEFAULT 0,
	`feedback` text,
	`screenshotUrl` varchar(512),
	`checklist` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `enrollments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('new_tester','test_completed','timer_expiring','credits_received','badge_earned','system') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text,
	`relatedTestId` int,
	`relatedEnrollmentId` int,
	`read` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reporterId` int NOT NULL,
	`reportedUserId` int,
	`reportedEnrollmentId` int,
	`reason` varchar(255) NOT NULL,
	`description` text,
	`status` enum('pending','reviewed','resolved','dismissed') NOT NULL DEFAULT 'pending',
	`actionTaken` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`targetTesters` int NOT NULL DEFAULT 12,
	`currentTesters` int NOT NULL DEFAULT 0,
	`creditsPerTester` int NOT NULL DEFAULT 1,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`status` enum('active','completed','expired','cancelled') NOT NULL DEFAULT 'active',
	`country` varchar(64),
	`language` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trust_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`eventType` enum('completed','abandoned','feedback_quality','response_time') NOT NULL,
	`score` int NOT NULL,
	`enrollmentId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trust_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `apps` ADD CONSTRAINT `apps_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `badges` ADD CONSTRAINT `badges_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `credits_ledger` ADD CONSTRAINT `credits_ledger_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `credits_ledger` ADD CONSTRAINT `credits_ledger_enrollmentId_enrollments_id_fk` FOREIGN KEY (`enrollmentId`) REFERENCES `enrollments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_testId_tests_id_fk` FOREIGN KEY (`testId`) REFERENCES `tests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_relatedTestId_tests_id_fk` FOREIGN KEY (`relatedTestId`) REFERENCES `tests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_relatedEnrollmentId_enrollments_id_fk` FOREIGN KEY (`relatedEnrollmentId`) REFERENCES `enrollments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reports` ADD CONSTRAINT `reports_reporterId_users_id_fk` FOREIGN KEY (`reporterId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reports` ADD CONSTRAINT `reports_reportedUserId_users_id_fk` FOREIGN KEY (`reportedUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reports` ADD CONSTRAINT `reports_reportedEnrollmentId_enrollments_id_fk` FOREIGN KEY (`reportedEnrollmentId`) REFERENCES `enrollments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tests` ADD CONSTRAINT `tests_appId_apps_id_fk` FOREIGN KEY (`appId`) REFERENCES `apps`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tests` ADD CONSTRAINT `tests_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trust_events` ADD CONSTRAINT `trust_events_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trust_events` ADD CONSTRAINT `trust_events_enrollmentId_enrollments_id_fk` FOREIGN KEY (`enrollmentId`) REFERENCES `enrollments`(`id`) ON DELETE no action ON UPDATE no action;