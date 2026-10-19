const assert = require("node:assert/strict");
const test = require("node:test");
const { io } = require("socket.io-client");
const { createChatServer } = require("../server");

function once(socket, event, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeout);
    socket.once(event, (value) => { clearTimeout(timer); resolve(value); });
  });
}

function emitWithAck(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

async function connect(url) {
  const socket = io(url, { forceNew: true, autoConnect: false });
  const connected = once(socket, "connect");
  socket.connect();
  await connected;
  return socket;
}

test("presence, room history, DMs, typing, validation and disconnects work", async (context) => {
  const server = createChatServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const alice = await connect(url);
  const bob = await connect(url);
  let charlie;
  context.after(async () => {
    alice.close();
    bob.close();
    charlie?.close();
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  });

  assert.equal((await emitWithAck(alice, "new-user-joined", { name: "Alice", age: "25", gender: "Woman" })).ok, true);
  const joined = once(alice, "presence");
  assert.equal((await emitWithAck(bob, "new-user-joined", { name: "Bob", age: "26", gender: "Man" })).ok, true);
  assert.deepEqual(await joined, { type: "joined", user: { name: "Bob", age: "26", gender: "Man" } });

  const duplicate = await connect(url);
  assert.deepEqual(await emitWithAck(duplicate, "new-user-joined", { name: "alice" }), { ok: false, error: "That name is already in use" });
  duplicate.close();

  const roomIncoming = once(bob, "room-message");
  const roomAck = await emitWithAck(alice, "send", { message: "Hello room" });
  assert.equal(roomAck.ok, true);
  assert.match(roomAck.message.id, /^[0-9a-f-]{36}$/);
  assert.equal(roomAck.message.text, "Hello room");
  assert.deepEqual(await roomIncoming, roomAck.message);

  charlie = await connect(url);
  const charlieJoin = await emitWithAck(charlie, "new-user-joined", { name: "Charlie", age: "30" });
  assert.equal(charlieJoin.history.at(-1).text, "Hello room");

  const dmIncoming = once(bob, "direct-message");
  const dmAck = await emitWithAck(alice, "dm", { to: "Bob", message: "Private hello" });
  assert.equal(dmAck.ok, true);
  assert.equal(dmAck.message.to, "Bob");
  assert.deepEqual(await dmIncoming, dmAck.message);

  const typing = once(bob, "typing");
  alice.emit("typing", { to: "Bob", active: true });
  assert.deepEqual(await typing, { from: "Alice", to: "Bob", active: true });

  const missing = await emitWithAck(alice, "dm", { to: "Nobody", message: "Hello?" });
  assert.equal(missing.ok, false);

  const departed = once(bob, "presence");
  alice.close();
  assert.equal((await departed).type, "left");
});
