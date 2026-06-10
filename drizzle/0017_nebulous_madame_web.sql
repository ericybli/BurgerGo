CREATE TABLE `day_titles` (
	`trip_id` text NOT NULL,
	`day_date` text NOT NULL,
	`title` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`trip_id`, `day_date`),
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
