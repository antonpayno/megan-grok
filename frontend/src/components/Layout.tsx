// PROPIETARIO: Persona 5. Stub mínimo: navbar + <Outlet/>.
import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Layout() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen">
      <nav className="flex gap-4 p-4 border-b">
        <Link to="/" className="font-bold text-brand">Pixel Pattern</Link>
        <Link to="/search">Buscar</Link>
        <Link to="/create">Crear</Link>
        {user ? <Link to={`/u/${user.username}`}>@{user.username}</Link> : <Link to="/login">Entrar</Link>}
      </nav>
      <main className="mx-auto max-w-5xl p-4">
        <Outlet />
      </main>
    </div>
  );
}
