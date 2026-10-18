import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  retryChatMessage,
  renameConversation,
  sendChatMessage,
  waitForChatJob,
} from "../api/aiChat.js";
import {
  AI_CHAT_ACTIONS,
  aiChatReducer,
  conversationIdToResume,
  createInitialAIChatState,
  pendingJobIdsFromMessages,
} from "./aiChatState.js";
import {
  createChatSendAttemptRegistry,
  isConfirmedHttpFailure,
} from "./aiChatSendAttempts.js";

function requestError(error, fallbackCode) {
  return {
    errorCode: error?.body?.code || error?.code || fallbackCode,
    errorMessage: error?.message || "",
  };
}

export function useAIChat({ enabled, locale }) {
  const [state, dispatch] = useReducer(aiChatReducer, enabled, createInitialAIChatState);
  const controllersRef = useRef(new Map());
  const sendAttemptsRef = useRef(
    createChatSendAttemptRegistry(() => globalThis.crypto.randomUUID()),
  );
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const abortAll = useCallback(() => {
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current.clear();
  }, []);

  const refreshConversations = useCallback(async () => {
    dispatch({ type: AI_CHAT_ACTIONS.LOAD_STARTED });
    try {
      const conversations = await listConversations();
      dispatch({ type: AI_CHAT_ACTIONS.LOAD_SUCCEEDED, conversations });
      return conversations;
    } catch (error) {
      dispatch({
        type: AI_CHAT_ACTIONS.LOAD_FAILED,
        ...requestError(error, "CHAT_LOAD_FAILED"),
      });
      throw error;
    }
  }, []);

  const pollJob = useCallback(async (jobId, conversationId) => {
    if (!jobId || controllersRef.current.has(jobId)) return;
    const controller = new AbortController();
    controllersRef.current.set(jobId, controller);
    try {
      await waitForChatJob(jobId, { signal: controller.signal });
      const detail = await getConversation(conversationId, { signal: controller.signal });
      dispatch({ type: AI_CHAT_ACTIONS.CONVERSATION_SYNCED, detail });
    } catch (error) {
      if (error?.name !== "AbortError") {
        dispatch({
          type: AI_CHAT_ACTIONS.REQUEST_FAILED,
          ...requestError(error, "CHAT_POLL_FAILED"),
        });
      }
    } finally {
      controllersRef.current.delete(jobId);
    }
  }, []);

  const resumePendingJobs = useCallback((
    messages = stateRef.current.messages,
    conversationId = stateRef.current.activeConversationId,
  ) => {
    if (!conversationId) return [];
    const jobIds = pendingJobIdsFromMessages(messages);
    jobIds.forEach((jobId) => void pollJob(jobId, conversationId));
    return jobIds;
  }, [pollJob]);

  const openConversation = useCallback(async (conversationId) => {
    try {
      const detail = await getConversation(conversationId);
      dispatch({ type: AI_CHAT_ACTIONS.CONVERSATION_OPENED, detail });
      resumePendingJobs(detail.messages, detail.conversation.id);
      return detail;
    } catch (error) {
      dispatch({
        type: AI_CHAT_ACTIONS.REQUEST_FAILED,
        ...requestError(error, "CHAT_LOAD_FAILED"),
      });
      throw error;
    }
  }, [resumePendingJobs]);

  const startConversation = useCallback(async ({ attemptId, questionNumber } = {}) => {
    const payload = { locale };
    if (attemptId != null && questionNumber != null) {
      payload.attemptId = attemptId;
      payload.questionNumber = questionNumber;
    }
    dispatch({ type: AI_CHAT_ACTIONS.SEND_STARTED });
    try {
      const conversation = await createConversation(payload);
      dispatch({ type: AI_CHAT_ACTIONS.CONVERSATION_CREATED, conversation });
      return conversation;
    } catch (error) {
      dispatch({
        type: AI_CHAT_ACTIONS.REQUEST_FAILED,
        ...requestError(error, "CHAT_CREATE_FAILED"),
      });
      throw error;
    }
  }, [locale]);

  const sendToConversation = useCallback(async (conversationId, content) => {
    if (!conversationId || !stateRef.current.canSend) return null;
    const attempt = sendAttemptsRef.current.prepare(conversationId, content);
    dispatch({ type: AI_CHAT_ACTIONS.SEND_STARTED });
    try {
      const accepted = await sendChatMessage(conversationId, {
        content,
        idempotencyKey: attempt.idempotencyKey,
      });
      sendAttemptsRef.current.clear(attempt);
      dispatch({ type: AI_CHAT_ACTIONS.MESSAGE_ACCEPTED, accepted, conversationId });
      void pollJob(accepted.job.id, conversationId);
      return accepted;
    } catch (error) {
      if (isConfirmedHttpFailure(error)) sendAttemptsRef.current.clear(attempt);
      dispatch({
        type: AI_CHAT_ACTIONS.REQUEST_FAILED,
        ...requestError(error, "CHAT_SEND_FAILED"),
      });
      throw error;
    }
  }, [pollJob]);

  const sendMessage = useCallback(async (content) => {
    if (!state.activeConversationId || !state.canSend || state.sending) return null;
    return sendToConversation(state.activeConversationId, content);
  }, [sendToConversation, state.activeConversationId, state.canSend, state.sending]);

  const startConversationWithMessage = useCallback(async (content) => {
    const conversation = await startConversation();
    await sendToConversation(conversation.id, content);
    return conversation;
  }, [sendToConversation, startConversation]);

  const retryMessage = useCallback(async (failedMessageId) => {
    if (!state.activeConversationId || !state.canSend || state.sending) return null;
    const conversationId = state.activeConversationId;
    dispatch({ type: AI_CHAT_ACTIONS.SEND_STARTED });
    try {
      // Retry tái dùng assistant message FAILED phía server: không tạo tin nhắn
      // user mới và không trừ quota (endpoint retry riêng).
      const accepted = await retryChatMessage(conversationId, failedMessageId);
      dispatch({ type: AI_CHAT_ACTIONS.MESSAGE_ACCEPTED, accepted, conversationId });
      void pollJob(accepted.job.id, conversationId);
      return accepted;
    } catch (error) {
      dispatch({
        type: AI_CHAT_ACTIONS.REQUEST_FAILED,
        ...requestError(error, "CHAT_SEND_FAILED"),
      });
      throw error;
    }
  }, [pollJob, state.activeConversationId, state.canSend, state.sending]);

  const removeConversation = useCallback(async (conversationId) => {
    try {
      await deleteConversation(conversationId);
      const removingActive = state.activeConversationId === conversationId;
      const nextConversation = state.conversations.find(({ id }) => id !== conversationId);
      if (removingActive) abortAll();
      dispatch({ type: AI_CHAT_ACTIONS.CONVERSATION_DELETED, conversationId });
      if (removingActive && nextConversation) await openConversation(nextConversation.id);
    } catch (error) {
      dispatch({
        type: AI_CHAT_ACTIONS.REQUEST_FAILED,
        ...requestError(error, "CHAT_DELETE_FAILED"),
      });
      throw error;
    }
  }, [abortAll, openConversation, state.activeConversationId, state.conversations]);

  const renameConversationTitle = useCallback(async (conversationId, title) => {
    try {
      const conversation = await renameConversation(conversationId, title);
      dispatch({ type: AI_CHAT_ACTIONS.CONVERSATION_RENAMED, conversation });
      return conversation;
    } catch (error) {
      dispatch({
        type: AI_CHAT_ACTIONS.REQUEST_FAILED,
        ...requestError(error, "CHAT_RENAME_FAILED"),
      });
      throw error;
    }
  }, []);

  useEffect(() => {
    dispatch({ type: AI_CHAT_ACTIONS.ENABLED_CHANGED, enabled });
    let cancelled = false;
    if (enabled) {
      void refreshConversations()
        .then((conversations) => {
          if (cancelled) return undefined;
          const conversationId = conversationIdToResume(
            conversations,
            stateRef.current.activeConversationId,
          );
          return conversationId ? openConversation(conversationId) : undefined;
        })
        .catch(() => undefined);
    } else {
      abortAll();
    }
    return () => {
      cancelled = true;
    };
  }, [abortAll, enabled, openConversation, refreshConversations]);

  useEffect(() => abortAll, [abortAll]);

  return {
    ...state,
    refreshConversations,
    openConversation,
    startConversation,
    startConversationWithMessage,
    sendMessage,
    retryMessage,
    renameConversation: renameConversationTitle,
    removeConversation,
    resumePendingJobs,
    clearError: () => dispatch({ type: AI_CHAT_ACTIONS.CLEAR_ERROR }),
  };
}
