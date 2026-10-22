const KEY = "pp_recent_searches";
const MAX = 8;

export function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string").slice(0, MAX);
  } catch {
    return [];
  }
}

export function addRecentSearch(term: string): string[] {
  const value = term.trim();
  if (!value) return getRecentSearches();
  const next = [value, ...getRecentSearches().filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* almacenamiento no disponible */
  }
  return next;
}

export function removeRecentSearch(term: string): string[] {
  const next = getRecentSearches().filter((item) => item !== term);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* almacenamiento no disponible */
  }
  return next;
}

export function clearRecentSearches(): string[] {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* almacenamiento no disponible */
  }
  return [];
}
