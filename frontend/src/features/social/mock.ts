// Modo demo: `VITE_MOCKS=1 npm run dev`. Sirve para trabajar sin backend.
// No importar mocks en producción: todas las páginas comprueban MOCKS antes.
import type { FeedPage, PostOut, SearchResults, TagCount, UserProfile } from "../../api/types";
import { mockPost, mockUser } from "../../api/mocks";

export const MOCKS = import.meta.env.VITE_MOCKS === "1";

/** Variedad de demo para que el feed y el buscador tengan contenido realista. */
const DEMO_POSTS = [
  { title: "Gato kawaii", tags: ["gato", "animales", "kawaii"], craft: "hama" as const },
  { title: "Corazón pixelado", tags: ["corazon", "san valentin"], craft: "cross_stitch" as const },
  { title: "Pokeball", tags: ["pokemon", "videojuegos"], craft: "hama" as const },
  { title: "Calabaza de Halloween", tags: ["halloween", "otono"], craft: "cross_stitch" as const },
  { title: "Ramo de flores", tags: ["flores", "primavera"], craft: "cross_stitch" as const },
  { title: "Seta pixel art", tags: ["seta", "pixelart", "otono"], craft: "hama" as const },
  { title: "Zorro naranja", tags: ["zorro", "animales"], craft: "cross_stitch" as const },
  { title: "Nube con lluvia", tags: ["clima", "pixelart"], craft: "hama" as const },
];

/** Aplica título, tags y técnica de demo a un post base. */
function decorate(post: PostOut, index: number): PostOut {
  const demo = DEMO_POSTS[(index - 1) % DEMO_POSTS.length];
  return {
    ...post,
    title: `${demo.title} #${index}`,
    tags: demo.tags,
    craft: demo.craft,
    pattern: { ...post.pattern, craft: demo.craft },
    description: `Patrón de ${demo.title.toLowerCase()} listo para HAMA o punto de cruz.`,
  };
}

function demoPost(index: number): PostOut {
  return decorate(mockPost(index), index);
}

/** Feed paginado de mentira (para probar el scroll infinito de verdad). */
export function mockFeedPage(mode: "explore" | "following", cursor: number | null): FeedPage {
  const pageSize = 8;
  const start = cursor ?? 0;
  if (mode === "following" && cursor === null) {
    return { items: [demoPost(101), demoPost(102)], next_cursor: null };
  }
  const items = Array.from({ length: pageSize }, (_, i) => demoPost(start + i + 1));
  const next = start + pageSize;
  return { items, next_cursor: next < 32 ? next : null };
}

export function mockFeedForProfile(username: string, cursor: number | null): FeedPage {
  const pageSize = 9;
  const start = cursor ?? 0;
  const items = Array.from({ length: pageSize }, (_, i) => demoPost(start + i + 1)).map((post) => ({
    ...post,
    author: { ...mockUser, username },
  }));
  const next = start + pageSize;
  return { items, next_cursor: next < 27 ? next : null };
}

export function mockProfile(username: string): UserProfile {
  const isMe = username === mockUser.username;
  return {
    ...mockUser,
    username,
    display_name: isMe ? mockUser.display_name : titleCase(username),
    bio: isMe ? "Hago patrones de HAMA y punto de cruz 🧩" : "Patrones pequeños, ratos largos.",
    created_at: "2026-10-01T10:00:00Z",
    followers_count: 128,
    following_count: 42,
    posts_count: 27,
    is_following: false,
    is_me: isMe,
  };
}

export function mockUserList(count = 6) {
  return Array.from({ length: count }, (_, i) => ({
    ...mockUser,
    id: 1000 + i,
    username: `amig${String.fromCharCode(97 + i)}_${i + 1}`,
    display_name: `Amig${String.fromCharCode(97 + i)} ${i + 1}`,
  }));
}

export function mockSearch(q: string): SearchResults {
  const term = normalize(q.replace(/^[#@]+/, ""));
  const all = Array.from({ length: 24 }, (_, i) => demoPost(i + 1));

  const posts = all.filter(
    (post) =>
      normalize(post.title).includes(term) ||
      post.tags.some((tag) => normalize(tag).includes(term)) ||
      normalize(post.author.username).includes(term),
  );
  const users = [mockUser, ...mockUserList(4)].filter((user) => normalize(user.username).includes(term));

  const tagCounts = new Map<string, number>();
  for (const post of all) for (const tag of post.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  const tags = [...tagCounts.entries()]
    .filter(([tag]) => normalize(tag).includes(term) || posts.some((post) => post.tags.includes(tag)))
    .map(([tag, count]) => ({ tag, count }));

  return { users: term ? users : [], posts, tags: term ? tags : [] };
}

export function mockTrendingTags(): TagCount[] {
  return [
    { tag: "gato", count: 128 },
    { tag: "corazon", count: 96 },
    { tag: "pokemon", count: 71 },
    { tag: "pixelart", count: 54 },
    { tag: "halloween", count: 41 },
    { tag: "flores", count: 33 },
  ];
}

export function mockPostById(id: number): PostOut {
  return { ...demoPost(id), remix_of: id % 4 === 0 ? id - 1 : null };
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/** Sin acentos y en minúsculas, como lo hace el backend. */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
