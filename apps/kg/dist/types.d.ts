export interface Entity {
    type: "entity";
    name: string;
    entityType: string;
    observations: string[];
    derived?: boolean;
}
export interface Relation {
    type: "relation";
    from: string;
    to: string;
    relationType: string;
    derived?: boolean;
    confidence?: number;
    rule?: string;
    inferred_at?: string;
    reason?: string;
    status_value?: string;
}
export type KGRecord = Entity | Relation;
export interface KG {
    entities: Map<string, Entity>;
    relations: Relation[];
}
export declare function parseJSONL(text: string): KG;
export declare function makeRel(from: string, to: string, relationType: string, opts?: Partial<Relation>): Relation;
export declare function makeStatus(entityName: string, status: string, reason: string, rule: string): Relation;
