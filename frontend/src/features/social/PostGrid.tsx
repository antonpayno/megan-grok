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
          className="group relative block overflow-hidden rounded-lg border border-line/70 bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
        >
          <PatternThumb pattern={post.pattern} padding="p-1.5" />
          <div className="absolute inset-0 flex items-center justify-center gap-3 bg-ink/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
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
