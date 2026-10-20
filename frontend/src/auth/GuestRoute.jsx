import { Navigate, Outlet } from "react-router-dom";
import LoadingScreen from "../components/LoadingScreen";
import { resolveHomePath } from "./roleRoutes";
import { useAuth } from "./useAuth";

export default function GuestRoute() {
  const { user, role, authLoading, profileLoading } = useAuth();

  if (authLoading || (user && profileLoading && !role)) {
    return <LoadingScreen />;
  }

  if (user) {
    return <Navigate to={resolveHomePath(role)} replace />;
  }

  return <Outlet />;
}
