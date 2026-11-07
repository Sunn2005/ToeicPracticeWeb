import { Analytics } from "@vercel/analytics/react";
import { useCallback, useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import Login from "./modules/authentication/pages/Login";
import PracticePart from "./modules/legacy-practice/pages/PracticePart";
import FullTestExam from "./modules/exam/pages/FullTestExam";
import FullTestIntro from "./modules/exam/pages/FullTestIntro";
import FullTestResult from "./modules/exam/pages/FullTestResult";
import FullTestReview from "./modules/exam/pages/FullTestReview";
import { useLanguage } from "./i18n/LanguageContext";
import AppLanguageProvider from "./i18n/AppLanguageProvider";
import LoadingScreen from "./components/ui/LoadingScreen";
import FloatingPet from "./modules/ai-chat/components/FloatingPet";
import AIChatBox from "./modules/ai-chat/components/AIChatBox";
import { AuthProvider } from "./auth/AuthContext";
import { useAuth } from "./auth/useAuth";
import ProtectedRoute from "./auth/ProtectedRoute";
import LoginPage from "./modules/authentication/pages/LoginPage";
import StaffPasswordPage from "./modules/authentication/pages/StaffPasswordPage";
import ConsoleProfilePage from "./modules/profile/pages/ConsoleProfilePage";
import ManagementLayout from "./layouts/ManagementLayout";
import PublicLayout from "./layouts/PublicLayout";
import LandingPage from "./modules/public/pages/LandingPage";
import StaffManagementPage from "./modules/staff-management/pages/StaffManagementPage";
import AdminDashboard from "./modules/dashboard/pages/admin/AdminDashboard";
import MyTestsPage from "./modules/test-management/pages/employee/MyTestsPage";
import CreateTestPage from "./modules/test-management/pages/employee/CreateTestPage";
import EditTestPage from "./modules/test-management/pages/employee/EditTestPage";
import TestPreviewPage from "./modules/test-management/pages/employee/TestPreviewPage";
import ReviewQueuePage from "./modules/test-management/pages/admin/ReviewQueuePage";
import ReviewHistoryPage from "./modules/test-management/pages/admin/ReviewHistoryPage";
import AdminRevenuePage from "./modules/billing/pages/admin/AdminRevenuePage";
import AdminOrdersPage from "./modules/billing/pages/admin/AdminOrdersPage";
import TestReviewPage from "./modules/test-management/pages/admin/TestReviewPage";
import ForbiddenPage from "./modules/errors/pages/ForbiddenPage";
import UserLayout from "./layouts/UserLayout";
import UserDashboard from "./modules/dashboard/pages/user/UserDashboard";
import TestCatalogPage from "./modules/test-catalog/pages/TestCatalogPage";
import AttemptHistoryPage from "./modules/learning-history/pages/AttemptHistoryPage";
import ProfilePage from "./modules/profile/pages/ProfilePage";
import EditProfilePage from "./modules/profile/pages/EditProfilePage";
import PaymentResultPage from "./modules/billing/pages/user/PaymentResultPage";
import PricingPage from "./modules/billing/pages/user/PricingPage";
import { useAIChat } from "./modules/ai-chat/hooks/useAIChat";
import { getChatEligibleAttempts, getChatQuestionChoices } from "./api/users/userLearning";
import { hasEffectiveAIChat } from "./modules/ai-chat/utils/floatingPetInteraction";

function LearnerChatShell({ user, role, profile, pathname }) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [attempts, setAttempts] = useState([]);
  const isExamRoute = /^\/full-test\/[^/]+\/exam(?:\/|$)/i.test(pathname);
  const enabled = Boolean(user)
    && String(role || "").toUpperCase() === "USER"
    && hasEffectiveAIChat(profile?.subscription)
    && !isExamRoute;
  const chat = useAIChat({ enabled: open && enabled, locale: language });
  const openChat = useCallback(() => setOpen(true), []);
  const closeChat = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open || !enabled) return undefined;
    const controller = new AbortController();
    getChatEligibleAttempts({ signal: controller.signal })
      .then(setAttempts)
      .catch((error) => {
        if (error?.name !== "AbortError") setAttempts([]);
      });
    return () => controller.abort();
  }, [enabled, open]);

  return (
    <>
      <FloatingPet
        user={user}
        role={role}
        profile={profile}
        onOpenChat={openChat}
      />
      <AIChatBox
        open={open && enabled}
        onClose={closeChat}
        chat={chat}
        attempts={attempts}
        getQuestionChoices={getChatQuestionChoices}
      />
    </>
  );
}

