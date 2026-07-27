#!/usr/bin/env bun
/**
 * loop-breaker v2.4: Hook handler with SQLite-backed error tracking.
 * 
 * Graduated response to tool failure loops:
 *   - 3 errors → inject correction guidance
 *   - 5 errors → delegate to error-analyzer
 *   - 8 errors → hard block
 *
 * Compilable to standalone binary:
 *   bun build ./src/index.ts --compile --outfile ./bin/loop-breaker
 */

import {
  getCounter,
  incrementCounter,
  resetCounters,
  getLastTool,
  wasCorrectionSent,
  recordCorrectionSent,
  cleanupOldSessions,
} from "./counters";
import { generateGuidance } from "./guidance";
import { findPattern, createPattern } from "./patterns";

// Types
interface HookPayload {
  event?: string;
  session_id?: string;
  tool_name?: string;
  tool?: string;
  output?: string;
  result?: string;
  stdout?: string;
  stderr?: string;
}

interface Decision {
  decision: "block" | "pause" | "inject";
  action?: string;
  reason?: string;
  message?: string;
  error_pattern?: string;
  tool?: string;
  attempts?: number;
  correction_guidance?: string;
  suggested_delegate?: string;
  delegate_instructions?: string;
}

// Thresholds
const INJECT_THRESHOLD = 3;
const DELEGATE_THRESHOLD = 5;
const BLOCK_THRESHOLD = 8;
const HARD_FAIL_DELEGATE = 4;
const HARD_FAIL_BLOCK = 6;
const REPETITION_BLOCK = 10;

// Error detection patterns
const ERROR_PATTERNS = [
  "ReferenceError",
  "is not defined",
  "TypeError",
  "SyntaxError",
  "Error:",
  "error:",
  "ENOENT",
  "Permission denied",
  "EACCES",
  "command not found",
];

function isSemanticError(output: string): boolean {
  return ERROR_PATTERNS.some(p => output.includes(p));
}

function extractErrorSignature(output: string): string {
  const match = output.match(/(ReferenceError|TypeError|SyntaxError|Error):[^\n"]+/);
  return match ? match[0].trim() : output.slice(0, 100);
}

async function handlePostToolUse(
  sessionId: string,
  toolName: string,
  toolOutput: string
): Promise<Decision | null> {
  const lastTool = getLastTool(sessionId);
  const isSameTool = lastTool === toolName;
  
  // Check for semantic errors in "successful" tool output
  if (isSemanticError(toolOutput)) {
    const errorSig = extractErrorSignature(toolOutput);
    
    // Increment error counter (reset if different tool)
    const errCount = isSameTool
      ? incrementCounter(sessionId, "error", toolName, errorSig)
      : (resetCounters(sessionId, ["error"]), incrementCounter(sessionId, "error", toolName, errorSig));
    
    // Graduated response
    if (errCount >= BLOCK_THRESHOLD) {
      return {
        decision: "block",
        reason: `LOOP-BREAKER HARD STOP: ${toolName} failed ${errCount} times with semantic errors. Human intervention required.`,
        error_pattern: errorSig,
        tool: toolName,
        attempts: errCount,
      };
    }
    
    if (errCount >= DELEGATE_THRESHOLD) {
      const guidance = generateGuidance(errorSig, toolName, errCount);
      return {
        decision: "pause",
        action: "delegate_correction",
        reason: `LOOP-BREAKER: ${toolName} failed ${errCount} times. Delegating to correction analysis.`,
        error_pattern: errorSig,
        tool: toolName,
        attempts: errCount,
        correction_guidance: guidance.message,
        suggested_delegate: "error-analyzer",
        delegate_instructions: `Analyze why ${toolName} keeps failing with: ${errorSig}. Provide a corrected approach.`,
      };
    }
    
    if (errCount >= INJECT_THRESHOLD) {
      // Check if we already sent correction for this exact error
      if (wasCorrectionSent(sessionId, toolName, errorSig)) {
        // Escalate if same correction was ignored
        incrementCounter(sessionId, "error", toolName, errorSig); // +1 to speed escalation
      }
      
      const guidance = generateGuidance(errorSig, toolName, errCount);
      recordCorrectionSent(sessionId, toolName, errorSig);
      
      return {
        decision: "inject",
        message: guidance.message,
        reason: `LOOP-BREAKER: ${toolName} failed ${errCount} times. Injecting correction guidance.`,
        error_pattern: errorSig,
        tool: toolName,
        attempts: errCount,
      };
    }
  } else {
    // Genuine success - reset failure counters
    resetCounters(sessionId, ["fail", "error"]);
  }
  
  // Track same-tool repetitions
  const toolCount = isSameTool
    ? incrementCounter(sessionId, "tool", toolName)
    : (resetCounters(sessionId, ["tool"]), incrementCounter(sessionId, "tool", toolName));
  
  if (toolCount > REPETITION_BLOCK) {
    return {
      decision: "block",
      reason: `LOOP-BREAKER: ${toolName} called ${toolCount} consecutive times. Infinite loop suspected.`,
    };
  }
  
  return null;
}

async function handlePostToolUseFailure(
  sessionId: string,
  toolName: string
): Promise<Decision | null> {
  const failCount = incrementCounter(sessionId, "fail");
  
  if (failCount >= HARD_FAIL_BLOCK) {
    return {
      decision: "block",
      reason: `LOOP-BREAKER HARD STOP: ${failCount} consecutive tool failures. Human intervention required.`,
    };
  }
  
  if (failCount >= HARD_FAIL_DELEGATE) {
    return {
      decision: "pause",
      action: "delegate_correction",
      reason: `LOOP-BREAKER: ${failCount} consecutive failures. Delegating to error analysis.`,
      tool: toolName,
      attempts: failCount,
      suggested_delegate: "error-analyzer",
      delegate_instructions: `Analyze repeated failures in ${toolName} and suggest a corrected approach.`,
    };
  }
  
  return null;
}

async function main() {
  // Read payload from stdin
  let input = "";
  
  if (typeof Bun !== "undefined") {
    // Bun runtime
    for await (const chunk of Bun.stdin.stream()) {
      input += new TextDecoder().decode(chunk);
    }
  } else {
    // Deno runtime
    const decoder = new TextDecoder();
    for await (const chunk of Deno.stdin.readable) {
      input += decoder.decode(chunk);
    }
  }
  
  let payload: HookPayload;
  try {
    payload = JSON.parse(input || "{}");
  } catch {
    process.exit(0);
  }
  
  const event = payload.event;
  if (!event) process.exit(0);
  
  const sessionId = payload.session_id || "unknown";
  const toolName = payload.tool_name || payload.tool || "";
  const toolOutput = payload.output || payload.result || payload.stdout || payload.stderr || "";
  
  let decision: Decision | null = null;
  
  switch (event) {
    case "PostToolUse":
      decision = await handlePostToolUse(sessionId, toolName, toolOutput);
      break;
    case "PostToolUseFailure":
      decision = await handlePostToolUseFailure(sessionId, toolName);
      break;
    case "SessionEnd":
      // Cleanup on session end
      resetCounters(sessionId);
      cleanupOldSessions();
      break;
  }
  
  if (decision) {
    console.log(JSON.stringify(decision));
  }
}

main().catch(() => process.exit(0));
