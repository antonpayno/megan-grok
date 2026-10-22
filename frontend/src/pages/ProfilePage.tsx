import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Bookmark, Camera, Grid3x3, Pencil, UserX } from "lucide-react";
import { api } from "../api/client";
import type { UserProfile, UserPublic } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { ButtonLink } from "../components/ui/ButtonLink";
import { EmptyState } from "../components/ui/EmptyState";
import { Input, Textarea } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Skeleton } from "../components/ui/Skeleton";
import { Spinner } from "../components/ui/Spinner";
import { Tabs } from "../components/ui/Tabs";
import { toast } from "../components/ui/Toast";
import { FollowButton } from "../features/social/FollowButton";
import { errorMessage, formatCount } from "../features/social/format";
import { PostGrid } from "../features/social/PostGrid";
import { PostGridSkeleton } from "../features/social/PostSkeletons";
import { useInfinitePosts } from "../features/social/useInfinitePosts";
import { usePageTitle } from "../features/social/usePageTitle";
import { useProfile } from "../features/social/useProfile";
import { UserRow } from "../features/social/UserRow";

type ProfileTab = "posts" | "saved";
type PeopleModal = "followers" | "following" | null;

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const { profile, setProfile, loading, error, reload } = useProfile(username);
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab: ProfileTab = searchParams.get("tab") === "saved" ? "saved" : "posts";
  const [tab, setTab] = useState<ProfileTab>(initialTab);
  const [peopleModal, setPeopleModal] = useState<PeopleModal>(null);
  const [people, setPeople] = useState<UserPublic[] | null>(null);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const isMe = Boolean(profile?.is_me || (user && profile && user.username === profile.username));

  usePageTitle(profile ? `@${profile.username}` : "Perfil");

  useEffect(() => {
    setTab(searchParams.get("tab") === "saved" ? "saved" : "posts");
  }, [searchParams]);

  // Lista de seguidores / seguidos al abrir el modal.
  useEffect(() => {
    if (!peopleModal || !profile) return;
    let alive = true;
    setPeople(null);
    setPeopleError(null);

    const request = peopleModal === "followers" ? api.followers(profile.username) : api.following(profile.username);

    request
      .then((list) => {
        if (alive) setPeople(list);
      })
      .catch((err) => {
        if (alive) setPeopleError(errorMessage(err, "No se pudo cargar la lista."));
      });

    return () => {
      alive = false;
    };
  }, [peopleModal, profile]);

  const fetchPage = useCallback(
    (cursor: number | null) => {
      if (!profile) return Promise.resolve({ items: [], next_cursor: null });
      return tab === "saved" ? api.savedPosts(cursor) : api.listPosts({ author: profile.username, cursor });
    },
    [profile, tab],
  );

  const posts = useInfinitePosts(fetchPage, [profile?.username, tab]);

  const changeTab = (next: ProfileTab) => {
    setTab(next);
    const params = new URLSearchParams(searchParams);
    if (next === "saved") params.set("tab", "saved");
    else params.delete("tab");
    setSearchParams(params, { replace: true });
  };

  const openEdit = () => {
    if (!profile) return;
    setDisplayName(profile.display_name);
    setBio(profile.bio);
    setEditing(true);
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile || saving) return;
    setSaving(true);
    try {
      const updated: UserProfile = await api.updateMe({ display_name: displayName.trim(), bio: bio.trim() });
      setProfile({ ...profile, ...updated });
      toast.success("Perfil actualizado");
      setEditing(false);
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo guardar el perfil."));
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !profile) return;
    setUploading(true);
    try {
      const updated: UserProfile = await api.uploadAvatar(file);
      setProfile({ ...profile, ...updated });
      toast.success("Avatar actualizado");
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo subir el avatar."));
    } finally {
      setUploading(false);
    }
  };

  const applyFollow = (following: boolean) => {
    setProfile((prev) => {
      if (!prev) return prev;
      const delta = prev.is_following === following ? 0 : following ? 1 : -1;
      return { ...prev, is_following: following, followers_count: Math.max(0, prev.followers_count + delta) };
    });
  };

  if (loading && !profile) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <div className="flex items-center gap-5">
          <Skeleton className="size-20 rounded-full sm:size-28" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-32 rounded-full" />
          </div>
        </div>
        <PostGridSkeleton />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <EmptyState
        icon={<UserX className="size-6" />}
        title="Usuario no encontrado"
        description={error ? errorMessage(error) : `No existe nadie con el usuario @${username}.`}
        action={
          <Button variant="secondary" onClick={reload}>
            Reintentar
          </Button>
        }
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
        <div className="relative shrink-0 self-start">
          <Avatar src={profile.avatar_url} name={profile.username} size="lg" className="sm:h-28 sm:w-28" />
          {isMe && (
            <label
              className="absolute -bottom-1 -right-1 grid size-8 cursor-pointer place-items-center rounded-full border border-line bg-white text-ink shadow-sm transition-colors hover:bg-paper focus-within:ring-2 focus-within:ring-brand"
              title="Cambiar avatar"
            >
              <Camera className="size-4" aria-hidden />
              <span className="sr-only">Cambiar avatar</span>
              <input type="file" accept="image/*" className="sr-only" onChange={uploadAvatar} disabled={uploading} />
            </label>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate text-xl font-bold tracking-tight">{profile.display_name}</h1>
            {isMe ? (
              <Button size="sm" variant="secondary" onClick={openEdit}>
                <Pencil className="size-3.5" aria-hidden />
                Editar perfil
              </Button>
            ) : (
              <FollowButton username={profile.username} isFollowing={profile.is_following} onChange={(r) => applyFollow(r.following)} />
            )}
          </div>
          <p className="text-sm text-ink-soft">@{profile.username}</p>
          {profile.bio && <p className="mt-2 max-w-prose whitespace-pre-line text-sm leading-relaxed">{profile.bio}</p>}

          <dl className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <div>
              <dt className="sr-only">Patrones</dt>
              <dd>
                <span className="font-semibold">{formatCount(profile.posts_count)}</span>{" "}
                <span className="text-ink-soft">patrones</span>
              </dd>
            </div>
            <button
              type="button"
              onClick={() => setPeopleModal("followers")}
              className="rounded-md text-left transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <span className="font-semibold">{formatCount(profile.followers_count)}</span>{" "}
              <span className="text-ink-soft">seguidores</span>
            </button>
            <button
              type="button"
              onClick={() => setPeopleModal("following")}
              className="rounded-md text-left transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <span className="font-semibold">{formatCount(profile.following_count)}</span>{" "}
              <span className="text-ink-soft">seguidos</span>
            </button>
          </dl>
        </div>
      </header>

      <Tabs
        ariaLabel="Secciones del perfil"
        className="mt-6"
        items={[
          { value: "posts", label: `Patrones (${profile.posts_count})` },
          ...(isMe ? [{ value: "saved" as const, label: "Guardados" }] : []),
        ]}
        value={tab}
        onChange={changeTab}
      />

      <div className="mt-4">
        {posts.loading ? (
          <PostGridSkeleton />
        ) : posts.error ? (
          <EmptyState
            icon={<Grid3x3 className="size-6" />}
            title="No se han podido cargar los patrones"
            description={posts.error}
            action={
              <Button variant="secondary" onClick={posts.reload}>
                Reintentar
              </Button>
            }
          />
        ) : posts.items.length === 0 ? (
          <EmptyState
            icon={tab === "saved" ? <Bookmark className="size-6" /> : <Grid3x3 className="size-6" />}
            title={tab === "saved" ? "No tienes patrones guardados" : "Todavía no hay patrones"}
            description={
              tab === "saved"
                ? "Guarda los patrones que te gusten para tenerlos a mano."
                : isMe
                  ? "Publica tu primer patrón y aparecerá aquí."
                  : "Cuando publique algo, lo verás en esta rejilla."
            }
            action={
              (tab === "saved" || isMe) && (
                <ButtonLink to={tab === "saved" ? "/" : "/create"}>
                  {tab === "saved" ? "Explorar patrones" : "Crear un patrón"}
                </ButtonLink>
              )
            }
          />
        ) : (
          <>
            <PostGrid posts={posts.items} />
            <div ref={posts.sentinelRef} aria-hidden className="h-1" />
            {posts.loadingMore && <Spinner label="Cargando más patrones…" />}
          </>
        )}
      </div>

      {/* Seguidores / seguidos */}
      <Modal
        open={peopleModal !== null}
        onClose={() => setPeopleModal(null)}
        title={peopleModal === "followers" ? "Seguidores" : "Seguidos"}
        size="sm"
      >
        {peopleError ? (
          <p role="alert" className="text-sm text-red-600">
            {peopleError}
          </p>
        ) : people === null ? (
          <div className="space-y-3 py-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <Skeleton className="h-8 flex-1" />
              </div>
            ))}
          </div>
        ) : people.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-soft">Todavía no hay nadie aquí.</p>
        ) : (
          <ul className="divide-y divide-line/70">
            {people.map((person) => (
              <li key={person.id}>
                <UserRow
                  user={person}
                  action={
                    user && user.username !== person.username ? (
                      <FollowButton username={person.username} isFollowing={false} />
                    ) : null
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {/* Editar perfil */}
      <Modal open={editing} onClose={() => setEditing(false)} title="Editar perfil">
        <form onSubmit={saveProfile} className="space-y-4">
          <Input
            label="Nombre visible"
            value={displayName}
            maxLength={50}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <Textarea
            label="Bio"
            value={bio}
            maxLength={160}
            rows={3}
            onChange={(e) => setBio(e.target.value)}
            hint={`${bio.length}/160 caracteres`}
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
