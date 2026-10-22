// Datos falsos para trabajar en el frontend ANTES de que el backend esté listo.
// Úsalos así:  const posts = import.meta.env.VITE_MOCKS ? mockFeed() : await api.feed(...)
// (arranca con `VITE_MOCKS=1 npm run dev`). Cuando el backend funcione, quita el mock.
import type { FeedPage, PatternData, PostOut, UserPublic } from "./types";

export const mockUser: UserPublic = { id: 1, username: "ana_hama", display_name: "Ana", avatar_url: null };

/** Corazón 9x8 de ejemplo. */
export function mockPattern(craft: PatternData["craft"] = "hama"): PatternData {
  const rows = [
    ".RR...RR.",
    "RRRR.RRRR",
    "RRWRRRRRR",
    "RRRRRRRRR",
    ".RRRRRRR.",
    "..RRRRR..",
    "...RRR...",
    "....R....",
  ];
  const map: Record<string, number> = { ".": -1, R: 0, W: 1 };
  return {
    craft,
    width: 9,
    height: rows.length,
    palette: [
      { id: "H05", name: "Rojo", hex: "#D7263D", symbol: "X" },
      { id: "H01", name: "Blanco", hex: "#FFFFFF", symbol: "O" },
    ],
    cells: rows.flatMap((r) => [...r].map((ch) => map[ch])),
  };
}

export function mockPost(id: number): PostOut {
  const craft = id % 2 ? "hama" : "cross_stitch";
  return {
    id,
    author: mockUser,
    title: `Corazón #${id}`,
    description: "Patrón de prueba",
    craft,
    tags: ["corazon", "san valentin"],
    pattern: mockPattern(craft),
    width: 9,
    height: 8,
    colors_count: 2,
    likes_count: id * 3,
    comments_count: id,
    liked_by_me: false,
    saved_by_me: false,
    remix_of: null,
    created_at: new Date().toISOString(),
  };
}

export function mockFeed(n = 12): FeedPage {
  return { items: Array.from({ length: n }, (_, i) => mockPost(i + 1)), next_cursor: null };
}
