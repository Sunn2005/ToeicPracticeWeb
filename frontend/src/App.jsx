import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Login from "./pages/Login";
import PracticePart from "./pages/PracticePart";
import Welcome from "./pages/Welcome";
import FullTestExam from "./pages/FullTestExam";
import FullTestIntro from "./pages/FullTestIntro";
import FullTestResult from "./pages/FullTestResult";
import FullTestReview from "./pages/FullTestReview";
import { LanguageProvider, useLanguage } from "./i18n/LanguageContext";

function LoadingScreen() {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-screen items-center justify-center bg-sky-50">
      <p className="text-sm font-medium text-sky-700">
        {t("checkingSession")}
      </p>
    </div>
  );
}

function AppRoutes() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setCheckingAuth(false);
    });
  }, []);

  if (checkingAuth) {
    return <LoadingScreen />;
  }

  return (
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
