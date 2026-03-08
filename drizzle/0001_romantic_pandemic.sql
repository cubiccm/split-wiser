PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `expenses_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`description` text NOT NULL,
	`amount` real NOT NULL,
	`type` text DEFAULT 'expense' NOT NULL,
	`created_by_id` integer NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `expenses_new` (`id`, `description`, `amount`, `type`, `created_by_id`, `created_at`)
SELECT `id`, `description`, `amount`, `type`, `created_by_id`, `created_at` FROM `expenses`;
--> statement-breakpoint
DROP TABLE `expenses`;
--> statement-breakpoint
ALTER TABLE `expenses_new` RENAME TO `expenses`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;