# execute_typescript return discipline

`run()` must return only what the **next agent turn** requires.
Summarise inside `run()`; never forward raw tool output.

## Return size rule

**< 500 chars** or a structured array of small objects. If you are about to return a raw shell result, stop and reduce it first.

## Single result

```typescript
// ❌ Forwards full output (up to 50k chars)
async function run() {
  return await Developer.shell({ command: "bd list --json" });
}

// ✅ Returns only the signal
async function run() {
  const r = await Developer.shell({ command: "bd list --status=in_progress --json" });
  const items = JSON.parse(r.stdout);
  return items.map(i => ({ id: i.id, title: i.title, status: i.status }));
}
```

## Parallel results — reduce before assembling

```typescript
async function run() {
  const [a, b] = await Promise.all([
    Developer.shell({ command: "pnpm test 2>&1 | tail -5" }),
    Developer.shell({ command: "pytest -q 2>&1 | tail -5" }),
  ]);
  return {
    js_ok:  a.exit_code === 0,
    py_ok:  b.exit_code === 0,
    js_err: a.stderr.slice(0, 120),
    py_err: b.stderr.slice(0, 120),
  };
}
```

## Large JSON — select before returning

```typescript
const raw = JSON.parse(r.stdout);
// Return a summary object, not the array
return {
  count:  raw.length,
  open:   raw.filter(i => i.status === 'open').map(i => i.id),
  failed: raw.filter(i => i.exit_code !== 0).map(i => ({ id: i.id, err: i.stderr.slice(0,80) })),
};
```

## Summon.delegate inside execute_typescript

Use `async: false` (or omit the flag) when the next line in `run()` needs the result.
Use `async: true` only when the task will be collected in a **later separate** `execute_typescript` call.
Never mix `async: true` delegates with `Summon.load` in the same `run()` — the sandbox may cancel the background task before the load resolves.
