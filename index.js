const params = new URLSearchParams(window.location.search);
const currentUser = {
  name: (params.get("name") || "").trim(),
  age: params.get("age") || "",
  gender: params.get("gender") || "Prefer not to say",
};

if (!currentUser.name) window.location.replace("/");

const storedName = sessionStorage.getItem("pulse-session-name");
if (storedName !== currentUser.name) {
  sessionStorage.setItem("pulse-session-name", currentUser.name);
  sessionStorage.setItem("pulse-session-id", crypto.randomUUID());
}
currentUser.session = sessionStorage.getItem("pulse-session-id") || crypto.randomUUID();
sessionStorage.setItem("pulse-session-id", currentUser.session);

const socket = io();
const state = {
  active: "room",
  joined: false,
  sending: false,
  joinRetries: 0,
  conversations: new Map([["room", { id: "room", name: "Main room", unread: 0, preview: "The public conversation", online: true }]]),
  messages: new Map([["room", []]]),
  onlineUsers: [],
  typing: new Map(),
  alerts: localStorage.getItem("pulse-alerts") === "on",
};

const elements = {
  conversations: document.getElementById("conversation-list"),
  messageList: document.getElementById("message-list"),
  people: document.getElementById("people-list"),
  activeTitle: document.getElementById("active-title"),
  activeStatus: document.getElementById("active-status"),
  activeAvatar: document.getElementById("active-avatar"),
  input: document.getElementById("message-input"),
  composer: document.getElementById("composer"),
  composerError: document.getElementById("composer-error"),
  connection: document.getElementById("connection-status"),
  totalUnread: document.getElementById("total-unread"),
  onlineCount: document.getElementById("online-count"),
  mobileOnline: document.getElementById("mobile-online"),
  mobileUnread: document.getElementById("mobile-unread"),
  typing: document.getElementById("typing-indicator"),
  alertToggle: document.getElementById("alert-toggle"),
  toastRegion: document.getElementById("toast-region"),
};

document.getElementById("self-name").textContent = currentUser.name;
document.getElementById("self-avatar").textContent = initials(currentUser.name);

function initials(name) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function timeLabel(timestamp) {
  return new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(new Date(timestamp));
}

function ensureConversation(name) {
  if (!state.conversations.has(name)) {
    state.conversations.set(name, { id: name, name, unread: 0, preview: "Private conversation", online: state.onlineUsers.some((user) => user.name === name) });
    state.messages.set(name, []);
  }
  return state.conversations.get(name);
}

function updateTitle() {
  const total = Array.from(state.conversations.values()).reduce((sum, item) => sum + item.unread, 0);
  document.title = total ? `(${total}) Pulse` : "Pulse";
  elements.totalUnread.textContent = total;
  elements.totalUnread.hidden = total === 0;
  elements.mobileUnread.textContent = total;
  elements.mobileUnread.hidden = total === 0;
}

function renderConversations() {
  elements.conversations.replaceChildren();
  for (const conversation of state.conversations.values()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `conversation-item${state.active === conversation.id ? " active" : ""}`;
    button.dataset.conversation = conversation.id;
    button.setAttribute("aria-current", state.active === conversation.id ? "page" : "false");

    const avatar = document.createElement("span");
    avatar.className = "conversation-avatar";
    avatar.textContent = conversation.id === "room" ? "#" : initials(conversation.name);
    if (conversation.id !== "room") avatar.classList.toggle("offline", !conversation.online);

    const copy = document.createElement("span");
    copy.className = "conversation-copy";
    const title = document.createElement("strong");
    title.textContent = conversation.name;
    const preview = document.createElement("small");
    preview.textContent = conversation.preview;
    copy.append(title, preview);
    button.append(avatar, copy);

    if (conversation.unread) {
      const unread = document.createElement("b");
      unread.className = "unread-badge";
      unread.textContent = conversation.unread > 99 ? "99+" : conversation.unread;
      button.append(unread);
    }
    button.addEventListener("click", () => selectConversation(conversation.id));
    elements.conversations.append(button);
  }
  updateTitle();
}

