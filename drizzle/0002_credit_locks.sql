CREATE TABLE `credit_locks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`testId` int NOT NULL,
	`amount` int NOT NULL,
	`status` enum('active','consumed','refunded') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`releasedAt` timestamp,
	CONSTRAINT `credit_locks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `credit_locks` ADD CONSTRAINT `credit_locks_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `credit_locks` ADD CONSTRAINT `credit_locks_testId_tests_id_fk` FOREIGN KEY (`testId`) REFERENCES `tests`(`id`) ON DELETE no action ON UPDATE no action;
