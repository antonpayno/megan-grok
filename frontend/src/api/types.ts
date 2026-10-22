// CONTRATO DE LA API — espejo de backend/app/schemas.py.
// ARCHIVO COMPARTIDO: si cambias algo, cambia también schemas.py en el MISMO commit y avisa.

export type Craft = "hama" | "cross_stitch";

export const MAX_PATTERN_SIDE = 128;
export const MAX_PALETTE_COLORS = 64;

// ---------- Patrón ----------
export interface PaletteColor {
  id: string; // código del fabricante: "H01", "310"…
  name: string;
  hex: string; // "#RRGGBB"
  symbol?: string | null; // símbolo para punto de cruz
}

export interface PatternData {
  craft: Craft;
  width: number;
  height: number;
  palette: PaletteColor[];
  /** Row-major: cells[y * width + x] = índice en palette, -1 = vacío */
  cells: number[];
}

export interface Palette {
  id: string; // "hama_midi" | "dmc" | …
  name: string;
  craft: Craft;
  colors: PaletteColor[];
}

export interface ConvertOptions {
  craft: Craft;
  width: number; // 4..128
  max_colors: number; // 2..64
  simplify: 0 | 1 | 2 | 3;
  outline?: boolean;
  remove_background?: boolean;
  palette_id?: string;
}

// ---------- Usuarios ----------
export interface UserPublic {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

export interface UserProfile extends UserPublic {
  bio: string;
  created_at: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
  is_following: boolean;
  is_me: boolean;
}

export interface TokenOut {
  access_token: string;
  token_type: "bearer";
  user: UserPublic;
}

export interface UserUpdate {
  display_name?: string;
  bio?: string;
  avatar_url?: string | null;
}

export interface FollowOut {
  following: boolean;
  followers_count: number;
}

// ---------- Posts ----------
export interface PostCreate {
  title: string;
  description?: string;
  tags?: string[];
  pattern: PatternData;
  remix_of?: number | null;
}

export interface PostOut {
  id: number;
  author: UserPublic;
  title: string;
  description: string;
  craft: Craft;
  tags: string[];
  pattern: PatternData;
  width: number;
  height: number;
  colors_count: number;
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
  saved_by_me: boolean;
  remix_of: number | null;
  created_at: string;
}

export interface FeedPage {
  items: PostOut[];
  next_cursor: number | null;
}

export interface LikeOut {
  liked: boolean;
  likes_count: number;
}

export interface SaveOut {
  saved: boolean;
}

export interface CommentOut {
  id: number;
  author: UserPublic;
  text: string;
  created_at: string;
}

// ---------- Búsqueda ----------
export interface TagCount {
  tag: string;
  count: number;
}

export interface SearchResults {
  users: UserPublic[];
  posts: PostOut[];
  tags: TagCount[];
}
