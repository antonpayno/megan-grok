// ARCHIVO COMPARTIDO: todas las rutas ya están registradas. No hace falta tocarlo.
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import FeedPage from "./pages/FeedPage";
import SearchPage from "./pages/SearchPage";
import ProfilePage from "./pages/ProfilePage";
import PostDetailPage from "./pages/PostDetailPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import CreatePage from "./pages/CreatePage";
import MakePage from "./pages/MakePage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<FeedPage />} />                 {/* P5 */}
        <Route path="/search" element={<SearchPage />} />         {/* P5 */}
        <Route path="/u/:username" element={<ProfilePage />} />   {/* P5 */}
        <Route path="/p/:id" element={<PostDetailPage />} />      {/* P5 */}
        <Route path="/login" element={<LoginPage />} />           {/* P5 */}
        <Route path="/register" element={<RegisterPage />} />     {/* P5 */}
        <Route path="/create" element={<CreatePage />} />         {/* P4  (?remix=<postId>) */}
        <Route path="/make/:id" element={<MakePage />} />         {/* P4 */}
      </Route>
    </Routes>
  );
}
