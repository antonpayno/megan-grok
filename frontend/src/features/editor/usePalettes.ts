// Paletas completas (Hama / DMC). Intenta el backend de P2 y, si aún no está,
// usa las paletas locales de fallbackPalette.ts sin romper la UI.
import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import type { Craft, Palette, PaletteColor } from "../../api/types";
import { FALLBACK_PALETTES, fallbackPaletteFor, fallbackPaletteIdFor } from "./fallbackPalette";

export interface PalettesState {
  palettes: Palette[];
  colorsFor: (craft: Craft) => PaletteColor[];
  paletteIdFor: (craft: Craft) => string;
  source: "backend" | "local";
  loading: boolean;
}

export function usePalettes(): PalettesState {
  const [palettes, setPalettes] = useState<Palette[]>(FALLBACK_PALETTES);
  const [source, setSource] = useState<"backend" | "local">("local");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api
      .palettes()
      .then((list) => {
        if (!alive) return;
        const valid = Array.isArray(list) ? list.filter((p) => p && Array.isArray(p.colors) && p.colors.length) : [];
        if (valid.length) {
          setPalettes(valid);
          setSource("backend");
        }
      })
      .catch(() => {
        /* P2 aún no responde: nos quedamos con las paletas locales */
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const colorsFor = useCallback(
    (craft: Craft) => palettes.find((p) => p.craft === craft)?.colors ?? fallbackPaletteFor(craft),
    [palettes],
  );

  const paletteIdFor = useCallback(
    (craft: Craft) => palettes.find((p) => p.craft === craft)?.id ?? fallbackPaletteIdFor(craft),
    [palettes],
  );

  return { palettes, colorsFor, paletteIdFor, source, loading };
}
