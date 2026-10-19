const path = require("node:path");
const http = require("node:http");
const crypto = require("node:crypto");
const express = require("express");
const { Server } = require("socket.io");

function cleanText(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function createChatServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { pingTimeout: 20000 });
  const users = new Map();
  const roomHistory = [];

  app.get("/", (_request, response) => response.sendFile(path.join(__dirname, "login.html")));
  app.get("/healthz", (_request, response) => response.json({ ok: true, users: users.size }));
  app.use(express.static(__dirname));

  function publicUsers() {
    return Array.from(users.values()).map(({ name, age, gender }) => ({ name, age, gender }));
  }

  function reply(callback, payload) {
    if (typeof callback === "function") callback(payload);
  }

  function makeMessage(from, text, to = "room") {
    return { id: crypto.randomUUID(), from, to, text, timestamp: new Date().toISOString() };
  }

  function findRecipient(name) {
    const wanted = cleanText(name, 40).toLowerCase();
    return Array.from(users.entries()).find(([, user]) => user.name.toLowerCase() === wanted);
  }

  io.on("connection", (socket) => {
    socket.on("new-user-joined", (rawUser, callback) => {
      const user = {
        name: cleanText(rawUser?.name, 40),
        age: cleanText(rawUser?.age ?? rawUser?.Age, 3),
        gender: cleanText(rawUser?.gender, 24) || "Prefer not to say",
      };

      if (user.name.length < 2) {
        reply(callback, { ok: false, error: "Enter a name with at least 2 characters" });
        return;
      }
      if (findRecipient(user.name)) {
        reply(callback, { ok: false, error: "That name is already in use" });
        return;
      }

      users.set(socket.id, user);
      socket.broadcast.emit("presence", { type: "joined", user });
      io.emit("user-list", publicUsers());
      reply(callback, { ok: true, user, history: roomHistory });
    });

    socket.on("send", (payload, callback) => {
      const user = users.get(socket.id);
      const text = cleanText(payload?.message, 2000);
      if (!user || !text) {
        reply(callback, { ok: false, error: "Join the chat and enter a message first" });
        return;
      }
      const message = makeMessage(user.name, text);
      roomHistory.push(message);
      if (roomHistory.length > 100) roomHistory.shift();
      socket.broadcast.emit("room-message", message);
      reply(callback, { ok: true, message });
    });

    socket.on("dm", (payload, callback) => {
      const user = users.get(socket.id);
      const text = cleanText(payload?.message, 2000);
      const recipient = findRecipient(payload?.to);
      if (!user || !text || !recipient) {
        reply(callback, { ok: false, error: "That person is no longer online" });
        return;
      }
      if (recipient[0] === socket.id) {
        reply(callback, { ok: false, error: "Choose another person to message" });
        return;
      }
      const message = makeMessage(user.name, text, recipient[1].name);
      io.to(recipient[0]).emit("direct-message", message);
      reply(callback, { ok: true, message });
    });

    socket.on("typing", (payload = {}) => {
      const user = users.get(socket.id);
      if (!user) return;
      const active = Boolean(payload.active);
      const target = cleanText(payload.to, 40) || "room";
      const event = { from: user.name, to: target, active };
      if (target === "room") socket.broadcast.emit("typing", event);
      else {
        const recipient = findRecipient(target);
        if (recipient) io.to(recipient[0]).emit("typing", event);
      }
    });

    socket.on("disconnect", () => {
      const user = users.get(socket.id);
      if (!user) return;
      users.delete(socket.id);
      socket.broadcast.emit("presence", { type: "left", user });
      io.emit("user-list", publicUsers());
    });
  });

  return server;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createChatServer().listen(port, () => console.log(`Pulse is running at http://localhost:${port}`));
}

module.exports = { createChatServer };
