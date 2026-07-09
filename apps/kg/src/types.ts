export interface Entity { type: "entity"; name: string; entityType: string; observations: string[]; derived?: boolean; }
export interface Relation { type: "relation"; from: string; to: string; relationType: string; derived?: boolean; confidence?: number; rule?: string; inferred_at?: string; reason?: string; status_value?: string; }
export type KGRecord = Entity | Relation;
export interface KG { entities: Map<string, Entity>; relations: Relation[]; }

export function parseJSONL(text: string): KG {
  const entities = new Map<string, Entity>();
  const relations: Relation[] = [];
  for (const line of text.split("\n").filter(Boolean)) {
    try {
      const d = JSON.parse(line) as KGRecord;
      if (d.type === "entity") entities.set(d.name, d);
      else if (d.type === "relation") relations.push(d);
    } catch { /* skip */ }
  }
  return { entities, relations };
}

export function makeRel(from: string, to: string, relationType: string, opts: Partial<Relation> = {}): Relation {
  return { type: "relation", from, to, relationType, derived: true, confidence: 1.0, inferred_at: new Date().toISOString(), ...opts };
}

export function makeStatus(entityName: string, status: string, reason: string, rule: string): Relation {
  return makeRel(entityName, "status:" + status, "HAS_STATUS", { status_value: status, reason, rule });
}