function renderPeople() {
  elements.people.replaceChildren();
  if (!state.onlineUsers.length) {
    const empty = document.createElement("div");
    empty.className = "people-empty";
    empty.textContent = "It's quiet here. Invite someone to open the app and join you.";
    elements.people.append(empty);
    return;
  }

  for (const user of state.onlineUsers) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "person-card";
    button.dataset.user = user.name;
    const avatar = document.createElement("span");
    avatar.className = "person-avatar";
    avatar.textContent = initials(user.name);
    const copy = document.createElement("span");
    copy.className = "person-copy";
    const name = document.createElement("strong");
    name.textContent = user.name;
    const details = document.createElement("small");
    details.textContent = [user.age ? `${user.age} yrs` : "", user.gender].filter(Boolean).join(" · ");
    copy.append(name, details);
    const action = document.createElement("span");
    action.className = "person-action";
    action.textContent = "Message ↗";
    button.append(avatar, copy, action);
    button.addEventListener("click", () => { ensureConversation(user.name); selectConversation(user.name); closePanels(); });
    elements.people.append(button);
  }
}

function renderMessages() {
  elements.messageList.replaceChildren();
  const messages = state.messages.get(state.active) || [];
  if (!messages.length) {
    const empty = document.createElement("div");
    empty.className = "message-empty";
    const avatar = document.createElement("span");
    const heading = document.createElement("h2");
    const description = document.createElement("p");
    avatar.textContent = state.active === "room" ? "#" : initials(state.active);
    heading.textContent = state.active === "room" ? "Start the conversation." : `Say hello to ${state.active}.`;
    description.textContent = state.active === "room" ? "Messages sent here are visible to everyone online." : "This is a private conversation between the two of you.";
    empty.append(avatar, heading, description);
    elements.messageList.append(empty);
    return;
  }

  let previousAuthor = "";
  for (const message of messages) {
    if (message.system) {
      const system = document.createElement("div");
      system.className = "system-message";
      system.textContent = message.text;
      elements.messageList.append(system);
      previousAuthor = "";
      continue;
    }

    const mine = message.from === currentUser.name;
    const row = document.createElement("article");
    row.className = `message ${mine ? "mine" : "theirs"}`;
    const showAuthor = previousAuthor !== message.from;
    if (!mine && showAuthor) {
      const avatar = document.createElement("span");
      avatar.className = "message-avatar";
      avatar.textContent = initials(message.from);
      row.append(avatar);
    } else if (!mine) {
      row.append(document.createElement("span"));
    }
    const stack = document.createElement("div");
    stack.className = "message-stack";
    if (!mine && showAuthor) {
      const author = document.createElement("strong");
      author.textContent = message.from;
      stack.append(author);
    }
    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    const text = document.createElement("p");
    text.textContent = message.text;
    const time = document.createElement("time");
    time.dateTime = message.timestamp;
    time.textContent = timeLabel(message.timestamp);
    bubble.append(text, time);
    stack.append(bubble);
    row.append(stack);
    elements.messageList.append(row);
    previousAuthor = message.from;
  }
  elements.messageList.scrollTop = elements.messageList.scrollHeight;
}

function updateComposerAvailability() {
  const conversation = state.conversations.get(state.active);
  const recipientOffline = state.active !== "room" && !conversation?.online;
  elements.input.disabled = recipientOffline;
  document.getElementById("send-button").disabled = !state.joined || state.sending || recipientOffline;
}

function selectConversation(id, { focus = true, markRead = true, close = true } = {}) {
  const conversation = state.conversations.get(id);
  if (!conversation) return;
  state.active = id;
  if (markRead && !document.hidden) conversation.unread = 0;
  elements.activeTitle.textContent = conversation.name;
  elements.activeAvatar.textContent = id === "room" ? "#" : initials(conversation.name);
  elements.activeStatus.textContent = id === "room" ? `${state.onlineUsers.length + 1} ${state.onlineUsers.length ? "people" : "person"} online` : (conversation.online ? "Online now" : "Offline · messages cannot be delivered");
  elements.input.placeholder = id === "room" ? "Message the room" : `Message ${conversation.name}`;
  updateComposerAvailability();
  document.getElementById("mobile-room").classList.toggle("active", id === "room");
  document.getElementById("mobile-chats").classList.toggle("active", id !== "room");
  renderConversations();
  renderMessages();
  renderTyping();
  if (close) closePanels();
  if (focus) elements.input.focus();
}

