import { type Relation, type KG } from "./types.js";
type Rule = (kg: KG, rs: Set<string>) => Relation[];
export declare const RULES: {
    name: string;
    fn: Rule;
}[];
export declare function reason(opts?: {
    dryRun?: boolean;
    listRules?: boolean;
    input?: string;
    output?: string;
}): Promise<void>;
export {};
