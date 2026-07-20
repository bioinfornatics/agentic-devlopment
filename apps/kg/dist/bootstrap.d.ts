import { type Entity, type Relation } from "./types.js";
export declare function collectBootstrapRecords(opts?: {
    product?: string;
}): Promise<(Entity | Relation)[]>;
export declare function bootstrap(opts?: {
    product?: string;
    dryRun?: boolean;
    output?: string;
}): Promise<void>;
