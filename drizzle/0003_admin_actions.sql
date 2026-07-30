-- Extend users.role enum to include 'banned' for admin moderation.
-- MySQL doesn't support ALTER ENUM ... ADD VALUE in all versions; use
-- MODIFY COLUMN to replace the enum definition while preserving data.
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','banned') NOT NULL DEFAULT 'user';
--> statement-breakpoint
CREATE TABLE `admin_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int NOT NULL,
	`targetUserId` int,
	`targetReportId` int,
	`action` enum('ban_user','unban_user','resolve_report','dismiss_report') NOT NULL,
	`reason` varchar(500),
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `admin_audit_log` ADD CONSTRAINT `admin_audit_log_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_audit_log` ADD CONSTRAINT `admin_audit_log_targetUserId_users_id_fk` FOREIGN KEY (`targetUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_audit_log` ADD CONSTRAINT `admin_audit_log_targetReportId_reports_id_fk` FOREIGN KEY (`targetReportId`) REFERENCES `reports`(`id`) ON DELETE no action ON UPDATE no action;
