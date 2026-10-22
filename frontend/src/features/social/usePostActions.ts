import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { PostOut } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { toast } from "../../components/ui/Toast";
import { errorMessage } from "./format";

export interface PostActions {
  liked: boolean;
  likesCount: number;
  saved: boolean;
  pendingLike: boolean;
  pendingSave: boolean;
  isMine: boolean;
  toggleLike: () => Promise<void>;
  toggleSave: () => Promise<void>;
}

/**
 * Like y guardado optimistas: pintan al instante y revierten si la API falla.
 * Sin sesión redirige a /login?next=… (nunca falla en silencio).
 */
export function usePostActions(post: PostOut): PostActions {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [liked, setLiked] = useState(post.liked_by_me);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [saved, setSaved] = useState(post.saved_by_me);
  const [pendingLike, setPendingLike] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);

  useEffect(() => {
    setLiked(post.liked_by_me);
    setLikesCount(post.likes_count);
    setSaved(post.saved_by_me);
  }, [post.id, post.liked_by_me, post.likes_count, post.saved_by_me]);

  const isMine = Boolean(user && user.username === post.author.username);

  const goToLogin = () => {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    navigate(`/login?next=${next}`);
  };

  const toggleLike = async () => {
    if (pendingLike) return;
    if (!user) return goToLogin();

    const next = !liked;
    setLiked(next);
    setLikesCount((n) => Math.max(0, n + (next ? 1 : -1)));
    setPendingLike(true);
    try {
      const result = next ? await api.like(post.id) : await api.unlike(post.id);
      setLiked(result.liked);
      setLikesCount(result.likes_count);
    } catch (err) {
      setLiked(!next);
      setLikesCount((n) => Math.max(0, n + (next ? -1 : 1)));
      toast.error(errorMessage(err, "No se pudo actualizar el like."));
    } finally {
      setPendingLike(false);
    }
  };

  const toggleSave = async () => {
    if (pendingSave) return;
    if (!user) return goToLogin();

    const next = !saved;
    setSaved(next);
    setPendingSave(true);
    try {
      const result = next ? await api.save(post.id) : await api.unsave(post.id);
      setSaved(result.saved);
      toast.success(next ? "Guardado en tu colección" : "Quitado de guardados");
    } catch (err) {
      setSaved(!next);
      toast.error(errorMessage(err, "No se pudo actualizar el guardado."));
    } finally {
      setPendingSave(false);
    }
  };

  return { liked, likesCount, saved, pendingLike, pendingSave, isMine, toggleLike, toggleSave };
}
