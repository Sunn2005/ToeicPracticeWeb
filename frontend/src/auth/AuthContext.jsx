import { useCallback, useEffect, useMemo, useState } from "react";
import { signOut } from "firebase/auth";
import { createSession, destroySession } from "../api/auth";
import { apiFetch } from "../api/client";
import { auth } from "../firebase";
import {
  exchangeFirebaseSession,
  loadBackendSession,
  terminateBackendSession,
} from "./sessionState";
import { AuthStateContext } from "./useAuth";

function profileToUser(profile) {
  if (!profile) return null;
  return {
    uid: profile.uid,
    email: profile.email,
    displayName: profile.displayName,
    photoURL: profile.photoUrl,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  const applyProfile = useCallback((nextProfile) => {
    setProfile(nextProfile);
    setUser(profileToUser(nextProfile));
    setProfileError("");
    return nextProfile;
  }, []);

  const handleUnauthorized = useCallback(() => {
    setUser(null);
    setProfile(null);
    setProfileError("");
  }, []);

  const refreshProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError("");
    try {
      return applyProfile(await apiFetch("/api/me"));
    } catch (error) {
      if (error?.status === 401) {
        handleUnauthorized();
      } else {
        setProfileError(error?.message || "Không thể tải thông tin tài khoản.");
      }
      throw error;
    } finally {
      setProfileLoading(false);
    }
  }, [applyProfile, handleUnauthorized]);

  const establishSession = useCallback(async (firebaseUser) => {
    setProfileLoading(true);
    setProfileError("");
    try {
      const nextProfile = await exchangeFirebaseSession(
        firebaseUser,
        createSession,
        () => signOut(auth),
      );
      return applyProfile(nextProfile);
    } catch (error) {
      handleUnauthorized();
      setProfileError(error?.message || "Không thể tạo phiên đăng nhập.");
      throw error;
    } finally {
      setProfileLoading(false);
    }
  }, [applyProfile, handleUnauthorized]);

  const logout = useCallback(async () => {
    await terminateBackendSession(destroySession, () => signOut(auth));
    handleUnauthorized();
  }, [handleUnauthorized]);

  useEffect(() => {
    let active = true;
    loadBackendSession(() => apiFetch("/api/me")).then((result) => {
      if (!active) return;
      if (result.status === "authenticated") {
        applyProfile(result.profile);
      } else {
        setUser(null);
        setProfile(null);
        setProfileError(result.error);
      }
      setAuthLoading(false);
    });
    return () => {
      active = false;
    };
  }, [applyProfile]);

  const value = useMemo(() => ({
    user,
    profile,
    role: String(profile?.role || "").toUpperCase(),
    authLoading,
    profileLoading,
    profileError,
    establishSession,
    logout,
    refreshProfile,
    handleUnauthorized,
  }), [
    user,
    profile,
    authLoading,
    profileLoading,
    profileError,
    establishSession,
    logout,
    refreshProfile,
    handleUnauthorized,
  ]);

  return <AuthStateContext.Provider value={value}>{children}</AuthStateContext.Provider>;
}
