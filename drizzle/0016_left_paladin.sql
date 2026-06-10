CREATE TABLE `ticket_files` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_ticket_files_ticket` ON `ticket_files` (`ticket_id`);--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`title` text NOT NULL,
	`date` text,
	`time` text,
	`location` text,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tickets_trip` ON `tickets` (`trip_id`,`date`,`time`);