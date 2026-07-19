# Harness context budget policy

Budgets are enforced by scripts/context-budget.py and scripts/check-consistency.py: skill body warn above 500 and fail above 700 lines; agent file warn above 400 and fail above 500 lines. Recipes and agents load the minimum required skill set first; optional reference or deep-dive skills are loaded only when task evidence triggers them.

UI/UX triggers: accessibility or WCAG uses wcag-accessibility-audit; component taxonomy or tokens uses atomic-design and design-systems-arch; product psychology uses cognitive-ux and ux-quality; implementation handoff uses frontend-blueprint and webapp-testing; visual QA uses ui-quality.
