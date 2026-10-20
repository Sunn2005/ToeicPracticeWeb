export function isConfirmedHttpFailure(error) {
  return Number.isInteger(error?.status);
}

export function createChatSendAttemptRegistry(createIdempotencyKey) {
  const attempts = new Map();

  return {
    prepare(conversationId, content) {
      const retained = attempts.get(conversationId);
      if (retained?.content === content) return retained;

      const attempt = {
        conversationId,
        content,
        idempotencyKey: createIdempotencyKey(),
      };
      attempts.set(conversationId, attempt);
      return attempt;
    },

    clear(attempt) {
      const retained = attempts.get(attempt?.conversationId);
      if (retained?.idempotencyKey === attempt?.idempotencyKey) {
        attempts.delete(attempt.conversationId);
      }
    },
  };
}
