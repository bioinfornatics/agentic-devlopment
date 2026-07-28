# Shell output filters

Filter at the command level — before data enters the context.

## Git

```bash
git status --short --branch          # not: git status
git log --oneline -5                 # not: git log
git diff --stat | tail -10           # not: git diff
git show --stat HEAD                 # no full patch
```

## File reads

```bash
jq '.field' file.json                # not: cat file.json
jq '{id,title,status}' file.json     # multiple fields
sed -n '1,40p' file.md               # first N lines only
grep -n "pattern" file.md            # matching lines + numbers
wc -l *.md                           # counts are fine as-is
```

## Tests and scripts

```bash
pnpm test    2>&1 | tail -8
pytest -q    2>&1 | tail -6
./script.sh  2>&1 | grep -E "^(PASS|FAIL|ERROR|exit|✓|✗)"
```

## General rule

Pipe every command that can produce > 20 lines through `| tail -N`, `| grep pattern`, or `| jq filter`.
One-liner summary beats a full log every time.
