/**
 * tableControllerScript — Script fragment
 *
 * Client-side JavaScript for the sortable, filterable, paginated runs table.
 *
 * Stable DOM contracts (set by RunsTable + TableToolbar organisms):
 *   Reads:  #filterInput (text), #kindSelect (dropdown)
 *   Writes: #tableBody, #countBadge, #pgInfo, #pgRange
 *   Binds:  #pgPrev, #pgNext, thead th[data-col]
 *
 * Data contract: ALL_ROWS must be defined in scope before this runs.
 *
 * NOTE: This fragment closes the outer IIFE opened by EvalReportPage.
 *   The caller must NOT add another closing })(); after this fragment.
 *
 * @level Script (client-side behaviour, not a UI component)
 */
export function tableControllerScript(): string {
  return `\
/* ── Sortable / filterable table ─────────────────────── */
const PAGE_SIZE = 25;
let filtered    = [...ALL_ROWS];
let sortCol     = "date";
let sortDir     = -1;  // -1 = desc
let page        = 1;

function pctToNum(s) {
  if (s === "—") return -999;
  return parseFloat(s);
}

function sortedRows() {
  return [...filtered].sort((a, b) => {
    const av = a[sortCol], bv = b[sortCol];
    if (sortCol === "delta") {
      const an = av == null ? -999 : av;
      const bn = bv == null ? -999 : bv;
      return sortDir * (an - bn);
    }
    if (typeof av === "number" || typeof bv === "number") {
      return sortDir * ((av ?? -999) - (bv ?? -999));
    }
    const aStr = String(av ?? ""), bStr = String(bv ?? "");
    return sortDir * aStr.localeCompare(bStr);
  });
}

function renderTable() {
  const rows  = sortedRows();
  const total = rows.length;
  const start = (page - 1) * PAGE_SIZE;
  const end   = Math.min(start + PAGE_SIZE, total);
  const slice = rows.slice(start, end);

  const body = document.getElementById("tableBody");
  if (!slice.length) {
    body.innerHTML = '<tr><td class="tbl-empty" colspan="8">No matching runs</td></tr>';
  } else {
    body.innerHTML = slice.map(r => {
      const dc = r.delta == null ? "delta-neu" : r.delta > 0 ? "delta-pos" : r.delta < 0 ? "delta-neg" : "delta-neu";
      const kc = "kind-" + r.kind;
      return \`<tr>
        <td>\${r.date}</td>
        <td><span class="kind-badge \${kc}">\${r.kind}</span></td>
        <td>\${r.subject}</td>
        <td>\${r.withPct}</td>
        <td>\${r.basePct}</td>
        <td class="\${dc}">\${r.deltaFmt}</td>
        <td>\${r.turns}</td>
        <td>\${r.maxReached}</td>
      </tr>\`;
    }).join("");
  }

  document.getElementById("countBadge").textContent = total + " rows";
  document.getElementById("pgInfo").textContent = "Page " + page + " / " + Math.max(1, Math.ceil(total / PAGE_SIZE));
  document.getElementById("pgRange").textContent = total ? (start + 1) + "–" + end + " of " + total : "0";
  document.getElementById("pgPrev").disabled = page <= 1;
  document.getElementById("pgNext").disabled = end >= total;
}

function applyFilters() {
  const text = document.getElementById("filterInput").value.toLowerCase();
  const kind = document.getElementById("kindSelect").value;
  filtered   = ALL_ROWS.filter(r => {
    const matchText = !text || r.subject.toLowerCase().includes(text) || r.kind.toLowerCase().includes(text);
    const matchKind = !kind || r.kind === kind;
    return matchText && matchKind;
  });
  page = 1;
  renderTable();
}

document.getElementById("filterInput").addEventListener("input", applyFilters);
document.getElementById("kindSelect").addEventListener("change", applyFilters);
document.getElementById("pgPrev").addEventListener("click", () => { page--; renderTable(); });
document.getElementById("pgNext").addEventListener("click", () => { page++; renderTable(); });

document.querySelectorAll("thead th[data-col]").forEach(th => {
  th.addEventListener("click", () => {
    const col = th.dataset.col;
    if (sortCol === col) { sortDir *= -1; }
    else { sortCol = col; sortDir = col === "date" ? -1 : -1; }
    document.querySelectorAll("thead th").forEach(h => h.classList.remove("sorted-asc","sorted-desc"));
    th.classList.add(sortDir === 1 ? "sorted-asc" : "sorted-desc");
    page = 1;
    renderTable();
  });
});

// Initial render
document.querySelector('thead th[data-col="date"]').classList.add("sorted-desc");
renderTable();

})();
`;
}
