import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import Login from "./pages/Login";
import PracticePart from "./pages/PracticePart";
import FullTestExam from "./pages/FullTestExam";
import FullTestIntro from "./pages/FullTestIntro";
import FullTestResult from "./pages/FullTestResult";
import FullTestReview from "./pages/FullTestReview";
import { LanguageProvider } from "./i18n/LanguageContext";
import LoadingScreen from "./components/LoadingScreen";
import FloatingPet from "./components/FloatingPet";
import { AuthProvider } from "./auth/AuthContext";
import { useAuth } from "./auth/useAuth";
import ProtectedRoute from "./auth/ProtectedRoute";
import LoginPage from "./pages/auth/LoginPage";
import ManagementLayout from "./layouts/ManagementLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import MyTestsPage from "./pages/employee/MyTestsPage";
import CreateTestPage from "./pages/employee/CreateTestPage";
import ReviewQueuePage from "./pages/admin/ReviewQueuePage";
import ReviewHistoryPage from "./pages/admin/ReviewHistoryPage";
import TestReviewPage from "./pages/admin/TestReviewPage";
import ForbiddenPage from "./pages/errors/ForbiddenPage";
import UserLayout from "./layouts/UserLayout";
import UserDashboard from "./pages/user/UserDashboard";
import TestCatalogPage from "./pages/user/TestCatalogPage";
import AttemptHistoryPage from "./pages/user/AttemptHistoryPage";
import ProfilePage from "./pages/user/ProfilePage";

function AppRoutes() {
  const { user, role, authLoading } = useAuth();
  const location = useLocation();
  const userShellPaths = new Set(["/dashboard", "/tests", "/history", "/profile"]);
  const usesUserShell = userShellPaths.has(location.pathname)
    || /^\/full-test\/[^/]+\/result$/.test(location.pathname);

  if (authLoading) {
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
      <Route element={user ? <UserLayout /> : <Navigate to="/login" replace />}>
        <Route path="/dashboard" element={<UserDashboard />} />
        <Route path="/tests" element={<TestCatalogPage />} />
        <Route path="/history" element={<AttemptHistoryPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/full-test/:attemptId/result" element={<FullTestResult />} />
      </Route>
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
        path="/full-test/:attemptId/review"
        element={user ? <FullTestReview /> : <Navigate to="/login" replace />}
      />
      <Route
        path="*"
        element={<Navigate to={user ? "/dashboard" : "/login"} replace />}
      />

      <Route path="/console" element={<LoginPage />} />
      <Route path="/console/forbidden" element={<ForbiddenPage />} />
      <Route element={<ProtectedRoute allowedRoles={["ADMIN", "EMPLOYEE"]} />}>
        <Route element={<ManagementLayout />}>
          <Route path="/console/dashboard" element={<AdminDashboard />} />
          <Route path="/console/tests" element={<MyTestsPage />} />
          <Route path="/console/tests/new" element={<CreateTestPage />} />
          <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
            <Route path="/console/reviews" element={<ReviewQueuePage />} />
            <Route path="/console/reviews/:testId" element={<TestReviewPage />} />
            <Route path="/console/review-history" element={<ReviewHistoryPage />} />
          </Route>
        </Route>
      </Route>
      </Routes>
      {!location.pathname.startsWith("/console") && !usesUserShell && <FloatingPet user={user} role={role} />}
    </>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
