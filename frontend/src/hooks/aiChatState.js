export const AI_CHAT_ACTIONS = Object.freeze({
  ENABLED_CHANGED: "chat/enabled-changed",
  LOAD_STARTED: "chat/load-started",
  LOAD_SUCCEEDED: "chat/load-succeeded",
  LOAD_FAILED: "chat/load-failed",
  CONVERSATION_CREATED: "chat/conversation-created",
  CONVERSATION_OPENED: "chat/conversation-opened",
  CONVERSATION_SYNCED: "chat/conversation-synced",
  CONVERSATION_DELETED: "chat/conversation-deleted",
  SEND_STARTED: "chat/send-started",
  MESSAGE_ACCEPTED: "chat/message-accepted",
  REQUEST_FAILED: "chat/request-failed",
  CLEAR_ERROR: "chat/clear-error",
});

export function createInitialAIChatState(enabled = true) {
  return {
    status: "idle",
    conversations: [],
    activeConversationId: null,
    messages: [],
    quota: null,
    pendingJobIds: [],
    loadingConversation: false,
    sending: false,
    canSend: enabled,
    errorCode: null,
    errorMessage: "",
  };
}

function deduplicateById(values) {
  const byId = new Map();
  for (const value of values || []) {
    if (value?.id) byId.set(value.id, value);
  }
  return [...byId.values()];
}

function mergeById(current, incoming) {
  const nextById = new Map((current || []).filter((item) => item?.id).map((item) => [item.id, item]));
  for (const item of incoming || []) {
    if (!item?.id) continue;
    nextById.set(item.id, { ...nextById.get(item.id), ...item });
  }
  return [...nextById.values()];
}

function collapseFailedRetries(messages) {
  const visible = [];
  for (const message of messages) {
    const failedAssistant = visible.at(-1);
    const originalUser = visible.at(-2);
    if (message.role === "USER"
        && failedAssistant?.role === "ASSISTANT"
        && failedAssistant.status === "FAILED"
        && originalUser?.role === "USER"
        && originalUser.content === message.content) {
      visible.pop();
      continue;
    }
    visible.push(message);
  }
  return visible;
}

function upsertConversation(conversations, conversation) {
  return conversation ? mergeById(conversations, [conversation]) : conversations;
}

export function pendingJobIdsFromMessages(messages) {
  const jobIds = new Set();
  for (const message of messages || []) {
    if (message?.role === "ASSISTANT" && message.status === "PENDING" && message.jobId) {
      jobIds.add(message.jobId);
    }
  }
  return [...jobIds];
}

export function conversationIdToResume(conversations, activeConversationId) {
  if (!activeConversationId) return null;
  return (conversations || []).some(({ id }) => id === activeConversationId)
    ? activeConversationId
    : null;
}

function detailState(state, detail) {
  const conversation = detail?.conversation;
  if (!conversation?.id) return state;
  const messages = collapseFailedRetries(deduplicateById(detail.messages));
  return {
    ...state,
    status: "ready",
    conversations: upsertConversation(state.conversations, conversation),
    activeConversationId: conversation.id,
    messages,
    pendingJobIds: pendingJobIdsFromMessages(messages),
    loadingConversation: false,
    errorCode: null,
    errorMessage: "",
  };
}

export function aiChatReducer(state, action) {
  switch (action.type) {
    case AI_CHAT_ACTIONS.ENABLED_CHANGED:
      return { ...state, canSend: Boolean(action.enabled) };
    case AI_CHAT_ACTIONS.LOAD_STARTED:
      return { ...state, status: "loading", errorCode: null, errorMessage: "" };
    case AI_CHAT_ACTIONS.LOAD_SUCCEEDED: {
      const conversations = deduplicateById(action.conversations);
      const activeStillExists = conversations.some(({ id }) => id === state.activeConversationId);
      return {
        ...state,
        status: conversations.length ? "ready" : "empty",
        conversations,
        activeConversationId: activeStillExists ? state.activeConversationId : null,
        messages: activeStillExists ? state.messages : [],
        pendingJobIds: activeStillExists ? state.pendingJobIds : [],
        errorCode: null,
        errorMessage: "",
      };
    }
    case AI_CHAT_ACTIONS.LOAD_FAILED:
      return {
        ...state,
        status: "error",
        errorCode: action.errorCode,
        errorMessage: action.errorMessage || "",
      };
    case AI_CHAT_ACTIONS.CONVERSATION_CREATED:
      return {
        ...state,
        status: "ready",
        conversations: upsertConversation(state.conversations, action.conversation),
        activeConversationId: action.conversation.id,
        messages: [],
        pendingJobIds: [],
        loadingConversation: false,
        sending: false,
        errorCode: null,
        errorMessage: "",
      };
    case AI_CHAT_ACTIONS.CONVERSATION_OPENED:
      return detailState(state, action.detail);
    case AI_CHAT_ACTIONS.CONVERSATION_SYNCED: {
      const conversation = action.detail?.conversation;
      if (!conversation?.id) return state;
      if (conversation.id !== state.activeConversationId) {
        return { ...state, conversations: upsertConversation(state.conversations, conversation) };
      }
      return detailState(state, action.detail);
    }
    case AI_CHAT_ACTIONS.CONVERSATION_DELETED: {
      const conversations = state.conversations.filter(({ id }) => id !== action.conversationId);
      if (state.activeConversationId !== action.conversationId) {
        return { ...state, conversations, status: conversations.length ? "ready" : "empty" };
      }
      return {
        ...state,
        status: conversations.length ? "ready" : "empty",
        conversations,
        activeConversationId: conversations[0]?.id || null,
        messages: [],
        pendingJobIds: [],
        quota: null,
      };
    }
    case AI_CHAT_ACTIONS.SEND_STARTED:
      return { ...state, sending: true, errorCode: null, errorMessage: "" };
    case AI_CHAT_ACTIONS.MESSAGE_ACCEPTED: {
      const conversationId = action.conversationId || action.accepted?.job?.conversationId;
      if (conversationId && conversationId !== state.activeConversationId) {
        return {
          ...state,
          quota: action.accepted.quotaSummary || state.quota,
          sending: false,
          errorCode: null,
          errorMessage: "",
        };
      }
      const messages = collapseFailedRetries(mergeById(state.messages, [
        action.accepted.userMessage,
        action.accepted.assistantMessage,
      ]));
      return {
        ...state,
        messages,
        quota: action.accepted.quotaSummary || state.quota,
        pendingJobIds: pendingJobIdsFromMessages(messages),
        sending: false,
        errorCode: null,
        errorMessage: "",
      };
    }
    case AI_CHAT_ACTIONS.REQUEST_FAILED:
      return {
        ...state,
        sending: false,
        loadingConversation: false,
        canSend: action.errorCode === "PRO_REQUIRED" ? false : state.canSend,
        errorCode: action.errorCode,
        errorMessage: action.errorMessage || "",
      };
    case AI_CHAT_ACTIONS.CLEAR_ERROR:
      return { ...state, errorCode: null, errorMessage: "" };
    default:
      return state;
  }
}
