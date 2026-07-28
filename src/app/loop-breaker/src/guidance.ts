/**
 * Error-specific correction guidance generation.
 */

import { findPattern, findSimilarPattern, touchPattern } from "./patterns";

export interface CorrectionGuidance {
  message: string;
  fromPattern: boolean;
  patternId?: number;
}

/**
 * Generate correction guidance for an error.
 * First checks learned patterns, then falls back to built-in rules.
 */
export function generateGuidance(
  errorText: string,
  tool: string,
  count: number
): CorrectionGuidance {
  // Try exact pattern match
  const exactPattern = findPattern(extractSignature(errorText));
  if (exactPattern) {
    touchPattern(exactPattern.id);
    return {
      message: formatPatternGuidance(exactPattern, count),
      fromPattern: true,
      patternId: exactPattern.id,
    };
  }
  
  // Try fuzzy pattern match
  const similarPattern = findSimilarPattern(errorText, tool);
  if (similarPattern) {
    touchPattern(similarPattern.id);
    return {
      message: formatPatternGuidance(similarPattern, count),
      fromPattern: true,
      patternId: similarPattern.id,
    };
  }
  
  // Fall back to built-in rules
  return {
    message: generateBuiltinGuidance(errorText, tool, count),
    fromPattern: false,
  };
}

function extractSignature(errorText: string): string {
  const match = errorText.match(/(ReferenceError|TypeError|SyntaxError|Error):[^\n"]+/);
  return match ? match[0].trim() : errorText.slice(0, 100);
}

function formatPatternGuidance(
  pattern: { rootCause: string; correction: string; keyInsight?: string | null },
  count: number
): string {
  let msg = `LOOP-BREAKER CORRECTION (from learned pattern, attempt ${count}):\n\n`;
  msg += `ROOT CAUSE: ${pattern.rootCause}\n\n`;
  msg += `CORRECTION:\n${pattern.correction}\n`;
  
  if (pattern.keyInsight) {
    msg += `\nKEY INSIGHT: ${pattern.keyInsight}`;
  }
  
  return msg;
}

function generateBuiltinGuidance(
  errorText: string,
  tool: string,
  count: number
): string {
  // execute_typescript: missing run()
  if (errorText.includes("run is not defined")) {
    return `LOOP-BREAKER CORRECTION REQUIRED (attempt ${count}):
Your execute_typescript calls are missing the required run() function.

CORRECT FORMAT:
\`\`\`typescript
async function run() {
  // Your code here
  return result;
}
\`\`\`

WRONG (what you're doing):
\`\`\`typescript
const result = someFunction();  // No run() wrapper
\`\`\`

Fix: Wrap ALL your code inside an async run() function and return the result.`;
  }

  // TypeError
  if (errorText.includes("TypeError") || errorText.includes("Cannot read")) {
    return `LOOP-BREAKER CORRECTION REQUIRED (attempt ${count}):
TypeError detected in ${tool}. You're accessing a property on undefined/null.

Check:
1. Is the variable initialized before use?
2. Are you handling the case where a function returns undefined?
3. Is the API response structure what you expect?

Debug by adding console.log() before the failing line to inspect the actual value.`;
  }

  // SyntaxError
  if (errorText.includes("SyntaxError")) {
    return `LOOP-BREAKER CORRECTION REQUIRED (attempt ${count}):
SyntaxError detected in ${tool}.

Common causes:
1. Missing closing bracket/brace/parenthesis
2. Invalid JSON in parameters
3. Template literal syntax error

Review the code structure carefully before retrying.`;
  }

  // Permission denied
  if (errorText.includes("Permission denied") || errorText.includes("EACCES")) {
    return `LOOP-BREAKER CORRECTION REQUIRED (attempt ${count}):
Permission denied error in ${tool}.

Options:
1. Check if you have write access to the path
2. Use a different path you own (e.g., /tmp or home directory)
3. If the file exists, check if it's read-only

Do NOT use sudo in automated scripts.`;
  }

  // Generic fallback
  return `LOOP-BREAKER CORRECTION REQUIRED (attempt ${count}):
Same error pattern detected ${count} times in ${tool}.

Error: ${errorText.slice(0, 200)}

STOP and analyze:
1. What is the actual error message saying?
2. What assumption are you making that might be wrong?
3. Is there a different approach that avoids this error?

Do not retry the same approach. Change your strategy.`;
}
