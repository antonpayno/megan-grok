import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Clock, Search, SearchX, TrendingUp, X } from "lucide-react";
import { api } from "../api/client";
import type { Craft, SearchResults, TagCount } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { Tabs } from "../components/ui/Tabs";
import { cn } from "../components/ui/cn";
import { errorMessage, formatCount } from "../features/social/format";
import { FollowButton } from "../features/social/FollowButton";
import { PostGrid } from "../features/social/PostGrid";
import { PostGridSkeleton } from "../features/social/PostSkeletons";
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
} from "../features/social/recentSearches";
import { TagChip } from "../features/social/TagChip";
import { usePageTitle } from "../features/social/usePageTitle";
import { UserRow } from "../features/social/UserRow";

type SearchType = "all" | "users" | "posts";

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();

  const qParam = params.get("q") ?? "";
  const typeParam = parseType(params.get("type"));
  const craftParam = parseCraft(params.get("craft"));

  const [query, setQuery] = useState(qParam);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trending, setTrending] = useState<TagCount[] | null>(null);
  const [recent, setRecent] = useState<string[]>(() => getRecentSearches());

  usePageTitle(qParam.trim() ? `Buscar “${qParam.trim()}”` : "Buscar");

  // La URL es la fuente de verdad (enlaces de tags, buscador del layout, atrás).
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setQuery((current) => (current === qParam ? current : qParam));
    if (pushTimer.current) {
      clearTimeout(pushTimer.current);
      pushTimer.current = null;
    }
  }, [qParam]);

  useEffect(
    () => () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    },
    [],
  );

  const updateParam = (key: string, value: string | null) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  /** Pasa el texto a la URL 300 ms después de la última tecla. */
  const scheduleSearch = (value: string) => {
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      pushTimer.current = null;
      updateParam("q", value.trim() || null);
    }, 300);
  };

  const clearQuery = () => {
    if (pushTimer.current) {
      clearTimeout(pushTimer.current);
      pushTimer.current = null;
    }
    setQuery("");
    updateParam("q", null);
  };

  // Búsqueda contra la API (la URL ya trae el debounce aplicado).
  useEffect(() => {
    const term = qParam.trim();
    if (!term) {
      setResults(null);
      setError(null);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);

    api
      .search(term, typeParam, craftParam ?? undefined)
      .then((data) => {
        if (!alive) return;
        setResults(data);
        setRecent(addRecentSearch(term));
      })
      .catch((err) => {
        if (alive) setError(errorMessage(err, "No se pudo buscar."));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [qParam, typeParam, craftParam]);

  // Tags en tendencia (una sola vez).
  useEffect(() => {
    let alive = true;
    api
      .trendingTags()
      .then((tags) => {
        if (alive) setTrending(tags);
      })
      .catch(() => {
        if (alive) setTrending([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pushTimer.current) {
      clearTimeout(pushTimer.current);
      pushTimer.current = null;
    }
    updateParam("q", query.trim() || null);
    if (query.trim()) setRecent(addRecentSearch(query.trim()));
  };

  const hasQuery = qParam.trim().length > 0;
  const showResults = hasQuery && !loading && !error && results;

  const userResults = useMemo(() => results?.users ?? [], [results]);
  const postResults = useMemo(() => results?.posts ?? [], [results]);
  const tagResults = useMemo(() => results?.tags ?? [], [results]);

  const empty =
    showResults &&
    ((typeParam === "users" && userResults.length === 0) ||
      (typeParam === "posts" && postResults.length === 0) ||
      (typeParam === "all" && userResults.length === 0 && postResults.length === 0 && tagResults.length === 0));

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-xl font-bold tracking-tight">Buscar</h1>
      <p className="text-sm text-ink-soft">Personas, patrones y tags de la comunidad.</p>

      <form onSubmit={submit} className="mt-4" role="search">
        <label htmlFor="search-input" className="sr-only">
          Buscar personas, patrones o tags
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-soft" aria-hidden />
          <input
            id="search-input"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              scheduleSearch(e.target.value);
            }}
            placeholder="Busca «gato», «#halloween» o @ana_hama"
            className="h-12 w-full rounded-full border border-line bg-white pl-12 pr-11 text-sm placeholder:text-ink-soft/70 focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          {query && (
            <button
              type="button"
              onClick={clearQuery}
              aria-label="Borrar búsqueda"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-soft transition-colors hover:bg-paper hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </form>

      {hasQuery && (
        <>
          <Tabs
            ariaLabel="Tipo de resultado"
            className="mt-4"
            items={[
              { value: "all", label: "Todo" },
              { value: "users", label: "Perfiles" },
              { value: "posts", label: "Patrones" },
            ]}
            value={typeParam}
            onChange={(value) => updateParam("type", value === "all" ? null : value)}
          />

          {typeParam !== "users" && (
            <div className="mt-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="mr-1 shrink-0 text-xs font-medium text-ink-soft">Técnica:</span>
              {[
                { value: null, label: "Todas" },
                { value: "hama" as const, label: "HAMA" },
                { value: "cross_stitch" as const, label: "Punto de cruz" },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => updateParam("craft", option.value)}
                  aria-pressed={craftParam === option.value}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1 text-sm transition-colors",
                    craftParam === option.value
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-white text-ink-soft hover:border-ink-soft/40 hover:text-ink",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <div className="mt-5">
        {!hasQuery ? (
          <Discover
            trending={trending}
            recent={recent}
            onPick={(term) => {
              setQuery(term);
              updateParam("q", term);
            }}
            onRemoveRecent={(term) => setRecent(removeRecentSearch(term))}
            onClearRecent={() => setRecent(clearRecentSearches())}
          />
        ) : error ? (
          <EmptyState
            icon={<SearchX className="size-6" />}
            title="No se ha podido buscar"
            description={error}
            action={
              <Button variant="secondary" onClick={() => updateParam("q", qParam.trim())}>
                Reintentar
              </Button>
            }
          />
        ) : loading || !results ? (
          <div className="space-y-4">
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-full" />
                  <Skeleton className="h-9 flex-1" />
                </div>
              ))}
            </div>
            <PostGridSkeleton count={6} />
          </div>
        ) : empty ? (
          <EmptyState
            icon={<SearchX className="size-6" />}
            title="Sin resultados"
            description={`No hemos encontrado nada para “${qParam.trim()}”. Prueba con otra palabra o un tag.`}
          />
        ) : (
          <div className="space-y-7">
            {typeParam !== "posts" && userResults.length > 0 && (
              <section aria-labelledby="resultados-perfiles">
                <h2 id="resultados-perfiles" className="mb-1 text-sm font-semibold">
                  Perfiles
                </h2>
                <ul className="divide-y divide-line/70">
                  {userResults.map((person) => (
                    <li key={person.id}>
                      <UserRow
                        user={person}
                        action={
                          user && user.username !== person.username ? (
                            <FollowButton username={person.username} isFollowing={false} />
                          ) : null
                        }
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {typeParam === "all" && tagResults.length > 0 && (
              <section aria-labelledby="resultados-tags">
                <h2 id="resultados-tags" className="mb-2 text-sm font-semibold">
                  Tags
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {tagResults.map((tag) => (
                    <TagChip
                      key={tag.tag}
                      tag={tag.tag}
                      count={tag.count}
                      active={qParam.trim().replace(/^#/, "").toLowerCase() === tag.tag.toLowerCase()}
                    />
                  ))}
                </div>
              </section>
            )}

            {typeParam !== "users" && (postResults.length > 0 || typeParam === "posts") && (
              <section aria-labelledby="resultados-patrones">
                <h2 id="resultados-patrones" className="mb-2 flex items-baseline gap-2 text-sm font-semibold">
                  Patrones
                  {postResults.length > 0 && (
                    <span className="text-xs font-normal text-ink-soft">{formatCount(postResults.length)}</span>
                  )}
                </h2>
                {postResults.length > 0 ? (
                  <PostGrid posts={postResults} />
                ) : (
                  <p className="py-6 text-center text-sm text-ink-soft">No hay patrones que coincidan.</p>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Discover({
  trending,
  recent,
  onPick,
  onRemoveRecent,
  onClearRecent,
}: {
  trending: TagCount[] | null;
  recent: string[];
  onPick: (term: string) => void;
  onRemoveRecent: (term: string) => void;
  onClearRecent: () => void;
}) {
  return (
    <div className="space-y-7">
      <section aria-labelledby="tags-tendencia">
        <h2 id="tags-tendencia" className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <TrendingUp className="size-4 text-brand" aria-hidden />
          Tags en tendencia
        </h2>
        {trending === null ? (
          <div className="flex flex-wrap gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-full" />
            ))}
          </div>
        ) : trending.length === 0 ? (
          <p className="text-sm text-ink-soft">Todavía no hay tags.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {trending.map((tag) => (
              <TagChip key={tag.tag} tag={tag.tag} count={tag.count} />
            ))}
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section aria-labelledby="busquedas-recientes">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="busquedas-recientes" className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="size-4 text-ink-soft" aria-hidden />
              Búsquedas recientes
            </h2>
            <button
              type="button"
              onClick={onClearRecent}
              className="text-xs font-medium text-ink-soft transition-colors hover:text-ink"
            >
              Borrar todo
            </button>
          </div>
          <ul className="divide-y divide-line/70">
            {recent.map((term) => (
              <li key={term} className="flex items-center gap-3 py-2">
                <button
                  type="button"
                  onClick={() => onPick(term)}
                  className="flex-1 truncate text-left text-sm transition-colors hover:text-brand"
                >
                  {term}
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveRecent(term)}
                  aria-label={`Quitar “${term}” de búsquedas recientes`}
                  className="rounded-full p-1 text-ink-soft transition-colors hover:bg-paper hover:text-ink"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-center text-xs text-ink-soft">
        Busca por nombre de usuario (<code>@ana_hama</code>), título o tag (<code>#gato</code>).
      </p>
    </div>
  );
}

function parseType(value: string | null): SearchType {
  return value === "users" || value === "posts" ? value : "all";
}

function parseCraft(value: string | null): Craft | null {
  return value === "hama" || value === "cross_stitch" ? value : null;
}
