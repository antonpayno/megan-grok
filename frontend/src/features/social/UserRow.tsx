import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { UserPublic } from "../../api/types";
import { Avatar } from "../../components/ui/Avatar";

/** Fila de usuario para listas de seguidores y resultados de búsqueda. */
export function UserRow({ user, action }: { user: UserPublic; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Link
        to={`/u/${user.username}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <Avatar src={user.avatar_url} name={user.username} size="md" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">@{user.username}</span>
          <span className="block truncate text-xs text-ink-soft">{user.display_name}</span>
        </span>
      </Link>
      {action}
    </div>
  );
}