function addMessage(conversationId, message, notify = false) {
  const conversation = conversationId === "room" ? state.conversations.get("room") : ensureConversation(conversationId);
  state.messages.get(conversationId).push(message);
  conversation.preview = message.system ? message.text : `${message.from === currentUser.name ? "You: " : ""}${message.text}`;

  if (state.active === conversationId) renderMessages();
  if ((state.active !== conversationId || document.hidden) && !message.system) {
    conversation.unread += 1;
    if (notify) showAlert(conversationId, message);
  }
  renderConversations();
}

function showAlert(conversationId, message) {
  const toast = document.createElement("button");
  toast.type = "button";
  toast.className = "message-toast";
  const avatar = document.createElement("span");
  avatar.textContent = initials(message.from);
  const copy = document.createElement("span");
  const author = document.createElement("strong");
  author.textContent = message.from;
  const preview = document.createElement("small");
  preview.textContent = message.text;
  copy.append(author, preview);
  toast.append(avatar, copy);
  toast.addEventListener("click", () => { selectConversation(conversationId); toast.remove(); });
  elements.toastRegion.append(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 250); }, 5500);

  if (state.alerts) playSound();
  if (state.alerts && document.hidden && "Notification" in window && Notification.permission === "granted") {
    const notification = new Notification(`New message from ${message.from}`, { body: message.text, tag: `pulse-${conversationId}` });
    notification.onclick = () => { window.focus(); selectConversation(conversationId); notification.close(); };
  }
}

let audioContext;
function playSound() {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.setValueAtTime(620, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(920, audioContext.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.18);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch {}
}

async function toggleAlerts() {
  state.alerts = !state.alerts;
  if (state.alerts && "Notification" in window && Notification.permission === "default") await Notification.requestPermission();
  localStorage.setItem("pulse-alerts", state.alerts ? "on" : "off");
  elements.alertToggle.classList.toggle("enabled", state.alerts);
  elements.alertToggle.setAttribute("aria-pressed", String(state.alerts));
  elements.alertToggle.setAttribute("aria-label", `Turn message alerts ${state.alerts ? "off" : "on"}`);
  if (state.alerts) playSound();
}

function setConnection(label, status) {
  elements.connection.className = `connection-pill ${status}`;
  elements.connection.querySelector("span").textContent = label;
}

function renderTyping() {
  const names = Array.from(state.typing.entries()).filter(([, target]) => target === state.active).map(([name]) => name);
  elements.typing.textContent = names.length ? `${names.join(", ")} ${names.length === 1 ? "is" : "are"} typing…` : "";
}

let typingTimer;
elements.input.addEventListener("input", () => {
  elements.input.style.height = "auto";
  elements.input.style.height = `${Math.min(elements.input.scrollHeight, 140)}px`;
  socket.emit("typing", { to: state.active, active: true });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => socket.emit("typing", { to: state.active, active: false }), 900);
});

elements.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); elements.composer.requestSubmit(); }
});

elements.composer.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = elements.input.value.trim();
  if (!text) return;
  if (!state.joined) { elements.composerError.textContent = "Reconnecting to chat. Your message is ready to send."; return; }
  if (state.sending) return;
  const conversationId = state.active;
  state.sending = true;
  updateComposerAvailability();
  elements.composerError.textContent = "";
  const eventName = conversationId === "room" ? "send" : "dm";
  const payload = conversationId === "room" ? { message: text } : { to: conversationId, message: text };
  socket.timeout(10000).emit(eventName, payload, (error, response = {}) => {
    state.sending = false;
    updateComposerAvailability();
    if (error || !response.ok) { elements.composerError.textContent = response.error || "Could not confirm delivery. Please try again."; return; }
    addMessage(conversationId, response.message);
    if (state.active === conversationId && elements.input.value.trim() === text) {
      elements.input.value = "";
      elements.input.style.height = "auto";
    }
    socket.emit("typing", { to: conversationId, active: false });
    if (state.active === conversationId) elements.input.focus();
  });
});

