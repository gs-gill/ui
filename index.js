const socket = io();

const params = new URLSearchParams(window.location.search);
const currentUser = {
  name: (params.get("name") || "").trim(),
  Age: params.get("age") || "",
  gender: params.get("gender") || "Other",
};

function chatId(name) {
  return `chat-${encodeURIComponent(name)}`;
}

function AppViewModel() {
  this.people = ko.observableArray([]);
  this.onlineUser = ko.observableArray([]);
  this.connectionStatus = ko.observable("Connecting…");
}

const model = new AppViewModel();
ko.applyBindings(model);

const mainChatbox = document.getElementById("main");
let activeChat = "main";

function setStatus(message, kind = "secondary") {
  model.connectionStatus(message);
  const status = document.getElementById("connection-status");
  status.className = `badge text-bg-${kind}`;
}

function ensureConversation(name) {
  if (!model.people().includes(name)) {
    model.people.push(name);
  }
}

function view_chatbox(name) {
  const next = name === "main" ? mainChatbox : document.getElementById(chatId(name));
  const current = activeChat === "main" ? mainChatbox : document.getElementById(chatId(activeChat));
  if (!next) return;
  current?.classList.add("d-none");
  next.classList.remove("d-none");
  activeChat = name;
  toggleCanvas();
}

function removeConversation(name) {
  model.people.remove(name);
  if (activeChat === name) view_chatbox("main");
}

function dm(button) {
  const name = button.dataset.user;
  if (!name || name === currentUser.name) return;
  ensureConversation(name);
  view_chatbox(name);
}

function toggleCanvas() {
  const openCanvas = document.querySelector(".offcanvas.show");
  if (openCanvas) bootstrap.Offcanvas.getOrCreateInstance(openCanvas).hide();
}

document.querySelectorAll(".main_collapse").forEach((element) => {
  element.addEventListener("click", () => view_chatbox("main"));
});

function display_message(from, conversation, position, text) {
  const chatBody = document.getElementById(`${chatId(conversation)}-msg-list`);
  if (!chatBody) return;

  const row = document.createElement("div");
  row.classList.add("message-row", `justify-content-${position}`);

  const bubble = document.createElement("div");
  bubble.classList.add("message-bubble");

  if (from) {
    const author = document.createElement("p");
    author.classList.add("small", "mb-1", "fw-semibold");
    author.innerText = from;
    bubble.appendChild(author);
  }

  const message = document.createElement("p");
  message.classList.add("small", "p-2", "mb-0", "rounded-3");
  message.innerText = text;
  bubble.appendChild(message);
  row.appendChild(bubble);
  chatBody.appendChild(row);
  chatBody.scrollTop = chatBody.scrollHeight;
}

function sent_message(button) {
  const input = button.parentElement.querySelector("input");
  const message = input.value.trim();
  const recipient = button.dataset.recipient || "main";
  if (!message) return;

  const event = recipient === "main" ? "send" : "dm";
  const payload = recipient === "main" ? { message } : { to: recipient, message };

  socket.emit(event, payload, (response = {}) => {
    if (!response.ok) {
      setStatus(response.error || "Message could not be sent", "danger");
      return;
    }
    display_message("You", recipient, "end", message);
    input.value = "";
    input.focus();
  });
}

function sendOnEnter(event, button) {
  if (event.key === "Enter") {
    event.preventDefault();
    sent_message(button);
  }
}

socket.on("connect", () => {
  setStatus("Connected", "success");
  socket.emit("new-user-joined", currentUser, (response = {}) => {
    if (!response.ok) setStatus(response.error || "Could not join chat", "danger");
  });
});

socket.on("disconnect", () => setStatus("Disconnected — reconnecting…", "warning"));
socket.on("connect_error", () => setStatus("Unable to reach chat server", "danger"));

socket.on("user-list", (users) => {
  model.onlineUser(users.filter((user) => user.name !== currentUser.name));
});

socket.on("user-joined", (user) => {
  display_message("", "main", "center", `${user.name} joined the chat`);
});

socket.on("receive", (data) => {
  display_message(data.name, "main", "start", data.message);
});

socket.on("dm-received", (data) => {
  ensureConversation(data.name);
  display_message(data.name, data.name, "start", data.message);
});

socket.on("disconnected", (user) => {
  display_message("", "main", "center", `${user.name} left the chat`);
});

