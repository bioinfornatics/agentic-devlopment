/**
 * ReportLayout — Template
 *
 * Page shell with sticky topbar and scrollable body content area.
 * Accepts pre-rendered organism HTML, collected CSS, and script tags.
 * Contains no data or business logic — pure structural skeleton.
 *
 * @level Template
 * @composition shell layout, topbar layout
 */
import { esc } from "../utils.js";

export interface ReportLayoutProps {
  /** Document <title> text. */
  title:   string;
  /** Right-aligned metadata string shown in the topbar. */
  meta:    string;
  /** All CSS concatenated from every atomic level (quarks → organisms → template). */
  styles:  string;
  /** Pre-rendered body HTML from the page component. */
  body:    string;
  /** Pre-rendered <script> block(s). */
  scripts: string;
}

export function ReportLayout({ title, meta, styles, body, scripts }: ReportLayoutProps): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)}</title>
  <style>${styles}</style>
</head>
<body>
<div class="shell">
  <div class="topbar">
    <h1>📊 Eval Hub</h1>
    <span style="color:var(--gray)">Trend Report</span>
    <span class="meta">${meta}</span>
  </div>

  <div class="body">

    ${body}

  </div>
</div>

${scripts}
</body>
</html>`;
}
