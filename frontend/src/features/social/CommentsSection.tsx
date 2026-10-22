import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MessageCircle, Send } from "lucide-react";
import { api } from "../../api/client";
import type { CommentOut } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { toast } from "../../components/ui/Toast";
import { errorMessage, relativeTime } from "./format";
import { MOCKS } from "./mock";

export interface CommentsSectionProps {
  postId: number;
  /** Avisa al padre para actualizar el contador. */
  onCountChange?: (count: number) => void;
}

/** Lista + formulario de comentarios. Sin sesión invita a entrar. */
export function CommentsSection({ postId, onCountChange }: CommentsSectionProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [comments, setComments] = useState<CommentOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    setComments(null);
    setError(null);

    const load = MOCKS ? Promise.resolve(fakeComments(postId)) : api.comments(postId);
    load
      .then((list) => {
        if (!alive) return;
        setComments(list);
        onCountChange?.(list.length);
      })
      .catch((err) => {
        if (alive) setError(errorMessage(err, "No se pudieron cargar los comentarios."));
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      const next = encodeURIComponent(`${location.pathname}${location.search}`);
      navigate(`/login?next=${next}`);
      return;
    }
    const value = text.trim();
    if (!value || sending) return;

    setSending(true);
    try {
      const comment: CommentOut = MOCKS
        ? {
            id: Date.now(),
            author: { id: user.id, username: user.username, display_name: user.display_name, avatar_url: user.avatar_url },
            text: value,
            created_at: new Date().toISOString(),
          }
        : await api.addComment(postId, value);

      setComments((prev) => {
        const list = prev ? [...prev, comment] : [comment];
        return list;
      });
      onCountChange?.((comments?.length ?? 0) + 1);
      setText("");
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo publicar el comentario."));
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="comentarios" aria-label="Comentarios" className="scroll-mt-24">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <MessageCircle className="size-4" aria-hidden />
        Comentarios
        {comments && <span className="font-normal text-ink-soft">({comments.length})</span>}
      </h2>

      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : comments === null ? (
        <div className="mt-3 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-2.5">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-9 flex-1 rounded-xl" />
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="size-6" />}
          title="Todavía no hay comentarios"
          description="Sé la primera persona en comentar este patrón."
          className="py-8"
        />
      ) : (
        <ul className="mt-3 divide-y divide-line/70">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-2.5 py-3">
              <Avatar src={comment.author.avatar_url} name={comment.author.username} size="xs" />
              <div className="min-w-0">
                <p className="text-sm">
                  <span className="font-semibold">@{comment.author.username}</span>{" "}
                  <span className="text-xs text-ink-soft">{relativeTime(comment.created_at)}</span>
                </p>
                <p className="mt-0.5 break-words text-sm text-ink/90">{comment.text}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="mt-3 flex items-end gap-2">
        <label htmlFor="comment-text" className="sr-only">
          Escribe un comentario
        </label>
        <input
          id="comment-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder={user ? "Escribe un comentario…" : "Entra para comentar"}
          className="h-10 flex-1 rounded-full border border-line bg-white px-4 text-sm placeholder:text-ink-soft/70 focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <Button type="submit" size="icon" aria-label="Enviar comentario" loading={sending} disabled={!text.trim()}>
          <Send className="size-4" aria-hidden />
        </Button>
      </form>
    </section>
  );
}

function fakeComments(postId: number): CommentOut[] {
  if (postId % 3 === 0) return [];
  return [
    {
      id: 1,
      author: { id: 2, username: "lucia_cross", display_name: "Lucía", avatar_url: null },
      text: "¡Qué chulo! ¿Cuántos colores has usado?",
      created_at: new Date(Date.now() - 3_600_000).toISOString(),
    },
    {
      id: 2,
      author: { id: 3, username: "mario_hama", display_name: "Mario", avatar_url: null },
      text: "Me lo guardo para el finde 😍",
      created_at: new Date(Date.now() - 86_400_000).toISOString(),
    },
  ];
}
