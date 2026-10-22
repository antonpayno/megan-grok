import { useEffect } from "react";

const BASE_TITLE = "Pixel Pattern";

/** Título de la pestaña por página. */
export function usePageTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title]);
}
