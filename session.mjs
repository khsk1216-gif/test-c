const pending = new WeakMap();

// Reuse an existing identity; creating an anonymous one never changes row ownership.
export function ensureSession(
  client,
  lockManager = globalThis.navigator?.locks,
) {
  if (pending.has(client)) return pending.get(client);
  const connect = async () => {
    const existing = await client.auth.getSession();
    if (existing.error) throw existing.error;
    if (existing.data.session) return existing.data.session;
    const created = await client.auth.signInAnonymously();
    if (created.error) throw created.error;
    if (!created.data.session) throw new Error("저장 연결을 만들지 못했어요.");
    return created.data.session;
  };
  const task = Promise.resolve().then(() =>
    lockManager
      ? lockManager.request("moa-private-session", connect)
      : connect(),
  );
  pending.set(client, task);
  void task.finally(() => pending.delete(client)).catch(() => {});
  return task;
}
