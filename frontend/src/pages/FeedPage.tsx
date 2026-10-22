import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Compass, Plus, UserPlus, Users } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Spinner } from "../components/ui/Spinner";
import { Tabs } from "../components/ui/Tabs";
import { PostCard } from "../features/social/PostCard";
import { PostCardSkeleton } from "../features/social/PostSkeletons";
import { useInfinitePosts } from "../features/social/useInfinitePosts";
import { usePageTitle } from "../features/social/usePageTitle";

type FeedMode = "explore" | "following";

export default function FeedPage() {
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<FeedMode>("explore");

  usePageTitle(mode === "following" ? "Siguiendo" : "Inicio");

  useEffect(() => {
    if (!user && mode === "following") setMode("explore");
  }, [user, mode]);

  const fetchPage = useCallback((cursor: number | null) => api.feed(mode, cursor), [mode]);

  const feed = useInfinitePosts(fetchPage, [mode]);

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Patrones de la comunidad</h1>
          <p className="text-sm text-ink-soft">Crea, comparte y haz los patrones de otros.</p>
        </div>
      </div>

      <Tabs
        ariaLabel="Modo del feed"
        className="mb-4"
        items={[
          { value: "explore", label: "Explorar" },
          ...(user ? [{ value: "following" as const, label: "Siguiendo" }] : []),
        ]}
        value={mode}
        onChange={(value) => setMode(value)}
      />

      {feed.loading || authLoading ? (
        <div className="space-y-4">
          <PostCardSkeleton />
          <PostCardSkeleton />
        </div>
      ) : feed.error ? (
        <EmptyState
          icon={<Compass className="size-6" />}
          title="No se ha podido cargar el feed"
          description={feed.error}
          action={
            <Button variant="secondary" onClick={feed.reload}>
              Reintentar
            </Button>
          }
        />
      ) : feed.items.length === 0 ? (
        mode === "following" ? (
          <EmptyState
            icon={<UserPlus className="size-6" />}
            title="Aún no sigues a nadie"
            description="Busca personas que compartan patrones y sigue sus publicaciones."
            action={
              <Link to="/search?type=users">
                <Button>
                  <Users className="size-4" aria-hidden />
                  Buscar personas
                </Button>
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={<Compass className="size-6" />}
            title="Todavía no hay patrones"
            description="Sé la primera persona en publicar un patrón de HAMA o punto de cruz."
            action={
              <Link to="/create">
                <Button>
                  <Plus className="size-4" aria-hidden />
                  Crea tu primer patrón
                </Button>
              </Link>
            }
          />
        )
      ) : (
        <>
          <div className="space-y-4">
            {feed.items.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>

          <div ref={feed.sentinelRef} aria-hidden className="h-1" />

          {feed.loadingMore && <Spinner label="Cargando más patrones…" />}

          {!feed.hasMore && feed.items.length > 4 && (
            <p className="py-8 text-center text-xs text-ink-soft">Has llegado al final ✨</p>
          )}
        </>
      )}
    </div>
  );
}
