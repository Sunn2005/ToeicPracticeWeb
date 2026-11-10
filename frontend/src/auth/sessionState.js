export async function loadBackendSession(loadProfile, { signal, timeoutMs = 10_000 } = {}) {
  const controller = new AbortController();
  let timer;
  let cancel;
  try {
    const interrupted = new Promise((_, reject) => {
      cancel = () => {
        reject(new DOMException("Session check cancelled", "AbortError"));
        controller.abort();
      };
      if (signal?.aborted) return cancel();
      signal?.addEventListener("abort", cancel, { once: true });
      timer = setTimeout(() => {
        reject(new Error("Session check timed out"));
        controller.abort();
      }, timeoutMs);
    });
    const profile = await Promise.race([
      interrupted,
      Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return loadProfile(controller.signal);
      }),
    ]);
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
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
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
