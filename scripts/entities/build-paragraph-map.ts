/**
 * Invert seed-entities.json (entity → citations) into paragraph-entities.json (citation → entities[]).
 * Reads data/entities/seed-entities.json
 * Outputs data/entities/paragraph-entities.json
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ParagraphEntity, SeedEntity } from "./config.ts";

const dataDir = join(import.meta.dir, "../../data/entities");
const inputPath = join(dataDir, "seed-entities.json");
const outputPath = join(dataDir, "paragraph-entities.json");

if (!existsSync(inputPath)) {
	console.error(`seed-entities.json not found. Run parse-topic-index.ts first.`);
	process.exit(1);
}

const entities: SeedEntity[] = JSON.parse(readFileSync(inputPath, "utf-8"));
console.log(`Loaded ${entities.length} entities`);

// Build the inverted map: standardReferenceId → ParagraphEntity[]
const paragraphMap = new Map<string, ParagraphEntity[]>();

for (const entity of entities) {
	const pe: ParagraphEntity = {
		id: entity.id,
		name: entity.name,
		type: entity.type,
	};

	for (const citation of entity.citations) {
		const existing = paragraphMap.get(citation);
		if (existing) {
			// Avoid duplicate entity refs on the same paragraph
			if (!existing.some((e) => e.id === pe.id)) {
				existing.push(pe);
			}
		} else {
			paragraphMap.set(citation, [pe]);
		}
	}
}

// Sort entities within each paragraph by type then name
for (const [, entities] of paragraphMap) {
	entities.sort((a, b) => {
		if (a.type !== b.type) return a.type.localeCompare(b.type);
		return a.name.localeCompare(b.name);
	});
}

// Convert to plain object for JSON serialization
const output: Record<string, ParagraphEntity[]> = {};
for (const [ref, ents] of paragraphMap) {
	output[ref] = ents;
}

writeFileSync(outputPath, JSON.stringify(output, null, 2));

// Stats
const totalRefs = paragraphMap.size;
const sectionOnlyRefs = [...paragraphMap.keys()].filter((r) => !r.includes(".")).length;
const paragraphRefs = totalRefs - sectionOnlyRefs;

console.log(`\nMapped entities to ${totalRefs} unique references`);
console.log(`  Paragraph-level refs (e.g., 77:8.2): ${paragraphRefs}`);
console.log(`  Section-only refs (e.g., 148:7): ${sectionOnlyRefs}`);

// Entity coverage
const entityCoverage = new Map<string, number>();
for (const [, ents] of paragraphMap) {
	for (const e of ents) {
		entityCoverage.set(e.id, (entityCoverage.get(e.id) || 0) + 1);
	}
}
const orphanEntities = entities.filter((e) => !entityCoverage.has(e.id));
console.log(`\nEntities with paragraph coverage: ${entityCoverage.size}/${entities.length}`);
if (orphanEntities.length > 0) {
	console.log(`Orphan entities (no citations): ${orphanEntities.length}`);
}

console.log(`\nOutput: ${outputPath}`);
