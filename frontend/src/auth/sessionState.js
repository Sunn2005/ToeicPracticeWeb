export async function loadBackendSession(loadProfile) {
  try {
    const profile = await loadProfile();
    return { status: "authenticated", profile, error: "" };
  } catch (error) {
    if (error?.status === 401) {
      return { status: "anonymous", profile: null, error: "" };
    }
    return {
      status: "unavailable",
      profile: null,
      error: error?.message || "Không thể kiểm tra phiên đăng nhập.",
    };
  }
}

export async function exchangeFirebaseSession(
  firebaseUser,
  createSession,
  clearFirebaseUser,
) {
  try {
    const idToken = await firebaseUser.getIdToken(true);
    return await createSession(idToken);
  } finally {
    await clearFirebaseUser();
  }
}

export async function terminateBackendSession(
  destroySession,
  clearFirebaseUser,
) {
  await destroySession();
  await clearFirebaseUser();
}
