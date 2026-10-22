// PROPIETARIO: Persona 5. Barra superior (escritorio) + barra inferior (móvil).
import { useEffect, useLayoutEffect, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bookmark,
  Grid2x2,
  Home,
  LogIn,
  LogOut,
  Plus,
  Search,
  User,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "../components/ui/Avatar";
import { ButtonLink } from "../components/ui/ButtonLink";
import { cn } from "../components/ui/cn";
import { Dropdown, DropdownItem } from "../components/ui/Dropdown";
import { Toaster } from "../components/ui/Toast";

export default function Layout() {
  const { user, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [quickQuery, setQuickQuery] = useState("");

  useAppHead();
  useCloseOnNavigate(location.pathname);
  useFallbackTitle(location.pathname);

  const submitQuickSearch = (event: FormEvent) => {
    event.preventDefault();
    const q = quickQuery.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
    setQuickQuery("");
  };

  const profileHref = user ? `/u/${user.username}` : "/login";
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";

  const bottomTabs = [
    { to: "/", label: "Inicio", icon: Home, end: true },
    { to: "/search", label: "Buscar", icon: Search, end: false },
    { to: "/create", label: "Crear", icon: Plus, end: false, accent: true },
    { to: profileHref, label: user ? "Perfil" : "Entrar", icon: user ? User : LogIn, end: false },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-3 sm:h-16 sm:px-6">
          <Link
            to="/"
            aria-label="Pixel Pattern, ir al inicio"
            className="flex shrink-0 items-center gap-2 rounded-xl text-[16px] font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:text-[17px]"
          >
            <span className="grid size-8 place-items-center rounded-xl bg-brand text-white shadow-sm" aria-hidden>
              <Grid2x2 className="size-4" />
            </span>
            <span>Pixel Pattern</span>
          </Link>

          <form onSubmit={submitQuickSearch} className="ml-auto hidden w-full max-w-xs sm:block" role="search">
            <label htmlFor="quick-search" className="sr-only">
              Buscar en Pixel Pattern
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
              <input
                id="quick-search"
                value={quickQuery}
                onChange={(e) => setQuickQuery(e.target.value)}
                placeholder="Buscar personas, patrones o #tags"
                className="h-10 w-full rounded-full border border-line bg-white pl-9 pr-3 text-sm placeholder:text-ink-soft/80 focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            <span className="hidden sm:block">
              <ButtonLink to="/create" size="sm">
                <Plus className="size-4" aria-hidden />
                Crear
              </ButtonLink>
            </span>

            {authLoading ? (
              <span
                aria-hidden
                className="skeleton-shimmer block size-9 rounded-full"
              />
            ) : user ? (
              <Dropdown
                label="Menú de cuenta"
                trigger={({ open, toggle }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    aria-label="Abrir menú de cuenta"
                    className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <Avatar src={user.avatar_url} name={user.username} size="sm" />
                  </button>
                )}
              >
                {(close) => (
                  <>
                    <div className="border-b border-line px-4 py-3">
                      <p className="truncate text-sm font-semibold">@{user.username}</p>
                      <p className="truncate text-xs text-ink-soft">{user.display_name}</p>
                    </div>
                    <DropdownItem
                      icon={<User className="size-4" />}
                      onClick={() => {
                        close();
                        navigate(`/u/${user.username}`);
                      }}
                    >
                      Mi perfil
                    </DropdownItem>
                    <DropdownItem
                      icon={<Bookmark className="size-4" />}
                      onClick={() => {
                        close();
                        navigate(`/u/${user.username}?tab=saved`);
                      }}
                    >
                      Guardados
                    </DropdownItem>
                    <DropdownItem
                      danger
                      icon={<LogOut className="size-4" />}
                      onClick={() => {
                        close();
                        logout();
                        navigate("/");
                      }}
                    >
                      Salir
                    </DropdownItem>
                  </>
                )}
              </Dropdown>
            ) : !isAuthPage ? (
              <ButtonLink to="/login" size="sm" variant="secondary">
                Entrar
              </ButtonLink>
            ) : null}
          </div>
        </div>
      </header>

      <main
        id="contenido"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-3 pb-24 pt-4 focus:outline-none sm:px-6 sm:pb-10 sm:pt-6"
      >
        <Outlet />
      </main>

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_-16px_rgba(31,29,43,0.35)] backdrop-blur-md sm:hidden"
      >
        <ul className="mx-auto flex max-w-md items-stretch">
          {bottomTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <li key={tab.label} className="flex-1">
                <NavLink
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    cn(
                      "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors",
                      isActive ? "text-brand" : "text-ink-soft hover:text-ink",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          "grid size-9 place-items-center rounded-full transition-colors",
                          tab.accent && "bg-brand text-white shadow-sm",
                          !tab.accent && isActive && "bg-brand-soft",
                        )}
                      >
                        <Icon className="size-5" aria-hidden />
                      </span>
                      {tab.label}
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <Toaster />
    </div>
  );
}

/** Favicon, color de tema y descripción (no se toca index.html: es compartido). */
function useAppHead() {
  useLayoutEffect(() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#d02a50"/>
      <g fill="#fff">
        <rect x="6" y="8" width="6" height="6"/><rect x="20" y="8" width="6" height="6"/>
        <rect x="6" y="14" width="6" height="6"/><rect x="20" y="14" width="6" height="6"/>
        <rect x="12" y="14" width="8" height="6"/><rect x="12" y="20" width="8" height="6"/>
      </g>
    </svg>`;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.type = "image/svg+xml";
    link.setAttribute("sizes", "any");
    link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;

    let theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!theme) {
      theme = document.createElement("meta");
      theme.name = "theme-color";
      document.head.appendChild(theme);
    }
    theme.content = "#fbf8f4";

    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!description) {
      description = document.createElement("meta");
      description.name = "description";
      document.head.appendChild(description);
    }
    description.content =
      "Pixel Pattern: crea patrones de cuentas HAMA y punto de cruz desde una foto, compártelos y haz los de la comunidad.";
  }, []);
}

/** Título para rutas que no usan `usePageTitle` (crear y hacer). */
function useFallbackTitle(pathname: string) {
  useEffect(() => {
    if (pathname === "/create") {
      document.title = "Pixel Pattern · Crear patrón";
    } else if (pathname.startsWith("/make/")) {
      document.title = "Pixel Pattern · Hacer patrón";
    } else if (pathname === "/login") {
      document.title = "Pixel Pattern · Entrar";
    } else if (pathname === "/register") {
      document.title = "Pixel Pattern · Crear cuenta";
    }
  }, [pathname]);
}

/** En móvil, al cambiar de ruta volvemos arriba. */
function useCloseOnNavigate(pathname: string) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
}