function openPanel(id) {
  closePanels();
  document.getElementById(id).classList.add("open");
  document.getElementById("panel-backdrop").classList.add("show");
}
function closePanels() {
  document.querySelectorAll(".conversation-sidebar.open,.people-sidebar.open").forEach((panel) => panel.classList.remove("open"));
  document.getElementById("panel-backdrop").classList.remove("show");
}

document.getElementById("open-conversations").addEventListener("click", () => openPanel("conversation-sidebar"));
document.getElementById("open-people").addEventListener("click", () => openPanel("people-sidebar"));
document.getElementById("mobile-room").addEventListener("click", () => selectConversation("room"));
document.getElementById("mobile-chats").addEventListener("click", () => openPanel("conversation-sidebar"));
document.getElementById("mobile-people").addEventListener("click", () => openPanel("people-sidebar"));
document.getElementById("panel-backdrop").addEventListener("click", closePanels);
document.querySelectorAll("[data-close-panel]").forEach((button) => button.addEventListener("click", closePanels));
elements.alertToggle.addEventListener("click", toggleAlerts);
elements.alertToggle.classList.toggle("enabled", state.alerts);
elements.alertToggle.setAttribute("aria-pressed", String(state.alerts));

socket.on("connect", () => {
  state.joined = false;
  updateComposerAvailability();
  setConnection("Joining…", "warning");
  const connectionId = socket.id;
  socket.timeout(10000).emit("new-user-joined", currentUser, (error, response = {}) => {
    if (socket.id !== connectionId || !socket.connected) return;
    if (error) {
      setConnection("Reconnecting", "warning");
      socket.disconnect().connect();
      return;
    }
    if (!response.ok) {
      if (response.error === "That name is already in use" && state.joinRetries < 5) {
        state.joinRetries += 1;
        setConnection("Waiting to join", "warning");
        setTimeout(() => {
          if (socket.id === connectionId && socket.connected && !state.joined) socket.disconnect().connect();
        }, 1500);
        return;
      }
      setConnection(response.error || "Could not join", "error");
      elements.composerError.textContent = response.error || "Could not join chat.";
      return;
    }
    state.joined = true;
    state.joinRetries = 0;
    updateComposerAvailability();
    setConnection("Connected", "connected");
    elements.composerError.textContent = "";
    state.messages.set("room", response.history || []);
    renderMessages();
  });
});
socket.on("disconnect", () => { state.joined = false; state.sending = false; updateComposerAvailability(); setConnection("Reconnecting", "warning"); });
socket.on("connect_error", () => { state.joined = false; state.sending = false; updateComposerAvailability(); setConnection("Offline", "error"); });

socket.on("user-list", (users) => {
  state.onlineUsers = users.filter((user) => user.name !== currentUser.name);
  for (const conversation of state.conversations.values()) {
    if (conversation.id !== "room") conversation.online = state.onlineUsers.some((user) => user.name === conversation.name);
  }
  elements.onlineCount.textContent = state.onlineUsers.length;
  elements.mobileOnline.textContent = state.onlineUsers.length;
  renderPeople();
  selectConversation(state.active, { focus: false, markRead: false, close: false });
});

socket.on("presence", ({ type, user }) => addMessage("room", { system: true, text: `${user.name} ${type === "joined" ? "joined" : "left"} the room`, timestamp: new Date().toISOString() }));
socket.on("room-message", (message) => addMessage("room", message, state.active !== "room" || document.hidden));
socket.on("direct-message", (message) => addMessage(message.from, message, state.active !== message.from || document.hidden));
socket.on("typing", ({ from, to, active }) => {
  const target = to === currentUser.name ? from : "room";
  if (active) state.typing.set(from, target); else state.typing.delete(from);
  renderTyping();
  if (active) setTimeout(() => { state.typing.delete(from); renderTyping(); }, 2500);
});

window.addEventListener("focus", () => {
  const active = state.conversations.get(state.active);
  if (active) { active.unread = 0; renderConversations(); }
});

renderConversations();
renderPeople();
renderMessages();
updateComposerAvailability();
