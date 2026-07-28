#!/usr/bin/env python3
import re,subprocess,sys
tracked=set(subprocess.check_output(['git','ls-files'],text=True).splitlines())
deleted=set(subprocess.check_output(['git','diff','--cached','--name-only','--diff-filter=D','--no-renames'],text=True).splitlines())
tracked=sorted(tracked-deleted)
patterns=[r'^apps/',r'^companions/',r'^\.agents/',r'^\.goose/',r'^src/app/node_modules/',r'^src/app/[^/]+/node_modules/',r'^src/app/[^/]+/dist/',r'(^|/).vite/',r'(^|/)__pycache__/',r'.db(?:-wal|-shm)?$']
bad=[p for p in tracked if any(re.search(x,p) for x in patterns)]
if bad:
 print('tracked generated artifacts:',*bad[:30],sep='\n  ',file=sys.stderr);raise SystemExit(1)
print('OK tracked root is source-only')