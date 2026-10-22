import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import type { UserProfile } from "../../api/types";

/** Carga el perfil de un usuario contra la API. */
export function useProfile(username: string | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    if (!username) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const request = api.getProfile(username);
    request
      .then((data) => {
        if (alive) setProfile(data);
      })
      .catch((err) => {
        if (alive) setError(err);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [username, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { profile, setProfile, loading, error, reload };
}
