import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import {
  deleteAttempt,
  getAttemptHistory,
  readAttemptHistoryCache,
  writeAttemptHistoryCache,
} from "../api/userLearning";

export function useUserAttempts() {
  const { user } = useAuth();
  const [initialHistory] = useState(() => readAttemptHistoryCache(user?.uid));
  const [attempts, setAttempts] = useState(() => initialHistory || []);
  const [loading, setLoading] = useState(() => !initialHistory);
  const [error, setError] = useState("");

  const refresh = async () => {
    setError("");
    try {
      const history = await getAttemptHistory();
      setAttempts(history);
      writeAttemptHistoryCache(user?.uid, history);
      return history;
    } catch (requestError) {
      setError(requestError.message || "Không thể tải lịch sử làm bài.");
      throw requestError;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    getAttemptHistory()
      .then((history) => {
        if (!active) return;
        setAttempts(history);
        writeAttemptHistoryCache(user?.uid, history);
        setError("");
      })
      .catch((requestError) => {
        if (active && !initialHistory) {
          setError(requestError.message || "Không thể tải lịch sử làm bài.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initialHistory, user?.uid]);

  const remove = async (attemptId) => {
    await deleteAttempt(attemptId);
    setAttempts((current) => {
      const next = current.filter((attempt) => attempt.id !== attemptId);
      writeAttemptHistoryCache(user?.uid, next);
      return next;
    });
  };

  return { attempts, loading, error, refresh, remove };
}
