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
  const sessions = new Map();
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
        session: cleanText(rawUser?.session, 100) || users.get(socket.id)?.session || crypto.randomUUID(),
      };

      if (user.name.length < 2) {
        reply(callback, { ok: false, error: "Enter a name with at least 2 characters" });
        return;
      }
      if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(user.session)) {
        reply(callback, { ok: false, error: "Refresh the page to reconnect" });
        return;
      }
      const currentIdentity = users.get(socket.id);
      if (currentIdentity && (currentIdentity.session !== user.session || currentIdentity.name.toLowerCase() !== user.name.toLowerCase())) {
        reply(callback, { ok: false, error: "This connection already belongs to another name" });
        return;
      }
      const existingSession = sessions.get(user.session);
      if (existingSession && existingSession.name.toLowerCase() !== user.name.toLowerCase()) {
        reply(callback, { ok: false, error: "This session already belongs to another name" });
        return;
      }
      const namesake = findRecipient(user.name);
      if (namesake && namesake[1].session !== user.session) {
        reply(callback, { ok: false, error: "That name is already in use" });
        return;
      }

      if (existingSession && existingSession.socketId !== socket.id) {
        users.delete(existingSession.socketId);
        io.sockets.sockets.get(existingSession.socketId)?.disconnect(true);
      }
      const alreadyJoined = users.has(socket.id);
      users.set(socket.id, user);
      sessions.set(user.session, { socketId: socket.id, name: user.name });
      if (!alreadyJoined && !existingSession) socket.broadcast.emit("presence", { type: "joined", user: { name: user.name } });
      io.emit("user-list", publicUsers());
      reply(callback, { ok: true, user: { name: user.name, age: user.age, gender: user.gender }, history: roomHistory });
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
      if (sessions.get(user.session)?.socketId === socket.id) {
        sessions.delete(user.session);
        socket.broadcast.emit("presence", { type: "left", user: { name: user.name } });
      }
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
