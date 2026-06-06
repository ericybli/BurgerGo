CREATE TABLE `place_details_cache` (
	`google_place_id` text PRIMARY KEY NOT NULL,
	`name` text,
	`address` text,
	`lat` real,
	`lng` real,
	`category_guess` text,
	`photo_ref` text,
	`photo_local_path` text,
	`raw_json` text,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `places` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`day_date` text,
	`google_place_id` text,
	`name` text NOT NULL,
	`address` text,
	`lat` real,
	`lng` real,
	`category` text NOT NULL,
	`scheduled_time` text,
	`duration_min` integer,
	`cost` integer,
	`notes` text,
	`order_index` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_places_trip_day` ON `places` (`trip_id`,`day_date`,`order_index`);--> statement-breakpoint
CREATE INDEX `idx_places_google` ON `places` (`google_place_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`language` text NOT NULL,
	`currency` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `travel_legs` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`from_place_id` text NOT NULL,
	`to_place_id` text NOT NULL,
	`mode` text NOT NULL,
	`duration_seconds` integer NOT NULL,
	`distance_meters` integer NOT NULL,
	`computed_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_leg` ON `travel_legs` (`from_place_id`,`to_place_id`,`mode`);--> statement-breakpoint
CREATE TABLE `trips` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`cover_photo` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
