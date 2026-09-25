import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { apiFetch } from "../api/client";
import { auth } from "../firebase";
import { AuthStateContext } from "./useAuth";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  const refreshProfile = async () => {
    if (!auth.currentUser) {
      setProfile(null);
      return null;
    }

    setProfileLoading(true);
    setProfileError("");
    try {
      const nextProfile = await apiFetch("/api/me", { forceRefresh: true });
      setProfile(nextProfile);
      return nextProfile;
    } catch (error) {
      setProfile(null);
      setProfileError(error.message || "Không thể tải thông tin tài khoản.");
      throw error;
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => onAuthStateChanged(auth, async (nextUser) => {
    setUser(nextUser);
    setProfile(null);
    setProfileError("");
    setAuthLoading(false);

    if (nextUser) {
      try {
        await refreshProfile();
      } catch {
        // The page offers a retry when the backend is unavailable.
      }
    }
  }), []);

  const value = useMemo(() => ({
    user,
    profile,
    role: String(profile?.role || "").toUpperCase(),
    authLoading,
    profileLoading,
    profileError,
    refreshProfile,
  }), [user, profile, authLoading, profileLoading, profileError]);

  return <AuthStateContext.Provider value={value}>{children}</AuthStateContext.Provider>;
}
