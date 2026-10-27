import { Navigate, Outlet, useLocation } from "react-router-dom";
import { canUseConsole, consoleRoutePermission } from "./consolePermissions";
import LoadingScreen from "../components/LoadingScreen";
import { useAuth } from "./useAuth";

function ProtectedRoute({ allowedRoles }) {
  const location = useLocation();
  const { user, role, profile, authLoading, profileLoading } = useAuth();

  if (authLoading || (user && profileLoading && !role)) {
    return <LoadingScreen />;
  }

  if (!user) {
    const consoleRoute = location.pathname.startsWith("/console");
    return (
      <Navigate
        to={consoleRoute ? "/console" : "/login"}
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (allowedRoles?.length && !allowedRoles.includes(role)) {
    return <Navigate to="/console/forbidden" replace />;
  }

  if (location.pathname.startsWith("/console/") && !canUseConsole(profile, consoleRoutePermission(location.pathname))) {
    return <Navigate to="/console/forbidden" replace />;
  }
  return <Outlet />;
}

export default ProtectedRoute;
