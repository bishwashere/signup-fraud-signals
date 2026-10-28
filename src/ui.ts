// Case-review page: a single self-contained HTML document, no build step.
// Analysts filter by decision and expand a row to see the score and reasons.
export function caseReviewPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Signup fraud review</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 960px; padding: 0 1rem; color: #1a1a1a; }
  h1 { font-size: 1.4rem; }
  .filters { margin: 1rem 0; display: flex; gap: .5rem; }
  .filters button { padding: .4rem .9rem; border: 1px solid #ccc; background: #fff; border-radius: 999px; cursor: pointer; }
  .filters button.active { background: #1a1a1a; color: #fff; border-color: #1a1a1a; }
  table { width: 100%; border-collapse: collapse; font-size: .9rem; }
  th, td { text-align: left; padding: .5rem; border-bottom: 1px solid #eee; vertical-align: top; }
  .pill { display: inline-block; padding: .15rem .6rem; border-radius: 999px; font-size: .75rem; font-weight: 600; }
  .approve { background: #e6f4ea; color: #137333; }
  .review { background: #fef7e0; color: #b06000; }
  .deny { background: #fce8e6; color: #a50e0e; }
  details summary { cursor: pointer; color: #444; }
  ul { margin: .4rem 0; padding-left: 1.2rem; }
  .empty { color: #777; padding: 2rem 0; }
</style>
</head>
<body>
<h1>Signup fraud review</h1>
<p>Events scored by the signup-fraud Worker. Click a row for the score breakdown.</p>
<div class="filters">
  <button data-f="all" class="active">All</button>
  <button data-f="review">Hold for review</button>
  <button data-f="deny">Denied</button>
  <button data-f="approve">Approved</button>
</div>
<div id="cases"></div>
<script>
  let current = "all";
  async function load() {
    const q = current === "all" ? "" : "?decision=" + current;
    const res = await fetch("/api/cases" + q);
    const { cases } = await res.json();
    const el = document.getElementById("cases");
    if (!cases.length) { el.innerHTML = '<p class="empty">No cases yet. POST to /events/signup to score one.</p>'; return; }
    el.innerHTML = "<table><thead><tr><th>Time</th><th>Email</th><th>IP</th><th>Score</th><th>Decision</th><th></th></tr></thead><tbody>" +
      cases.map(c =>
        "<tr><td>" + new Date(c.receivedAt).toLocaleString() + "</td>" +
        "<td>" + escapeHtml(c.email) + "</td>" +
        "<td>" + escapeHtml(c.ip) + "</td>" +
        "<td>" + (c.score ?? "-") + "</td>" +
        '<td><span class="pill ' + c.decision + '">' + c.decision + "</span></td>" +
        "<td><details><summary>reasons</summary><ul>" +
          (c.reasons || []).map(r => "<li>" + escapeHtml(r) + "</li>").join("") +
        "</ul></details></td></tr>"
      ).join("") + "</tbody></table>";
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  }
  document.querySelectorAll(".filters button").forEach(b => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".filters button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      current = b.dataset.f;
      load();
    });
  });
  load();
</script>
</body>
</html>`;
}
