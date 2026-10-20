import { Analytics } from "@vercel/analytics/react";
import { useCallback, useEffect, useState } from "react";
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
import { LanguageProvider, useLanguage } from "./i18n/LanguageContext";
import LoadingScreen from "./components/LoadingScreen";
import FloatingPet from "./components/FloatingPet";
import AIChatBox from "./components/ai-chat/AIChatBox";
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
import SubscriptionManagementPage from "./pages/admin/SubscriptionManagementPage";
import TestReviewPage from "./pages/admin/TestReviewPage";
import ForbiddenPage from "./pages/errors/ForbiddenPage";
import GuestRoute from "./auth/GuestRoute.jsx";
import LandingPage from "./pages/public/LandingPage.jsx";
import SupportPage from "./pages/public/SupportPage.jsx";
import PublicLayout from "./layouts/PublicLayout.jsx";
import NotFoundPage from "./pages/errors/NotFoundPage.jsx";

function AppRoutes() {
    const { user, role, authLoading } = useAuth();
    const location = useLocation();

    if (authLoading) {
        return <LoadingScreen />;
    }

    return (
        <>
            <Routes>
                <Route element={<GuestRoute />}>
                    <Route element={<PublicLayout />}>
                        <Route path="/" element={<LandingPage />} />
                        <Route path="/support" element={<SupportPage />} />
                    </Route>
                </Route>
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
                <Route path="*" element={<NotFoundPage />} />
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
            {!location.pathname.startsWith("/console") && <FloatingPet user={user} role={role} />}
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
