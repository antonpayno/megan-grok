// Publicaciones guardadas en el navegador.
// Respaldo para poder probar el flujo completo (publicar -> ver -> hacer) mientras
// el backend social (P3) todavía devuelve 501. No sustituye a la API: se usa solo si falla.
import type { PostOut } from "../../api/types";
import { mockUser } from "../../api/mocks";

const KEY = "pp_local_posts_v1";
const FIRST_ID = 900;

export interface LocalPost {
  id: number;
  title: string;
  description: string;
  tags: string[];
  pattern: PostOut["pattern"];
  remix_of: number | null;
  created_at: string;
}

export function listLocalPosts(): LocalPost[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as LocalPost[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(posts: LocalPost[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(posts));
  } catch {
    /* cuota llena */
  }
}

export function saveLocalPost(data: Omit<LocalPost, "id" | "created_at">): LocalPost {
  const posts = listLocalPosts();
  const id = posts.reduce((max, p) => Math.max(max, p.id), FIRST_ID) + 1;
  const post: LocalPost = { ...data, id, created_at: new Date().toISOString() };
  persist([post, ...posts].slice(0, 50));
  return post;
}

export function getLocalPost(id: number): LocalPost | null {
  return listLocalPosts().find((p) => p.id === id) ?? null;
}

/** Convierte un post local al formato del contrato para reutilizar las pantallas. */
export function toPostOut(post: LocalPost): PostOut {
  return {
    id: post.id,
    author: mockUser,
    title: post.title,
    description: post.description,
    craft: post.pattern.craft,
    tags: post.tags,
    pattern: post.pattern,
    width: post.pattern.width,
    height: post.pattern.height,
    colors_count: post.pattern.palette.length,
    likes_count: 0,
    comments_count: 0,
    liked_by_me: false,
    saved_by_me: false,
    remix_of: post.remix_of,
    created_at: post.created_at,
  };
}
