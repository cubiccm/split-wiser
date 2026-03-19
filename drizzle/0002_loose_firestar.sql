ALTER TABLE `expenses` ADD `original_amount` real;--> statement-breakpoint
ALTER TABLE `expenses` ADD `cashback_rate` real DEFAULT 0 NOT NULL;