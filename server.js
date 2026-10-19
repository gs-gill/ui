const path = require("node:path");
const http = require("node:http");
const express = require("express");
const { Server } = require("socket.io");

function cleanText(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function createChatServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const users = new Map();

  app.get("/", (_request, response) => {
    response.sendFile(path.join(__dirname, "login.html"));
  });
  app.use(express.static(__dirname));

  function publicUsers() {
    return Array.from(users.values()).map(({ name, Age, gender }) => ({ name, Age, gender }));
  }

  function reply(callback, payload) {
    if (typeof callback === "function") callback(payload);
  }

  io.on("connection", (socket) => {
    socket.on("new-user-joined", (rawUser, callback) => {
      const user = {
        name: cleanText(rawUser?.name, 40),
        Age: cleanText(rawUser?.Age, 3),
        gender: cleanText(rawUser?.gender, 20) || "Other",
      };

      if (!user.name) {
        reply(callback, { ok: false, error: "A name is required" });
        return;
      }
      const duplicate = Array.from(users.values()).some(
        (candidate) => candidate.name.toLowerCase() === user.name.toLowerCase(),
      );
      if (duplicate) {
        reply(callback, { ok: false, error: "That name is already in use" });
        return;
      }

      users.set(socket.id, user);
      socket.broadcast.emit("user-joined", user);
      io.emit("user-list", publicUsers());
      reply(callback, { ok: true });
    });

    socket.on("send", (payload, callback) => {
      const user = users.get(socket.id);
      const message = cleanText(payload?.message, 2000);
      if (!user || !message) {
        reply(callback, { ok: false, error: "Join the chat and enter a message first" });
        return;
      }
      socket.broadcast.emit("receive", { name: user.name, message });
      reply(callback, { ok: true });
    });

    socket.on("dm", (payload, callback) => {
      const user = users.get(socket.id);
      const recipientName = cleanText(payload?.to, 40);
      const message = cleanText(payload?.message, 2000);
      const recipient = Array.from(users.entries()).find(
        ([, candidate]) => candidate.name.toLowerCase() === recipientName.toLowerCase(),
      );

      if (!user || !message || !recipient) {
        reply(callback, { ok: false, error: "The recipient is no longer online" });
        return;
      }
      io.to(recipient[0]).emit("dm-received", { name: user.name, message });
      reply(callback, { ok: true });
    });

    socket.on("disconnect", () => {
      const user = users.get(socket.id);
      if (!user) return;
      users.delete(socket.id);
      socket.broadcast.emit("disconnected", user);
      io.emit("user-list", publicUsers());
    });
  });

  return server;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createChatServer().listen(port, () => {
    console.log(`Fun Chat is running at http://localhost:${port}`);
  });
}

module.exports = { createChatServer };

