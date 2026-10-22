import { useEffect } from "react";

const BASE_TITLE = "Pixel Pattern";

/** Título de la pestaña por página: "Pixel Pattern · Buscar". */
export function usePageTitle(title?: string | null) {
  useEffect(() => {
    const clean = title?.trim();
    document.title = clean ? `${BASE_TITLE} · ${clean}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title]);
}
