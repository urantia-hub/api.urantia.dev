CREATE TABLE "papers" (
	"id" text PRIMARY KEY NOT NULL,
	"part_id" text NOT NULL,
	"title" text NOT NULL,
	"global_id" text NOT NULL,
	"sort_id" text NOT NULL,
	"labels" text[]
);
--> statement-breakpoint
CREATE TABLE "paragraphs" (
	"id" text PRIMARY KEY NOT NULL,
	"global_id" text NOT NULL,
	"standard_reference_id" text NOT NULL,
	"paper_section_paragraph_id" text NOT NULL,
	"sort_id" text NOT NULL,
	"paper_id" text NOT NULL,
	"section_id" text,
	"part_id" text NOT NULL,
	"paper_title" text NOT NULL,
	"section_title" text,
	"paragraph_id" text NOT NULL,
	"language" text DEFAULT 'eng' NOT NULL,
	"text" text NOT NULL,
	"html_text" text NOT NULL,
	"labels" text[],
	"search_vector" "tsvector",
	"embedding" vector(1536),
	"audio" jsonb,
	"entities" jsonb,
	CONSTRAINT "paragraphs_global_id_unique" UNIQUE("global_id")
);
--> statement-breakpoint
CREATE TABLE "parts" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"sponsorship" text,
	"sort_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" text PRIMARY KEY NOT NULL,
	"paper_id" text NOT NULL,
	"section_id" text NOT NULL,
	"title" text,
	"global_id" text NOT NULL,
	"sort_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "papers" ADD CONSTRAINT "papers_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paragraphs" ADD CONSTRAINT "paragraphs_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paragraphs" ADD CONSTRAINT "paragraphs_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paragraphs" ADD CONSTRAINT "paragraphs_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "papers_part_id_idx" ON "papers" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX "paragraphs_paper_id_idx" ON "paragraphs" USING btree ("paper_id");--> statement-breakpoint
CREATE INDEX "paragraphs_section_id_idx" ON "paragraphs" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "paragraphs_sort_id_idx" ON "paragraphs" USING btree ("sort_id");--> statement-breakpoint
CREATE INDEX "paragraphs_std_ref_idx" ON "paragraphs" USING btree ("standard_reference_id");--> statement-breakpoint
CREATE INDEX "paragraphs_psp_id_idx" ON "paragraphs" USING btree ("paper_section_paragraph_id");--> statement-breakpoint
CREATE INDEX "sections_paper_id_idx" ON "sections" USING btree ("paper_id");