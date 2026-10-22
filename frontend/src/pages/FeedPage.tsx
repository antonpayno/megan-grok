import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Compass, Grid2x2, LogIn, Plus, Sparkles, UserPlus, Users } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/Button";
import { ButtonLink } from "../components/ui/ButtonLink";
import { buttonClasses } from "../components/ui/buttonStyles";
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
  const loggedOut = !authLoading && !user;

  return (
    <div className="mx-auto w-full max-w-xl">
      <section
        aria-labelledby="feed-heading"
        className="mb-4 overflow-hidden rounded-3xl border border-line bg-white shadow-card"
      >
        <div className="relative bg-gradient-to-br from-brand-soft via-white to-paper px-4 py-4 sm:px-6 sm:py-6">
          <div
            className="pointer-events-none absolute -right-12 -top-14 size-40 rounded-full bg-brand/10 blur-2xl"
            aria-hidden
          />

          <div className="relative flex items-start gap-3">
            <span
              className="hidden size-11 shrink-0 place-items-center rounded-2xl bg-brand text-white shadow-sm sm:grid"
              aria-hidden
            >
              <Grid2x2 className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-brand sm:block">
                Pixel Pattern
              </p>
              <h1 id="feed-heading" className="text-[22px] font-bold leading-tight tracking-tight text-ink sm:mt-0.5 sm:text-2xl">
                Patrones de la comunidad
              </h1>
              <p className="mt-1 text-sm text-ink-soft">Crea, comparte y haz los patrones de otros.</p>
            </div>
          </div>

          {loggedOut && (
            <div className="relative mt-3 rounded-2xl border border-line bg-white/85 p-3.5 shadow-sm backdrop-blur-sm sm:mt-4 sm:flex sm:items-center sm:gap-4 sm:p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug">
                  Crea patrones de HAMA y punto de cruz desde cualquier foto
                </p>
                <p className="mt-1 hidden text-xs text-ink-soft sm:block">
                  Explora gratis o entra para guardar tus favoritos y publicar los tuyos.
                </p>
              </div>
              <div className="mt-2.5 flex shrink-0 gap-2 sm:mt-0">
                <ButtonLink to="/login?next=%2F" size="sm">
                  Entrar
                  <LogIn className="size-4" aria-hidden />
                </ButtonLink>
                <a
                  href="#feed"
                  className={buttonClasses({ variant: "secondary", size: "sm" })}
                >
                  Explorar
                  <ArrowRight className="size-4" aria-hidden />
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Sparkles className="size-4 text-brand" aria-hidden />
          Lo último
        </h2>
        <span className="text-xs text-ink-soft">Hecho por la comunidad</span>
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

      <section id="feed" aria-label="Patrones publicados" className="scroll-mt-20">
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
                <ButtonLink to="/search?type=users">
                  <Users className="size-4" aria-hidden />
                  Buscar personas
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              icon={<Compass className="size-6" />}
              title="Todavía no hay patrones"
              description="Sé la primera persona en publicar un patrón de HAMA o punto de cruz."
              action={
                <ButtonLink to="/create">
                  <Plus className="size-4" aria-hidden />
                  Crea tu primer patrón
                </ButtonLink>
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
      </section>
    </div>
  );
}
