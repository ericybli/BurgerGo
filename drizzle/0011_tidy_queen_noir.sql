CREATE TABLE `saved_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`name` text NOT NULL,
	`order_index` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_saved_lists_trip` ON `saved_lists` (`trip_id`,`order_index`);--> statement-breakpoint
ALTER TABLE `places` ADD `list_id` text REFERENCES saved_lists(id);