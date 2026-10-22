import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bookmark, Download, Hand, Heart, PencilRuler, Trash2 } from "lucide-react";
import { api, downloadBlob } from "../api/client";
import type { PostOut } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { cn } from "../components/ui/cn";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { toast } from "../components/ui/Toast";
import PatternCanvas from "../components/pattern/PatternCanvas";
import { CommentsSection } from "../features/social/CommentsSection";
import { fileSlug, patternToPngBlob } from "../features/social/exportPattern";
import { FollowButton } from "../features/social/FollowButton";
import { craftLabel, errorMessage, formatCount, patternSize, relativeTime } from "../features/social/format";
import { MOCKS, mockPostById } from "../features/social/mock";
import { TagChip } from "../features/social/TagChip";
import { usePageTitle } from "../features/social/usePageTitle";
import { useCellSize } from "../features/social/useCellSize";
import { usePostActions } from "../features/social/usePostActions";
import { useProfile } from "../features/social/useProfile";

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const postId = Number(id);

  const [post, setPost] = useState<PostOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  usePageTitle(post?.title ?? "Patrón");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setPost(null);

    if (!Number.isFinite(postId) || postId <= 0) {
      setError("Este patrón no existe.");
      setLoading(false);
      return;
    }

    const request = MOCKS ? Promise.resolve(mockPostById(postId)) : api.getPost(postId);
    request
      .then((data) => {
        if (alive) setPost(data);
      })
      .catch((err) => {
        if (alive) setError(errorMessage(err, "No se ha podido cargar el patrón."));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [postId]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <Skeleton className="h-5 w-28" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Skeleton className="aspect-square w-full rounded-3xl" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <EmptyState
        icon={<PencilRuler className="size-6" />}
        title="Patrón no encontrado"
        description={error ?? "Puede que lo haya borrado su autor."}
        action={
          <Link to="/">
            <Button variant="secondary">
              <ArrowLeft className="size-4" aria-hidden />
              Volver al feed
            </Button>
          </Link>
        }
      />
    );
  }

  return <PostDetailView key={post.id} post={post} />;
}

function PostDetailView({ post }: { post: PostOut }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const actions = usePostActions(post);
  const { profile, setProfile } = useProfile(post.author.username);

  const [downloading, setDownloading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { ref: patternRef, cellSize } = useCellSize(Math.max(post.pattern.width, post.pattern.height), 48);

  const isAuthor = Boolean(user && user.username === post.author.username);

  const downloadPng = async () => {
    setDownloading(true);
    try {
      let blob: Blob;
      try {
        blob = await api.exportPattern(post.pattern, "png");
      } catch {
        // La exportación es de P2; si aún no está lista, la pintamos en el navegador.
        blob = await patternToPngBlob(post.pattern);
      }
      downloadBlob(blob, `${fileSlug(post.title)}.png`);
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo descargar el PNG."));
    } finally {
      setDownloading(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      if (!MOCKS) await api.deletePost(post.id);
      toast.success("Patrón eliminado");
      navigate("/");
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo eliminar el patrón."));
      setDeleting(false);
    }
  };

  return (
    <article className="mx-auto w-full max-w-4xl">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver al feed
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
        <div className="rounded-3xl border border-line bg-white p-3 shadow-card">
          <div className="flex items-center justify-center rounded-2xl bg-paper p-3">
            <div ref={patternRef} className="w-full max-w-[560px]">
              <PatternCanvas pattern={post.pattern} cellSize={cellSize} showGrid className="block" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-1 pt-3 text-xs text-ink-soft">
            <span className="rounded-full bg-paper px-2.5 py-1 font-medium text-ink">{craftLabel(post.craft)}</span>
            <span>{patternSize(post.width, post.height, post.colors_count)}</span>
            <span aria-hidden>·</span>
            <time dateTime={post.created_at}>{relativeTime(post.created_at)}</time>
          </div>
        </div>

        <div className="space-y-4">
          <header className="space-y-3">
            <div className="flex items-center gap-2.5">
              <Link
                to={`/u/${post.author.username}`}
                className="flex min-w-0 items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              >
                <Avatar src={post.author.avatar_url} name={post.author.username} size="md" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">@{post.author.username}</span>
                  <span className="block truncate text-xs text-ink-soft">{post.author.display_name}</span>
                </span>
              </Link>
              {profile && !profile.is_me && (
                <div className="ml-auto">
                  <FollowButton
                    username={post.author.username}
                    isFollowing={profile.is_following}
                    onChange={(result) => setProfile((prev) => (prev ? { ...prev, is_following: result.following } : prev))}
                  />
                </div>
              )}
            </div>

            <h1 className="text-2xl font-bold tracking-tight">{post.title}</h1>

            {post.remix_of && (
              <p className="text-sm text-ink-soft">
                Remix de{" "}
                <Link to={`/p/${post.remix_of}`} className="font-medium text-brand hover:underline">
                  este patrón
                </Link>
              </p>
            )}
          </header>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={actions.toggleLike}
              disabled={actions.pendingLike}
              aria-pressed={actions.liked}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-60",
                actions.liked ? "border-brand/30 bg-brand-soft text-brand" : "border-line bg-white text-ink hover:bg-paper",
              )}
            >
              <Heart className={cn("size-4", actions.liked && "fill-brand")} aria-hidden />
              {formatCount(actions.likesCount)}
            </button>

            <button
              type="button"
              onClick={actions.toggleSave}
              disabled={actions.pendingSave}
              aria-pressed={actions.saved}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-60",
                actions.saved ? "border-ink/20 bg-ink text-white" : "border-line bg-white text-ink hover:bg-paper",
              )}
            >
              <Bookmark className={cn("size-4", actions.saved && "fill-current")} aria-hidden />
              {actions.saved ? "Guardado" : "Guardar"}
            </button>

            <button
              type="button"
              onClick={downloadPng}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper disabled:opacity-60"
            >
              <Download className="size-4" aria-hidden />
              {downloading ? "Generando…" : "Descargar PNG"}
            </button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button fullWidth onClick={() => navigate(`/make/${post.id}`)}>
              <Hand className="size-4" aria-hidden />
              Hacer este patrón
            </Button>
            <Button fullWidth variant="secondary" onClick={() => navigate(`/create?remix=${post.id}`)}>
              <PencilRuler className="size-4" aria-hidden />
              Remix
            </Button>
          </div>

          {post.description && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink/90">{post.description}</p>
          )}

          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <TagChip key={tag} tag={tag} />
              ))}
            </div>
          )}

          <div className="border-t border-line pt-4">
            <CommentsSection postId={post.id} />
          </div>

          {isAuthor && (
            <div className="border-t border-line pt-4">
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <Trash2 className="size-4" aria-hidden />
                Eliminar patrón
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="¿Eliminar este patrón?"
        description="Se borrarán también sus likes y comentarios."
        confirmLabel="Eliminar"
        danger
        loading={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </article>
  );
}
