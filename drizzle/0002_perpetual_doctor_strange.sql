CREATE TABLE `budget_targets` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`category` text,
	`planned_amount` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_budget_targets_trip_cat` ON `budget_targets` (`trip_id`,`category`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`amount` integer NOT NULL,
	`category` text NOT NULL,
	`spent_on` text NOT NULL,
	`note` text,
	`linked_place_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`linked_place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_expenses_trip_date` ON `expenses` (`trip_id`,`spent_on`);--> statement-breakpoint
CREATE INDEX `idx_expenses_trip_cat` ON `expenses` (`trip_id`,`category`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` text NOT NULL,
	`path` text NOT NULL,
	`width` integer,
	`height` integer,
	`order_index` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_photos_owner` ON `photos` (`owner_type`,`owner_id`,`order_index`);--> statement-breakpoint
CREATE TABLE `restaurants` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`name` text NOT NULL,
	`cuisine` text,
	`rating` integer,
	`status` text NOT NULL,
	`price_level` integer,
	`notes` text,
	`linked_place_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`linked_place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_restaurants_trip` ON `restaurants` (`trip_id`,`status`);
