const socket = io('https://flaxen-boundless-buckthornpepperberry.glitch.me/');

var cur_on_user = [
  { name: "Bert", Age: 22, gender: "M" },
  { name: "Charles", Age: 21, gender: "M" },
  { name: "Denise", Age: 23, gender: "F" },
  { name: "Ronald", Age: 25, gender: "M" },
  { name: "Michael", Age: 20, gender: "F" },
];
var cur_chat_user = [];
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const gender = urlParams.get('gender')
const user_name = urlParams.get('name')
const user_age = urlParams.get('age')
const cur_data = { name: user_name, Age: user_age, gender: gender }
console.log('query', user_name, user_age, gender)


function AppViewModel() {
  var self = this;

  self.people = ko.observableArray(cur_chat_user);

  self.onlineUser = ko.observableArray([]);
}

var model = new AppViewModel();
ko.applyBindings(model);
socket.emit('new-user-joined', cur_data)
const s_width = screen.width;
const main_chatbox = document.getElementById("main");
var prv_id = "private_col";
var active_chat = "main";
const channel_collapse = document.getElementsByClassName(
  "collapse main_collapse"
);
const btn = document.getElementsByClassName("btn-warning");

function view_chatbox(to_user) {
  const chatbox = document.getElementById(to_user);
  const cur_chatbox = document.getElementById(active_chat);
  cur_chatbox.classList.add("d-none");
  chatbox.classList.remove("d-none");
  active_chat = to_user;
  toggleCanvas();
}

function remove(data) {
  r_user = data.parentElement.innerText;
  cur_chat_user = cur_chat_user.filter((x) => x != r_user);
  //Add advance if loop below
  if (s_width <= 640) {
    prv_id = "private_canv_col";
  }
  if (cur_chat_user.length == 0) {
    const prv = document.getElementById(prv_id);
    prv.classList.remove("show");
  }
  model.people(cur_chat_user);
  if (r_user == active_chat) {
    main_chatbox.classList.remove("d-none");
    active_chat = "main";
  }
}

function dm(data) {
  const u_id = "user" + data.parentElement.parentElement.id.replace("col", "");
  const user_name = document.getElementById(u_id).innerText;
  //Add advance if loop below
  if (s_width <= 640) {
    prv_id = "private_canv_col";
  }
  const prv = document.getElementById(prv_id);
  prv.classList.add("show");
  if (cur_chat_user.includes(user_name)) return;
  cur_chat_user.push(user_name);
  model.people(cur_chat_user);
  view_chatbox(user_name);
  toggleCanvas();
}

function toggleCanvas() {
  const off_canv = document.getElementsByClassName("offcanvas show");
  if (off_canv[0]) {
    off_canv[0].classList.toggle("show");
  }
}

[...channel_collapse].forEach((e) => {
  e.addEventListener("click", function () {
    view_chatbox("main");
  });
});

function display_message(from, to, position, txt) {
  console.log('display to', to)
  const chat_body = document.getElementById(to + '-msg-list')
  o_div = document.createElement('div')
  o_div.classList.add('o_div', 'justify-content-' + position)
  o_div.style.setProperty('display', 'grid')
  n_div = document.createElement('div')
  n_div.classList.add('n_div')
  m_div = document.createElement('div')
  m_div.classList.add('m_div')
  message = document.createElement('p')
  message.classList.add('small', 'p-2', 'ms-3', 'mb-3', 'rounded-3')
  u_name = document.createElement('p')
  u_name.classList.add('small', 'mb-1')
  message.innerText = txt
  message.style.setProperty('background-color', '#f5f6f7')
  u_name.innerText = from
  m_div.appendChild(message)
  n_div.appendChild(u_name)
  o_div.appendChild(n_div)
  o_div.appendChild(m_div)
  chat_body.appendChild(o_div)
  chat_body.scrollTop = chat_body.scrollHeight

}

function sent_message(e) {
  const id = e.id;
  const inp_field = e.parentElement.children[0]
  if (id == "Send" && inp_field.value != '') {
    socket.emit('send', { message: inp_field.value, id })
    display_message('You', 'main', 'end', inp_field.value)
    inp_field.value = ''
    inp_field.focus()
  } else if (inp_field.value != '') {
    const to = id.split('-')[0]
    console.log('send msg', to)
    const data = { to: to, from: user_name, message: inp_field.value }
    socket.emit('dm', data)
    display_message('You', to, 'end', inp_field.value)
    inp_field.value = ''
    inp_field.focus()
  }
}

socket.on('userIncrement', data => {
  console.log('user increment called', data)
  for (var key in data) {
    model.onlineUser.push(data[key])

  }
  model.onlineUser.push(cur_data)
})

socket.on('user-joined', data => {
  console.log('user joined', data)
  display_message('', 'main', 'center', `${data.detail.name} Joined the Chat`)
  model.onlineUser.push(data.detail)
})

socket.on('receive', data => {
  display_message(data.name, 'main', 'start', data.message)
})

socket.on('dm-received', data => {
  console.log('dm received called')
  if (model.people.indexOf(data.name) === -1) {
    model.people.push(data.name)
  }
  display_message(data.name, data.name, 'start', data.message)
})

socket.on('disconnected', data => {
  console.log('dis', data, data.onUsers)
  display_message('', 'main', 'center', `${data.detail.name} left the Chat`)
  model.onlineUser.pop(data.detail)
})