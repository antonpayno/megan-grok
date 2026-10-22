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
        "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset",
        craft === "hama"
          ? "bg-lavender text-ink ring-lavender"
          : "bg-mint text-ink ring-mint",
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
          className="flex min-w-0 items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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

      <Link to={`/p/${post.id}`} className="mt-2.5 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
        <PatternThumb pattern={post.pattern} ariaLabel={`Miniatura del patrón ${post.title}`} />
      </Link>

      <div className="px-3.5 pb-3.5 pt-2.5">
        <Link
          to={`/p/${post.id}`}
          className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug">{post.title}</h3>
        </Link>

        <div className="mt-1 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-xs text-ink-soft">
            {patternSize(post.width, post.height, post.colors_count)}
          </p>
          <span className="flex shrink-0 -space-x-1" aria-hidden>
            {post.pattern.palette.slice(0, 6).map((color, index) => (
              <span
                key={`${color.id}-${index}`}
                className="size-3 rounded-full border border-white ring-1 ring-line"
                style={{ backgroundColor: color.hex }}
              />
            ))}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-1">
          <button
            type="button"
            onClick={actions.toggleLike}
            disabled={actions.pendingLike}
            aria-pressed={actions.liked}
            aria-label={`${actions.liked ? "Quitar me gusta" : "Me gusta"} (${formatCount(actions.likesCount)})`}
            className="flex min-h-9 items-center gap-1.5 rounded-full px-2 text-sm transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
          >
            <Heart
              className={cn("size-5 transition-transform", actions.liked ? "scale-110 fill-brand text-brand-dark" : "text-ink")}
              aria-hidden
            />
            <span className={cn("text-xs font-medium", actions.liked ? "text-brand-dark" : "text-ink-soft")}>
              {formatCount(actions.likesCount)}
            </span>
          </button>

          <Link
            to={`/p/${post.id}#comentarios`}
            aria-label={`Ver comentarios (${formatCount(post.comments_count)}) de ${post.title}`}
            className="flex min-h-9 items-center gap-1.5 rounded-full px-2 text-sm transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
            className="ml-auto grid size-9 place-items-center rounded-full transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
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
