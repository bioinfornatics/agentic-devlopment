/**
 * Domain events — the shared language across bounded contexts.
 * Published by the execution domain, consumed by TUI, HTTP, persistence.
 */
import type { EvalKind, SubjectName, ContentHash, ExecStatus } from "./types.js";

// ── Execution events ────────────────────────────────────────────────────────

export interface SubjectStarted {
  readonly type:    "subject.started";
  readonly kind:    EvalKind;
  readonly subject: SubjectName;
  readonly hash:    ContentHash;
  readonly evalId:  number;
  readonly config:  string;
  readonly run:     number;
}

export interface GooseTurn {
  readonly type:    "goose.turn";
  readonly subject: SubjectName;
  readonly evalId:  number;
  readonly config:  string;
  readonly turn:    number;
  readonly role:    "user" | "assistant";
  readonly preview: string;
}

export interface GooseToolCall {
  readonly type:    "goose.tool_call";
  readonly subject: SubjectName;
  readonly evalId:  number;
  readonly config:  string;
  readonly tool:    string;
  readonly args:    unknown;
}

export interface SubjectCompleted {
  readonly type:      "subject.completed";
  readonly kind:      EvalKind;
  readonly subject:   SubjectName;
  readonly hash:      ContentHash;
  readonly evalId:    number;
  readonly config:    string;
  readonly run:       number;
  readonly rc:        number;
  readonly turns:     number;
  readonly durationMs: number;
}

export interface SubjectGraded {
  readonly type:    "subject.graded";
  readonly subject: SubjectName;
  readonly evalId:  number;
  readonly config:  string;
  readonly passed:  boolean;
  readonly score:   number;
}

// ── Suite events ────────────────────────────────────────────────────────────

export interface SuiteSubjectDone {
  readonly type:       "suite.subject_done";
  readonly kind:       EvalKind;
  readonly subject:    SubjectName;
  readonly rc:         number;
  readonly durationMs: number;
  readonly doneCount:  number;
  readonly total:      number;
}

export interface SuiteCompleted {
  readonly type:     "suite.completed";
  readonly kind:     EvalKind;
  readonly total:    number;
  readonly passed:   number;
  readonly durationMs: number;
}

// ── Layer events (layered orchestration) ────────────────────────────────────

export interface LayerStarted {
  readonly type:    "layer.started";
  readonly level:   string;
  readonly kind:    EvalKind;
  readonly total:   number;
  readonly workers: number;
}

export interface LayerCompleted {
  readonly type:      "layer.completed";
  readonly level:     string;
  readonly kind:      EvalKind;
  readonly avgDelta:  number;
  readonly n:         number;
  readonly durationMs: number;
}

export interface LayerSkipped {
  readonly type:    "layer.skipped";
  readonly level:   string;
  readonly kind:    EvalKind;
  readonly reason:  "already_done" | "early_stop";
}

export interface EarlyStop {
  readonly type:      "early_stop";
  readonly level:     string;
  readonly kind:      EvalKind;
  readonly avgDelta:  number;
  readonly threshold: number;
  readonly skipping:  readonly string[];
}

// ── Union type ───────────────────────────────────────────────────────────────

export type DomainEvent =
  | SubjectStarted | GooseTurn | GooseToolCall | SubjectCompleted | SubjectGraded
  | SuiteSubjectDone | SuiteCompleted
  | LayerStarted | LayerCompleted | LayerSkipped | EarlyStop;

export type EvalEvent    = SubjectStarted | GooseTurn | GooseToolCall | SubjectCompleted | SubjectGraded;
export type SuiteEvent   = SuiteSubjectDone | SuiteCompleted | EvalEvent;
export type LayeredEvent = LayerStarted | LayerCompleted | LayerSkipped | EarlyStop | SuiteEvent;
