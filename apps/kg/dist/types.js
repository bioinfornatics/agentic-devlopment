export function parseJSONL(text) {
    const entities = new Map();
    const relations = [];
    for (const line of text.split("\n").filter(Boolean)) {
        try {
            const d = JSON.parse(line);
            if (d.type === "entity" && typeof d.name === "string" && typeof d.entityType === "string") {
                entities.set(d.name, {
                    type: "entity",
                    name: d.name,
                    entityType: d.entityType,
                    observations: Array.isArray(d.observations) ? d.observations.filter((o) => typeof o === "string") : [],
                    ...(typeof d.derived === "boolean" ? { derived: d.derived } : {}),
                });
            }
            else if (d.type === "relation" && typeof d.from === "string" && typeof d.to === "string" && typeof d.relationType === "string") {
                relations.push(d);
            }
        }
        catch { /* skip */ }
    }
    return { entities, relations };
}
export function makeRel(from, to, relationType, opts = {}) {
    return { type: "relation", from, to, relationType, derived: true, confidence: 1.0, inferred_at: new Date().toISOString(), ...opts };
}
export function makeStatus(entityName, status, reason, rule) {
    return makeRel(entityName, "status:" + status, "HAS_STATUS", { status_value: status, reason, rule });
}
