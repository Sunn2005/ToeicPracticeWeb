import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { apiFetch } from "./api/client";
import Login from "./pages/Login";
import PracticePart from "./pages/PracticePart";
import Welcome from "./pages/Welcome";
import FullTestExam from "./pages/FullTestExam";
import FullTestIntro from "./pages/FullTestIntro";
import FullTestResult from "./pages/FullTestResult";
import FullTestReview from "./pages/FullTestReview";
import { LanguageProvider } from "./i18n/LanguageContext";
import LoadingScreen from "./components/LoadingScreen";
import FloatingPet from "./components/FloatingPet";

const ROLE_STORAGE_PREFIX = "capytoeic:user-role:";
const KNOWN_ROLES = new Set(["USER", "EMPLOYEE", "ADMIN"]);

function readCachedRole(uid) {
  if (!uid) return null;

  try {
    const role = String(window.localStorage.getItem(`${ROLE_STORAGE_PREFIX}${uid}`) || "")
      .toUpperCase();
    return KNOWN_ROLES.has(role) ? role : null;
  } catch {
    return null;
  }
}

function cacheRole(uid, role) {
  if (!uid || !KNOWN_ROLES.has(role)) return;

  try {
    window.localStorage.setItem(`${ROLE_STORAGE_PREFIX}${uid}`, role);
  } catch {
    // Storage can be unavailable in private browsing. The in-memory role still works.
  }
}

function AppRoutes() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [roleInfo, setRoleInfo] = useState({ uid: null, role: null });

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setRoleInfo(currentUser
        ? {
            uid: currentUser.uid,
            // The backend creates every new account as USER. Use that harmless
            // display fallback so the pet is not blocked by a cold API server.
            role: readCachedRole(currentUser.uid) || "USER",
          }
        : { uid: null, role: null });
      setUser(currentUser);
      setCheckingAuth(false);
    });
  }, []);

  useEffect(() => {
    let active = true;

    if (!user) {
      return () => {
        active = false;
      };
    }

    const resolveRole = async () => {
      try {
        const profile = await apiFetch("/api/me");
        if (active) {
          const role = String(profile?.role || "").toUpperCase() || "UNKNOWN";
          cacheRole(user.uid, role);
          setRoleInfo({
            uid: user.uid,
            role,
          });
        }
      } catch {
        // Role only controls non-sensitive UI. Keep the cached/default value if
        // Render is waking up or offline; protected APIs still enforce the role.
      }
    };

    resolveRole();
    return () => {
      active = false;
    };
  }, [user]);

  if (checkingAuth) {
    return <LoadingScreen />;
  }

  return (
    <>
      <Routes>
      <Route
        path="/"
        element={<Navigate to={user ? "/dashboard" : "/login"} replace />}
      />
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        path="/dashboard"
        element={user ? <Welcome user={user} /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/practice/part5"
        element={user ? <PracticePart /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/full-test/:testId"
        element={user ? <FullTestIntro /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/full-test/:attemptId/exam"
        element={user ? <FullTestExam /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/full-test/:attemptId/result"
        element={user ? <FullTestResult /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/full-test/:attemptId/review"
        element={user ? <FullTestReview /> : <Navigate to="/login" replace />}
      />
      <Route
        path="*"
        element={<Navigate to={user ? "/dashboard" : "/login"} replace />}
      />
      </Routes>
      <FloatingPet
        user={user}
        role={roleInfo.uid === user?.uid ? roleInfo.role : null}
      />
    </>
  );
}

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </LanguageProvider>
  );
}

export default App;
