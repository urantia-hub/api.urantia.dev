import { eq, inArray } from "drizzle-orm";
import type { getDb } from "../db/client.ts";
import { entities, paragraphEntities } from "../db/schema.ts";

type Db = ReturnType<typeof getDb>["db"];
type ParagraphRow = { id: string; [key: string]: unknown };
type EntityMention = { id: string; name: string; type: string };

/** Check if `include` query param contains "entities" */
export function wantsEntities(include: string | undefined): boolean {
	if (!include) return false;
	return include.split(",").map((s) => s.trim()).includes("entities");
}

/**
 * Batch-enrich paragraph rows with their entity mentions via the junction table.
 * Returns new array with `entities` array attached to each row.
 */
export async function enrichWithEntities<T extends ParagraphRow>(
	db: Db,
	rows: T[],
): Promise<(T & { entities: EntityMention[] })[]> {
	if (rows.length === 0) return [];

	const paragraphIds = rows.map((r) => r.id);

	// Fetch all junction + entity data in one query
	const junctionRows = await db
		.select({
			paragraphId: paragraphEntities.paragraphId,
			entityId: entities.id,
			entityName: entities.name,
			entityType: entities.type,
		})
		.from(paragraphEntities)
		.innerJoin(entities, eq(paragraphEntities.entityId, entities.id))
		.where(inArray(paragraphEntities.paragraphId, paragraphIds));

	// Group by paragraph ID
	const entityMap = new Map<string, EntityMention[]>();
	for (const row of junctionRows) {
		const list = entityMap.get(row.paragraphId) ?? [];
		list.push({ id: row.entityId, name: row.entityName, type: row.entityType });
		entityMap.set(row.paragraphId, list);
	}

	// Attach to each paragraph
	return rows.map((r) => ({
		...r,
		entities: entityMap.get(r.id) ?? [],
	}));
}
