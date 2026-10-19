const assert = require("node:assert/strict");
const test = require("node:test");
const { io } = require("socket.io-client");
const { createChatServer } = require("../server");

function once(socket, event, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeout);
    socket.once(event, (value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

function emitWithAck(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

test("public messages, DMs, presence and disconnects work", async (context) => {
  const server = createChatServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const { port } = server.address();
  const alice = io(`http://127.0.0.1:${port}`);
  const bob = io(`http://127.0.0.1:${port}`);
  context.after(async () => {
    alice.close();
    bob.close();
    await new Promise((resolve) => server.close(resolve));
  });

  await Promise.all([once(alice, "connect"), once(bob, "connect")]);
  assert.deepEqual(
    await emitWithAck(alice, "new-user-joined", { name: "Alice-Test", Age: "25", gender: "Female" }),
    { ok: true },
  );

  const bobList = once(bob, "user-list");
  assert.deepEqual(
    await emitWithAck(bob, "new-user-joined", { name: "Bob", Age: "26", gender: "Male" }),
    { ok: true },
  );
  assert.deepEqual((await bobList).map((user) => user.name).sort(), ["Alice-Test", "Bob"]);

  const publicMessage = once(bob, "receive");
  assert.deepEqual(await emitWithAck(alice, "send", { message: "Hello room" }), { ok: true });
  assert.deepEqual(await publicMessage, { name: "Alice-Test", message: "Hello room" });

  const directMessage = once(bob, "dm-received");
  assert.deepEqual(
    await emitWithAck(alice, "dm", { to: "Bob", message: "Private hello" }),
    { ok: true },
  );
  assert.deepEqual(await directMessage, { name: "Alice-Test", message: "Private hello" });

  const departed = once(bob, "disconnected");
  alice.close();
  assert.equal((await departed).name, "Alice-Test");
});