export function AppRoutes() {
  const { user, role, profile, authLoading } = useAuth();
  const location = useLocation();

  // Public home content does not depend on the restored session.
  // All other routes keep waiting before rendering or redirecting.
  if (authLoading && location.pathname !== "/") {
    return <LoadingScreen />;
  }

  if (profile?.passwordChangeRequired && !["/console/change-password", "/console/forgot-password", "/console/reset-password"].includes(location.pathname)) return <Navigate to="/console/change-password" replace />;
  return (
    <>
      <Routes>
        <Route
          path="/"
          element={user ? <Navigate to="/dashboard" replace /> : <PublicLayout />}
        >
          <Route index element={<LandingPage />} />
        </Route>
        <Route
          path="/login"
          element={user ? <Navigate to="/dashboard" replace /> : <Login />}
        />
        <Route
          element={user ? <UserLayout /> : <Navigate to="/login" replace />}
        >
          <Route path="/dashboard" element={<UserDashboard />} />
          <Route path="/tests" element={<TestCatalogPage />} />
          <Route path="/history" element={<AttemptHistoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/edit" element={<EditProfilePage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/payment/success" element={<PaymentResultPage mode="success" />} />
          <Route path="/payment/cancel" element={<PaymentResultPage mode="cancel" />} />
          <Route
            path="/full-test/:attemptId/result"
            element={<FullTestResult />}
          />
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

        <Route path="/console/forgot-password" element={<StaffPasswordPage key="forgot" mode="forgot" />} />
        <Route path="/console/reset-password" element={<StaffPasswordPage key="reset" mode="reset" />} />
        <Route path="/console/change-password" element={<StaffPasswordPage key="change" mode="change" />} />
        <Route path="/console" element={<LoginPage />} />
        <Route path="/console/forbidden" element={<ForbiddenPage />} />
        <Route
          element={<ProtectedRoute allowedRoles={["ADMIN", "EMPLOYEE"]} />}
        >
          <Route element={<ManagementLayout />}>
            <Route path="/console/profile" element={<ConsoleProfilePage />} />
            <Route path="/console/dashboard" element={<AdminDashboard />} />
            <Route path="/console/tests" element={<MyTestsPage />} />
            <Route path="/console/tests/new" element={<CreateTestPage />} />
            <Route path="/console/tests/:testId/edit" element={<EditTestPage />} />
            <Route path="/console/tests/:testId/preview" element={<TestPreviewPage />} />
            <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
              <Route path="/console/staff" element={<StaffManagementPage />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={["ADMIN", "EMPLOYEE"]} />}>
              <Route path="/console/revenue" element={<AdminRevenuePage />} />
              <Route path="/console/orders" element={<AdminOrdersPage />} />
              <Route path="/console/reviews" element={<ReviewQueuePage />} />
              <Route
                path="/console/reviews/:testId"
                element={<TestReviewPage />}
              />
              <Route
                path="/console/review-history"
                element={<ReviewHistoryPage />}
              />
            </Route>
          </Route>
        </Route>
      </Routes>
      {!location.pathname.startsWith("/console") && (
        <LearnerChatShell
          key={`${location.key}:${user?.uid || "guest"}:${role}:${hasEffectiveAIChat(profile?.subscription)}`}
          user={user}
          role={role}
          profile={profile}
          pathname={location.pathname}
        />
      )}
    </>
  );
}

function SafeAnalytics() {
  const { pathname } = useLocation();
  return pathname === "/console/reset-password" ? null : <Analytics />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppLanguageProvider>
          <AppRoutes />
          <SafeAnalytics />
        </AppLanguageProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
