function waitForRetry(signal) {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, 350);
    signal.addEventListener("abort", finish, { once: true });
  });
}

function isRetryable(error) {
  const status = error?.status;
  return (status === 403 && error.body?.code === "CSRF_TOKEN_INVALID")
    || status === 429 || status >= 500 || error instanceof TypeError;
}

export class AnswerSaveError extends Error {}

export function createAnswerSaveQueue({ write, onChange, wait = waitForRetry }) {
  const pendingSaves = new Map();
  const unsaved = new Map();
  let saved = false;

  const publish = () => {
    const failed = [...unsaved.values()].filter((entry) => entry.error);
    onChange({
      pending: pendingSaves.size > 0,
      failed,
      saved,
    });
  };

  function enqueue(questionNumber, selectedAnswer) {
    const previous = unsaved.get(questionNumber);
    if (previous) previous.retry.abort();

    const entry = { questionNumber, selectedAnswer, retry: new AbortController(), error: null };
    unsaved.set(questionNumber, entry);
    const isCurrent = () => unsaved.get(questionNumber) === entry;
    const previousSave = pendingSaves.get(questionNumber) ?? Promise.resolve();
    const save = previousSave.catch(() => undefined).then(async () => {
      for (let retries = 0; isCurrent(); retries++) {
        try {
          await write(questionNumber, selectedAnswer);
          if (isCurrent()) {
            unsaved.delete(questionNumber);
            saved = true;
          }
          return;
        } catch (error) {
          if (!isCurrent()) return;
          if (error?.status === 404) {
            unsaved.delete(questionNumber);
            return;
          }
          entry.error = error;
          publish();
          if (entry.retry.signal.aborted || retries === 2 || !isRetryable(error)) throw error;
          await wait(entry.retry.signal);
          if (entry.retry.signal.aborted) {
            if (isCurrent()) throw error;
            return;
          }
        }
      }
    }).finally(() => {
      if (pendingSaves.get(questionNumber) === save) {
        pendingSaves.delete(questionNumber);
        if (!entry.silent) publish();
      }
    });

    pendingSaves.set(questionNumber, save);
    publish();
    return save;
  }

  function cancelRetries() {
    for (const entry of unsaved.values()) entry.retry.abort();
  }

  function drain() {
    return Promise.allSettled([...pendingSaves.values()]);
  }

  return {
    enqueue,
    cancelRetries,
    drain,
    async waitForPendingSaves() {
      await drain();
      const failed = [...unsaved.values()].find((entry) => entry.error);
      if (failed) throw new AnswerSaveError(failed.error.message, { cause: failed.error });
    },
    retryFailed() {
      return Promise.allSettled([...unsaved.values()]
        .filter((entry) => entry.error && !pendingSaves.has(entry.questionNumber))
        .map(({ questionNumber, selectedAnswer }) => enqueue(questionNumber, selectedAnswer)));
    },
    discard({ notify = true } = {}) {
      for (const entry of unsaved.values()) entry.silent = !notify;
      cancelRetries();
      unsaved.clear();
      saved = false;
      if (notify) publish();
    },
  };
}
