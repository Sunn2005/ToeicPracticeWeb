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

function AppRoutes() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [roleInfo, setRoleInfo] = useState({ uid: null, role: null });

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
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
          setRoleInfo({
            uid: user.uid,
            role: String(profile?.role || "").toUpperCase() || "UNKNOWN",
          });
        }
      } catch {
        // Keep the pet hidden when the role cannot be verified. This prevents
        // management accounts from briefly seeing it during a failed request.
        if (active) setRoleInfo({ uid: user.uid, role: "UNKNOWN" });
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
