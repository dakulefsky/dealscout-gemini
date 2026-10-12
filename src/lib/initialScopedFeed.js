export function readInitialScopedFeed() {
  try { return JSON.parse(document.getElementById('initial-scoped-deals')?.textContent || 'null'); }
  catch { return null; }
}
