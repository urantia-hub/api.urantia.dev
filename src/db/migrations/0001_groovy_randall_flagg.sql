CREATE TABLE "entities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"aliases" text[],
	"description" text,
	"see_also" text[],
	"citation_count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paragraph_entities" (
	"paragraph_id" text NOT NULL,
	"entity_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "paragraph_entities" ADD CONSTRAINT "paragraph_entities_paragraph_id_paragraphs_id_fk" FOREIGN KEY ("paragraph_id") REFERENCES "public"."paragraphs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paragraph_entities" ADD CONSTRAINT "paragraph_entities_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entities_type_idx" ON "entities" USING btree ("type");--> statement-breakpoint
CREATE INDEX "pe_paragraph_id_idx" ON "paragraph_entities" USING btree ("paragraph_id");--> statement-breakpoint
CREATE INDEX "pe_entity_id_idx" ON "paragraph_entities" USING btree ("entity_id");--> statement-breakpoint
ALTER TABLE "paragraphs" DROP COLUMN "entities";