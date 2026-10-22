import { useState, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { AtSign, Grid2x2, Lock, Mail, User } from "lucide-react";
import { ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { errorMessage } from "./format";
import { usePageTitle } from "./usePageTitle";

type Mode = "login" | "register";
type Errors = Partial<Record<"identifier" | "username" | "email" | "password", string>>;

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Formulario compartido de login y registro, con validación y errores de la API visibles. */
export function AuthForm({ mode }: { mode: Mode }) {
  const { user, loading: authLoading, login, register } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));

  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  usePageTitle(mode === "login" ? "Entrar" : "Crear cuenta");

  if (!authLoading && user) return <Navigate to={next} replace />;

  const validate = (): boolean => {
    const found: Errors = {};
    if (mode === "login") {
      if (!identifier.trim()) found.identifier = "Escribe tu usuario o email.";
    } else {
      if (!USERNAME_RE.test(username.trim())) {
        found.username = "Entre 3 y 30 caracteres: letras, números o guion bajo.";
      }
      if (!EMAIL_RE.test(email.trim())) found.email = "Escribe un email válido.";
    }
    if (password.length < 8) found.password = "La contraseña debe tener al menos 8 caracteres.";
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setApiError(null);
    if (!validate() || submitting) return;

    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(identifier.trim(), password);
      } else {
        await register({
          username: username.trim(),
          email: email.trim(),
          password,
          display_name: displayName.trim() || undefined,
        });
      }
      // El <Navigate> de arriba se encarga de redirigir en cuanto cambia `user`.
    } catch (err) {
      // En login/registro el 401/409 significa credenciales o datos, no sesión caducada:
      // mostramos siempre el mensaje concreto del backend.
      setApiError(err instanceof ApiError ? err.message : errorMessage(err, "No se pudo completar la operación."));
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm py-6 sm:py-12">
      <div className="rounded-3xl border border-line bg-white p-6 shadow-card sm:p-8">
        <div className="mb-6 text-center">
          <span
            className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand text-white shadow-sm"
            aria-hidden
          >
            <Grid2x2 className="size-6" />
          </span>
          <h1 className="mt-3 text-xl font-bold tracking-tight">
            {mode === "login" ? "Entra en Pixel Pattern" : "Crea tu cuenta"}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {mode === "login"
              ? "Guarda tus patrones favoritos y comparte los tuyos."
              : "Publica tus patrones y descubre los de la comunidad."}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4" noValidate>
          {mode === "login" ? (
            <Input
              name="identifier"
              label="Usuario o email"
              autoComplete="username"
              autoFocus
              icon={<AtSign className="size-4" />}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              error={errors.identifier}
              placeholder="ana_hama"
            />
          ) : (
            <>
              <Input
                name="username"
                label="Usuario"
                autoComplete="username"
                autoFocus
                icon={<AtSign className="size-4" />}
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                error={errors.username}
                hint="Así te encontrará la gente: @tuusuario"
                placeholder="ana_hama"
              />
              <Input
                name="display_name"
                label="Nombre visible (opcional)"
                autoComplete="name"
                icon={<User className="size-4" />}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ana"
              />
              <Input
                name="email"
                type="email"
                label="Email"
                autoComplete="email"
                icon={<Mail className="size-4" />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                placeholder="ana@ejemplo.com"
              />
            </>
          )}

          <Input
            name="password"
            type="password"
            label="Contraseña"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            icon={<Lock className="size-4" />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            placeholder="Mínimo 8 caracteres"
          />

          {apiError && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {apiError}
            </p>
          )}

          <Button type="submit" fullWidth size="lg" loading={submitting}>
            {mode === "login" ? "Entrar" : "Crear cuenta"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-soft">
          {mode === "login" ? (
            <>
              ¿No tienes cuenta?{" "}
              <Link to={`/register${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand hover:underline">
                Regístrate
              </Link>
            </>
          ) : (
            <>
              ¿Ya tienes cuenta?{" "}
              <Link to={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand hover:underline">
                Entra
              </Link>
            </>
          )}
        </p>

        <p className="mt-4 border-t border-line pt-4 text-center text-sm">
          <Link to="/" className="font-medium text-ink-soft transition-colors hover:text-ink">
            Explorar el feed sin cuenta
          </Link>
        </p>
      </div>
    </div>
  );
}

/** Evita redirecciones abiertas: solo rutas internas. */
function safeNext(value: string | null): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
