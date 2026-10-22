import { Bookmark, Hand, Heart, MessageCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import type { PostOut } from "../../api/types";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { cn } from "../../components/ui/cn";
import { craftLabel, formatCount, patternSize, relativeTime } from "./format";
import { PatternThumb } from "./PatternThumb";
import { usePostActions } from "./usePostActions";

export function CraftBadge({ craft, className }: { craft: PostOut["craft"]; className?: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        craft === "hama" ? "bg-amber-100 text-amber-800" : "bg-violet-100 text-violet-800",
        className,
      )}
    >
      {craftLabel(craft)}
    </span>
  );
}

/** Tarjeta del feed: cabecera, miniatura, datos y acciones. */
export function PostCard({ post }: { post: PostOut }) {
  const navigate = useNavigate();
  const actions = usePostActions(post);

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <header className="flex items-center gap-2 px-3.5 pt-3">
        <Link
          to={`/u/${post.author.username}`}
          className="flex min-w-0 items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <Avatar src={post.author.avatar_url} name={post.author.username} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold leading-tight">@{post.author.username}</span>
            <span className="block truncate text-xs text-ink-soft">
              {post.author.display_name} · {relativeTime(post.created_at)}
            </span>
          </span>
        </Link>
        <CraftBadge craft={post.craft} className="ml-auto" />
      </header>

      <Link to={`/p/${post.id}`} className="mt-2.5 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
        <PatternThumb pattern={post.pattern} />
      </Link>

      <div className="px-3.5 pb-3.5 pt-2.5">
        <Link to={`/p/${post.id}`} className="block">
          <h3 className="truncate text-[15px] font-semibold leading-snug">{post.title}</h3>
        </Link>
        <p className="mt-0.5 text-xs text-ink-soft">{patternSize(post.width, post.height, post.colors_count)}</p>

        <div className="mt-2 flex items-center gap-1">
          <button
            type="button"
            onClick={actions.toggleLike}
            disabled={actions.pendingLike}
            aria-pressed={actions.liked}
            aria-label={actions.liked ? "Quitar me gusta" : "Me gusta"}
            className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm transition-colors hover:bg-brand-soft disabled:opacity-60"
          >
            <Heart
              className={cn("size-5 transition-transform", actions.liked ? "scale-110 fill-brand text-brand" : "text-ink")}
              aria-hidden
            />
            <span className={cn("text-xs font-medium", actions.liked ? "text-brand" : "text-ink-soft")}>
              {formatCount(actions.likesCount)}
            </span>
          </button>

          <Link
            to={`/p/${post.id}#comentarios`}
            aria-label="Ver comentarios"
            className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm transition-colors hover:bg-paper"
          >
            <MessageCircle className="size-5" aria-hidden />
            <span className="text-xs font-medium text-ink-soft">{formatCount(post.comments_count)}</span>
          </Link>

          <button
            type="button"
            onClick={actions.toggleSave}
            disabled={actions.pendingSave}
            aria-pressed={actions.saved}
            aria-label={actions.saved ? "Quitar de guardados" : "Guardar"}
            className="ml-auto rounded-full p-2 transition-colors hover:bg-paper disabled:opacity-60"
          >
            <Bookmark className={cn("size-5", actions.saved ? "fill-ink text-ink" : "text-ink")} aria-hidden />
          </button>
        </div>

        <Button size="sm" fullWidth className="mt-2.5" onClick={() => navigate(`/make/${post.id}`)}>
          <Hand className="size-4" aria-hidden />
          Hacerlo
        </Button>
      </div>
    </article>
  );
}
