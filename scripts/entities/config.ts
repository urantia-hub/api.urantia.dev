// Shared types, constants, and helpers for entity enrichment scripts

export type EntityType = "being" | "place" | "order" | "race" | "religion" | "concept";

export interface SeedEntity {
	id: string;
	name: string;
	type: EntityType;
	aliases: string[];
	description: string;
	seeAlso: string[];
	citations: string[];
}

export interface ParagraphEntity {
	id: string;
	name: string;
	type: EntityType;
}

export const CATEGORY_MAP: Record<string, EntityType> = {
	PERSON: "being",
	PLACE: "place",
	ORDER: "order",
	RACE: "race",
	RELIGION: "religion",
	OTHER: "concept",
};

export const TOPIC_INDEX_DIR =
	process.env.TOPIC_INDEX_DIR ?? "../../../urantiapedia/input/txt/topic-index-en";

/** Convert a name to a kebab-case slug for use as entity ID */
export function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/**
 * Extract all citation references from a text block.
 * Handles formats:
 *   (77:8.2)        → ["77:8.2"]
 *   (76:2)          → ["76:2"]       (section-only, resolved at populate time)
 *   (76:2.1,4)      → ["76:2.1", "76:2.4"]
 *   (76:2.2-5)      → ["76:2.2", "76:2.3", "76:2.4", "76:2.5"]
 *   (76:2.1-3,5)    → ["76:2.1", "76:2.2", "76:2.3", "76:2.5"]
 *   (64:5-6)        → ["64:5", "64:6"]  (section range)
 */
export function extractCitations(text: string): string[] {
	const citations: string[] = [];
	// Match parenthesized citation groups like (77:8.2) or (76:2.1,4) or (76:2.2-5)
	const groupRegex = /\((\d+:\d+(?:\.\d+(?:[,-]\d+)*)?(?:-\d+)?)\)/g;
	let match: RegExpExecArray | null;

	while ((match = groupRegex.exec(text)) !== null) {
		const raw = match[1];
		citations.push(...expandCitation(raw));
	}

	return [...new Set(citations)];
}

/** Expand a single citation string into one or more standardReferenceId values */
export function expandCitation(raw: string): string[] {
	// Match: paper:section or paper:section.paragraph(s)
	const m = raw.match(/^(\d+):(\d+)(?:\.(.+))?$/);
	if (!m) return [raw];

	const paper = m[1];
	const section = m[2];
	const parPart = m[3]; // e.g. "2", "1,4", "2-5", "1-3,5"

	if (!parPart) {
		// Could be section-only (e.g., "76:2") or section range (e.g., "64:5-6")
		const sectionRange = section.match(/^(\d+)-(\d+)$/);
		if (sectionRange) {
			const start = Number.parseInt(sectionRange[1], 10);
			const end = Number.parseInt(sectionRange[2], 10);
			const results: string[] = [];
			for (let s = start; s <= end; s++) {
				results.push(`${paper}:${s}`);
			}
			return results;
		}
		return [`${paper}:${section}`];
	}

	// Parse paragraph part: handle commas and ranges
	const results: string[] = [];
	const segments = parPart.split(",");

	for (const seg of segments) {
		const range = seg.match(/^(\d+)-(\d+)$/);
		if (range) {
			const start = Number.parseInt(range[1], 10);
			const end = Number.parseInt(range[2], 10);
			for (let p = start; p <= end; p++) {
				results.push(`${paper}:${section}.${p}`);
			}
		} else {
			results.push(`${paper}:${section}.${seg}`);
		}
	}

	return results;
}
