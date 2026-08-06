/** Dependency-inversion interfaces for the local-evaluation domain. */

export interface SmokeOperations {
  build(path: string): Promise<void>;
  resolve(path: string): Promise<void>;
  project(installDir: string, externalDir: string, runtimeDir: string): string;
  activate(runtimeDir: string, projectDir: string, release: string): void;
  verify(path: string): string;
  tree(path: string): Promise<string>;
}

export interface EvalCommand {
  command: string;
  args: string[];
}

export interface EvalCommandResult {
  command: string;
  exitCode: number;
  output: string;
}

export interface EvaluationRunner {
  (cmd: EvalCommand, env?: Record<string, string>): Promise<EvalCommandResult>;
}

export interface AttestationService {
  create(evidence: unknown, bindings: unknown, profile: string): Promise<Record<string, unknown>>;
  verify(attestation: unknown, evidence: unknown, bindings: unknown): boolean;
}
