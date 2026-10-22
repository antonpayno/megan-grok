// Cliente HTTP. ARCHIVO COMPARTIDO: ya tiene TODOS los endpoints del contrato.
// Usa siempre `api.xxx()` en vez de hacer fetch a mano.
import type {
  CommentOut, ConvertOptions, Craft, FeedPage, FollowOut, LikeOut, Palette,
  PatternData, PostCreate, PostOut, SaveOut, SearchResults, TagCount, TokenOut,
  UserProfile, UserPublic, UserUpdate,
} from "./types";

const TOKEN_KEY = "pp_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

function qs(params?: Query): string {
  if (!params) return "";
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : "";
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`/api${path}${qs(query)}`, { method, headers, body: payload });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch { /* cuerpo no JSON */ }
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  return (ct.includes("application/json") ? res.json() : res.blob()) as Promise<T>;
}

const u = encodeURIComponent;

export const api = {
  // ---- Auth / usuarios (backend: Persona 1) ----
  register: (d: { username: string; email: string; password: string; display_name?: string }) =>
    request<TokenOut>("POST", "/auth/register", d),
  login: (username_or_email: string, password: string) =>
    request<TokenOut>("POST", "/auth/login", { username_or_email, password }),
  me: () => request<UserPublic>("GET", "/auth/me"),
  getProfile: (username: string) => request<UserProfile>("GET", `/users/${u(username)}`),
  updateMe: (d: UserUpdate) => request<UserProfile>("PATCH", "/users/me", d),
  uploadAvatar: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<UserProfile>("POST", "/users/me/avatar", fd);
  },
  follow: (username: string) => request<FollowOut>("POST", `/users/${u(username)}/follow`),
  unfollow: (username: string) => request<FollowOut>("DELETE", `/users/${u(username)}/follow`),
  followers: (username: string) => request<UserPublic[]>("GET", `/users/${u(username)}/followers`),
  following: (username: string) => request<UserPublic[]>("GET", `/users/${u(username)}/following`),

  // ---- Patrones (backend: Persona 2) ----
  palettes: () => request<Palette[]>("GET", "/palettes"),
  convertImage: (file: Blob, opts: ConvertOptions) => {
    const fd = new FormData();
    fd.append("file", file);
    for (const [k, v] of Object.entries(opts)) if (v !== undefined) fd.append(k, String(v));
    return request<PatternData>("POST", "/patterns/convert", fd);
  },
  exportPattern: (pattern: PatternData, format: "png" | "pdf") =>
    request<Blob>("POST", "/patterns/export", pattern, { format }),

  // ---- Posts / feed (backend: Persona 3) ----
  feed: (mode: "explore" | "following", cursor?: number | null) =>
    request<FeedPage>("GET", "/posts/feed", undefined, { mode, cursor }),
  listPosts: (f: { author?: string; tag?: string; craft?: Craft; cursor?: number | null }) =>
    request<FeedPage>("GET", "/posts", undefined, f),
  savedPosts: (cursor?: number | null) => request<FeedPage>("GET", "/posts/saved", undefined, { cursor }),
  getPost: (id: number) => request<PostOut>("GET", `/posts/${id}`),
  createPost: (d: PostCreate) => request<PostOut>("POST", "/posts", d),
  deletePost: (id: number) => request<void>("DELETE", `/posts/${id}`),
  like: (id: number) => request<LikeOut>("POST", `/posts/${id}/like`),
  unlike: (id: number) => request<LikeOut>("DELETE", `/posts/${id}/like`),
  save: (id: number) => request<SaveOut>("POST", `/posts/${id}/save`),
  unsave: (id: number) => request<SaveOut>("DELETE", `/posts/${id}/save`),
  comments: (id: number) => request<CommentOut[]>("GET", `/posts/${id}/comments`),
  addComment: (id: number, text: string) => request<CommentOut>("POST", `/posts/${id}/comments`, { text }),

  // ---- Búsqueda (backend: Persona 3) ----
  search: (q: string, type: "all" | "users" | "posts" = "all", craft?: Craft) =>
    request<SearchResults>("GET", "/search", undefined, { q, type, craft }),
  trendingTags: () => request<TagCount[]>("GET", "/search/tags/trending"),
};

/** Descarga un Blob como archivo (para export PNG/PDF). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
