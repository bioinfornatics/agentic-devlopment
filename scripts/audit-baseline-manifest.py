#!/usr/bin/env python3
import hashlib, json, pathlib, subprocess, datetime, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / '.audit/harness/audit-baseline-manifest.json'
def run(cmd):
    p = subprocess.run(cmd, cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return {'cmd': cmd, 'returncode': p.returncode, 'stdout': p.stdout, 'stderr': p.stderr}
rev = run(['git', 'rev-parse', 'HEAD'])
status = run(['git', 'status', '--short'])
diff = run(['git', 'diff', '--binary'])
diff_cached = run(['git', 'diff', '--cached', '--binary'])
patch = (diff['stdout'] + '\n---CACHED---\n' + diff_cached['stdout']).encode()
manifest = {
    'schema': 'harness-audit-baseline-manifest-v1',
    'generated_at': datetime.datetime.now(datetime.UTC).replace(microsecond=0).isoformat(),
    'repository': str(ROOT),
    'head': rev['stdout'].strip(),
    'dirty': bool(status['stdout'].strip()),
    'status_short': status['stdout'].splitlines(),
    'patch_sha256': hashlib.sha256(patch).hexdigest(),
    'patch_bytes': len(patch),
    'commands': {'head': rev, 'status': status, 'diff': {'returncode': diff['returncode']}, 'diff_cached': {'returncode': diff_cached['returncode']}},
}
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(manifest, indent=2, sort_keys=True) + '\n')
print(json.dumps({'path': str(out), 'dirty': manifest['dirty'], 'patch_sha256': manifest['patch_sha256']}, indent=2))
