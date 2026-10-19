import test from "node:test";
import assert from "node:assert/strict";
import { ensureSession } from "../session.mjs";

test("keeps an existing identity without creating or replacing an account", async () => {
  let creations = 0;
  const session = { user: { id: "existing" } };
  const client = {
    auth: {
      getSession: async () => ({ data: { session } }),
      signInAnonymously: async () => {
        creations++;
      },
    },
  };
  assert.equal(await ensureSession(client, null), session);
  assert.equal(creations, 0);
});
test("simultaneous opens create only one anonymous session", async () => {
  let creations = 0;
  const session = { user: { id: "anonymous", is_anonymous: true } };
  const client = {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      signInAnonymously: async () => {
        creations++;
        return { data: { session } };
      },
    },
  };
  const [a, b] = await Promise.all([
    ensureSession(client, null),
    ensureSession(client, null),
  ]);
  assert.equal(a, session);
  assert.equal(b, session);
  assert.equal(creations, 1);
});
test("a failed connection can be retried without switching to another users data", async () => {
  let calls = 0;
  const session = { user: { id: "retry" } };
  const client = {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      signInAnonymously: async () =>
        ++calls === 1 ? { error: new Error("offline") } : { data: { session } },
    },
  };
  await assert.rejects(ensureSession(client, null), /offline/);
  assert.equal(await ensureSession(client, null), session);
});
test("cross-tab lock wraps the identity check and creation", async () => {
  let locked = false;
  const session = { user: { id: "lock" } };
  const manager = {
    request: async (name, fn) => {
      assert.equal(name, "moa-private-session");
      locked = true;
      try {
        return await fn();
      } finally {
        locked = false;
      }
    },
  };
  const client = {
    auth: {
      getSession: async () => {
        assert.equal(locked, true);
        return { data: { session } };
      },
    },
  };
  assert.equal(await ensureSession(client, manager), session);
});
