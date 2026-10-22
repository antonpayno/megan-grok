import { useCallback, useEffect, useRef, useState, type DependencyList, type MutableRefObject } from "react";
import type { FeedPage, PostOut } from "../../api/types";
import { errorMessage } from "./format";

export interface InfinitePosts {
  items: PostOut[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  /** Engancha este ref al final de la lista para cargar más. */
  sentinelRef: MutableRefObject<HTMLDivElement | null>;
  loadMore: () => void;
  reload: () => void;
  /** Actualiza un post en la lista (like, borrado…). */
  updateItems: (updater: (items: PostOut[]) => PostOut[]) => void;
}

/**
 * Scroll infinito sobre el contrato `{ items, next_cursor }`.
 * `fetchPage(null)` carga la primera página; `deps` reinicia la lista (p. ej. al cambiar de pestaña).
 */
export function useInfinitePosts(
  fetchPage: (cursor: number | null) => Promise<FeedPage>,
  deps: DependencyList = [],
): InfinitePosts {
  const [items, setItems] = useState<PostOut[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const requestId = useRef(0);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({ cursor, hasMore, loading, loadingMore });
  stateRef.current = { cursor, hasMore, loading, loadingMore };

  // Primera página (y reinicio cuando cambian las dependencias).
  useEffect(() => {
    const id = ++requestId.current;
    setItems([]);
    setCursor(null);
    setHasMore(true);
    setLoading(true);
    setLoadingMore(false);
    setError(null);

    fetchRef
      .current(null)
      .then((page) => {
        if (requestId.current !== id) return;
        setItems(page.items);
        setCursor(page.next_cursor);
        setHasMore(page.next_cursor !== null);
      })
      .catch((err) => {
        if (requestId.current === id) setError(errorMessage(err));
      })
      .finally(() => {
        if (requestId.current === id) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, ...deps]);

  const loadMore = useCallback(() => {
    const { cursor: current, hasMore: more, loading: first, loadingMore: busy } = stateRef.current;
    if (first || busy || !more || current === null) return;

    const id = requestId.current;
    setLoadingMore(true);
    fetchRef
      .current(current)
      .then((page) => {
        if (requestId.current !== id) return;
        setItems((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
        });
        setCursor(page.next_cursor);
        setHasMore(page.next_cursor !== null);
      })
      .catch((err) => {
        if (requestId.current === id) setError(errorMessage(err));
      })
      .finally(() => {
        if (requestId.current === id) setLoadingMore(false);
      });
  }, []);

  // Observa el centinela del final de la lista.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: "700px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return {
    items,
    loading,
    loadingMore,
    error,
    hasMore,
    sentinelRef,
    loadMore,
    reload,
    updateItems: setItems,
  };
}
