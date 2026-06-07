ALTER TABLE `places` ADD `ai_summary` text;--> statement-breakpoint
ALTER TABLE `saved_links` ADD `place_id` text REFERENCES places(id);