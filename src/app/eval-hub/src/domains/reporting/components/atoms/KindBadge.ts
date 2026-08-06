/**
 * KindBadge — Atom
 *
 * Coloured pill badge for a run kind: skills | agents | recipes.
 * CSS class `kind-{kind}` maps to per-kind colours defined in atoms/css.ts.
 *
 * @level Atom
 */
export function KindBadge(kind: string): string {
  return `<span class="kind-badge kind-${kind}">${kind}</span>`;
}
