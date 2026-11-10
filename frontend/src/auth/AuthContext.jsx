import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "firebase/auth";
import { createSession, destroySession } from "../api/auth/auth";
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
  const [sessionUnavailable, setSessionUnavailable] = useState(false);
  const sessionCheck = useRef(null);

  const cancelSessionCheck = useCallback(() => {
    sessionCheck.current?.abort();
    setAuthLoading(false);
  }, []);

  const applyProfile = useCallback((nextProfile) => {
    cancelSessionCheck();
    setProfile(nextProfile);
    setUser(profileToUser(nextProfile));
    setProfileError("");
    setSessionUnavailable(false);
    return nextProfile;
  }, [cancelSessionCheck]);

  const handleUnauthorized = useCallback(() => {
    cancelSessionCheck();
    setUser(null);
    setProfile(null);
    setProfileError("");
    setSessionUnavailable(false);
  }, [cancelSessionCheck]);

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
    cancelSessionCheck();
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
  }, [applyProfile, handleUnauthorized, cancelSessionCheck]);

  const logout = useCallback(async () => {
    await terminateBackendSession(destroySession, () => signOut(auth));
    handleUnauthorized();
  }, [handleUnauthorized]);

  const restoreSession = useCallback(() => {
    sessionCheck.current?.abort();
    const controller = new AbortController();
    sessionCheck.current = controller;
    return loadBackendSession(
      (signal) => apiFetch("/api/me", { signal }),
      { signal: controller.signal },
    ).then((result) => {
      if (controller.signal.aborted) return;
      if (result.status === "authenticated") {
        applyProfile(result.profile);
      } else if (result.status === "anonymous") {
        handleUnauthorized();
      } else {
        // A network failure is not evidence that the cookie has expired.
        setSessionUnavailable(true);
        setProfileError(result.error);
      }
      setAuthLoading(false);
    });
  }, [applyProfile, handleUnauthorized]);

  const retrySession = useCallback(() => {
    setAuthLoading(true);
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    void restoreSession();
    return () => sessionCheck.current?.abort();
  }, [restoreSession]);

  const value = useMemo(() => ({
    user,
    profile,
    role: String(profile?.role || "").toUpperCase(),
    authLoading,
    sessionUnavailable,
    retrySession,
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
    sessionUnavailable,
    retrySession,
    profileLoading,
    profileError,
    establishSession,
    logout,
    refreshProfile,
    handleUnauthorized,
  ]);

  return <AuthStateContext.Provider value={value}>{children}</AuthStateContext.Provider>;
}
