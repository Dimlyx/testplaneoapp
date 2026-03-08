const STORAGE_KEY = "planeo_viewed_interventions";

function getViewedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function isInterventionViewed(id: string): boolean {
  return getViewedSet().has(id);
}

export function markInterventionAsViewed(id: string): void {
  const set = getViewedSet();
  set.add(id);
  // Keep only last 500 to avoid unbounded growth
  const arr = [...set];
  if (arr.length > 500) arr.splice(0, arr.length - 500);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}
