import assert from "node:assert/strict";
import { test } from "node:test";
import { AnswerSaveError, createAnswerSaveQueue } from "./answerSaveQueue.js";

const csrfFailure = Object.assign(new Error("Stale token"), {
  status: 403,
  body: { code: "CSRF_TOKEN_INVALID" },
});

function deferred() {
  let resolve;
  const promise = new Promise((finish) => { resolve = finish; });
  return { promise, resolve };
}

function fixture(write) {
  const sleeping = deferred();
  const wake = deferred();
  const states = [];
  const queue = createAnswerSaveQueue({
    write,
    onChange: (state) => states.push(state),
    wait: (signal) => {
      sleeping.resolve();
      signal.addEventListener("abort", wake.resolve, { once: true });
      return wake.promise;
    },
  });
  return { queue, states, sleeping: sleeping.promise, wake: wake.resolve };
}

test("a failed answer stays queued with its selected value until it saves", async () => {
  const writes = [];
  const { queue, states, sleeping, wake } = fixture(async (...args) => {
    writes.push(args);
    if (writes.length === 1) throw csrfFailure;
  });

  const save = queue.enqueue(35, "B");
  await sleeping;
  assert.equal(states.at(-1).failed[0].selectedAnswer, "B");
  assert.equal(states.at(-1).pending, true);
  wake();
  await save;
  assert.deepEqual(writes, [[35, "B"], [35, "B"]]);
  assert.deepEqual(states.at(-1), { pending: false, failed: [], saved: true });
});

test("after two automatic retries the selection stays available for manual retry", async () => {
  const writes = [];
  const queue = createAnswerSaveQueue({
    write: async (...args) => {
      writes.push(args);
      if (writes.length <= 3) throw csrfFailure;
    },
    onChange() {},
    wait: async () => {},
  });

  await assert.rejects(queue.enqueue(35, "C"), csrfFailure);
  await assert.rejects(queue.waitForPendingSaves(), AnswerSaveError);
  assert.deepEqual(writes, [[35, "C"], [35, "C"], [35, "C"]]);
  await queue.retryFailed();
  await queue.waitForPendingSaves();
  assert.deepEqual(writes[3], [35, "C"]);
});

test("exit cancels a scheduled retry and drains writes before the discard request", async () => {
  const calls = [];
  const { queue, sleeping } = fixture(async () => {
    calls.push("save");
    throw csrfFailure;
  });
  const save = queue.enqueue(35, "A");
  await sleeping;
  queue.cancelRetries();
  await queue.drain();
  calls.push("exit");
  await assert.rejects(save, csrfFailure);
  assert.deepEqual(calls, ["save", "exit"]);
  await assert.rejects(queue.waitForPendingSaves(), AnswerSaveError);
});

test("resume drops pending retries before applying the server answers", async () => {
  const writes = [];
  const { queue, states, sleeping } = fixture(async (...args) => {
    writes.push(args);
    throw csrfFailure;
  });
  const save = queue.enqueue(35, "D");
  await sleeping;
  queue.discard();
  await queue.drain();
  await save;
  assert.deepEqual(writes, [[35, "D"]]);
  assert.deepEqual(states.at(-1), { pending: false, failed: [], saved: false });
});

test("an older answer cannot retry after the user selects a replacement", async () => {
  const writes = [];
  const { queue, sleeping } = fixture(async (...args) => {
    writes.push(args);
    if (writes.length === 1) throw csrfFailure;
  });
  const first = queue.enqueue(35, "A");
  await sleeping;
  await queue.enqueue(35, "B");
  await first;
  assert.deepEqual(writes, [[35, "A"], [35, "B"]]);
});

test("a deleted attempt produces no new failure or retry", async () => {
  const states = [];
  let writes = 0;
  const queue = createAnswerSaveQueue({
    write: async () => {
      writes++;
      throw Object.assign(new Error("Deleted"), { status: 404 });
    },
    onChange: (state) => states.push(state),
  });
  await queue.enqueue(35, "D");
  assert.equal(writes, 1);
  assert.deepEqual(states.at(-1).failed, []);
});
