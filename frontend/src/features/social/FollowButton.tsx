import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { FollowOut } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/ui/Button";
import { toast } from "../../components/ui/Toast";
import { errorMessage } from "./format";

export interface FollowButtonProps {
  username: string;
  isFollowing: boolean;
  onChange?: (result: FollowOut) => void;
  size?: "sm" | "md";
}

/** Seguir / siguiendo, optimista y con redirección a login si no hay sesión. */
export function FollowButton({ username, isFollowing, onChange, size = "sm" }: FollowButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [following, setFollowing] = useState(isFollowing);
  const [pending, setPending] = useState(false);

  const isMe = user?.username === username;

  useEffect(() => {
    setFollowing(isFollowing);
  }, [isFollowing, username]);

  const toggle = async () => {
    if (!user) {
      const next = encodeURIComponent(`${location.pathname}${location.search}`);
      navigate(`/login?next=${next}`);
      return;
    }
    if (pending || isMe) return;

    const next = !following;
    setFollowing(next);
    setPending(true);
    try {
      const result: FollowOut = next ? await api.follow(username) : await api.unfollow(username);
      setFollowing(result.following);
      onChange?.(result);
    } catch (err) {
      setFollowing(!next);
      toast.error(errorMessage(err, "No se pudo actualizar el seguimiento."));
    } finally {
      setPending(false);
    }
  };

  if (isMe) return null;

  return (
    <Button
      size={size}
      variant={following ? "secondary" : "primary"}
      onClick={toggle}
      loading={pending}
      aria-pressed={following}
    >
      {following ? "Siguiendo" : "Seguir"}
    </Button>
  );
}

