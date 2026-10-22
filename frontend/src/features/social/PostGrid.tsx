import { Heart, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import type { PostOut } from "../../api/types";
import { formatCount } from "./format";
import { PatternThumb } from "./PatternThumb";

/** Rejilla 3 columnas tipo Instagram (perfil y búsqueda). */
export function PostGrid({ posts, emptyLabel }: { posts: PostOut[]; emptyLabel?: string }) {
  if (posts.length === 0) {
    return emptyLabel ? <p className="py-10 text-center text-sm text-ink-soft">{emptyLabel}</p> : null;
  }

  return (
    <div className="grid grid-cols-3 gap-1 sm:gap-2">
      {posts.map((post) => (
        <Link
          key={post.id}
          to={`/p/${post.id}`}
          aria-label={post.title}
          className="group relative block overflow-hidden rounded-lg border border-line/70 bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <PatternThumb pattern={post.pattern} padding="p-1.5" />
          {/* En móvil los contadores quedan siempre visibles; en escritorio aparecen al pasar. */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-gradient-to-t from-ink/75 via-ink/25 to-transparent p-1.5 pt-5 text-white sm:hidden"
          >
            <span className="flex items-center gap-1 text-xs font-semibold">
              <Heart className="size-3.5 fill-current" />
              {formatCount(post.likes_count)}
            </span>
            <span className="flex items-center gap-1 text-xs font-semibold">
              <MessageCircle className="size-3.5 fill-current" />
              {formatCount(post.comments_count)}
            </span>
          </div>
          <div className="absolute inset-0 hidden items-center justify-center gap-3 bg-ink/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:flex">
            <span className="flex items-center gap-1 text-sm font-semibold">
              <Heart className="size-4 fill-current" aria-hidden />
              {formatCount(post.likes_count)}
            </span>
            <span className="flex items-center gap-1 text-sm font-semibold">
              <MessageCircle className="size-4 fill-current" aria-hidden />
              {formatCount(post.comments_count)}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
