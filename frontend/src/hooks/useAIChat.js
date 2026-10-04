import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  sendChatMessage,
  waitForChatJob,
} from "../api/aiChat.js";
import {
  AI_CHAT_ACTIONS,
  aiChatReducer,
  createInitialAIChatState,
  pendingJobIdsFromMessages,
} from "./aiChatState.js";

function requestError(error, fallbackCode) {
  return {
    errorCode: error?.body?.code || error?.code || fallbackCode,
    errorMessage: error?.message || "",
  };
}

export function useAIChat({ enabled, locale }) {
  const [state, dispatch] = useReducer(aiChatReducer, enabled, createInitialAIChatState);
  const controllersRef = useRef(new Map());

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

  const resumePendingJobs = useCallback((messages = state.messages, conversationId = state.activeConversationId) => {
    if (!conversationId) return [];
    const jobIds = pendingJobIdsFromMessages(messages);
    jobIds.forEach((jobId) => void pollJob(jobId, conversationId));
    return jobIds;
  }, [pollJob, state.activeConversationId, state.messages]);

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

  const sendMessage = useCallback(async (content) => {
    if (!state.activeConversationId || !state.canSend || state.sending) return null;
    dispatch({ type: AI_CHAT_ACTIONS.SEND_STARTED });
    try {
      const accepted = await sendChatMessage(state.activeConversationId, {
        content,
        idempotencyKey: globalThis.crypto.randomUUID(),
      });
      dispatch({ type: AI_CHAT_ACTIONS.MESSAGE_ACCEPTED, accepted });
      void pollJob(accepted.job.id, state.activeConversationId);
      return accepted;
    } catch (error) {
      dispatch({
        type: AI_CHAT_ACTIONS.REQUEST_FAILED,
        ...requestError(error, "CHAT_SEND_FAILED"),
      });
      throw error;
    }
  }, [pollJob, state.activeConversationId, state.canSend, state.sending]);

  const retryMessage = useCallback(async (failedMessageId) => {
    const failedIndex = state.messages.findIndex(({ id }) => id === failedMessageId);
    if (failedIndex < 0) return null;
    const originalUserMessage = state.messages
      .slice(0, failedIndex)
      .reverse()
      .find(({ role, content }) => role === "USER" && content);
    return originalUserMessage ? sendMessage(originalUserMessage.content) : null;
  }, [sendMessage, state.messages]);

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

  useEffect(() => {
    dispatch({ type: AI_CHAT_ACTIONS.ENABLED_CHANGED, enabled });
    if (enabled) void refreshConversations().catch(() => undefined);
    else abortAll();
  }, [abortAll, enabled, refreshConversations]);

  useEffect(() => abortAll, [abortAll]);

  return {
    ...state,
    refreshConversations,
    openConversation,
    startConversation,
    sendMessage,
    retryMessage,
    removeConversation,
    resumePendingJobs,
    clearError: () => dispatch({ type: AI_CHAT_ACTIONS.CLEAR_ERROR }),
  };
}
