var cur_on_user = [{name:'Bert', Age:22, gender:'M'},
{name:'Charles', Age:21, gender:'M'},
{name:'Denise', Age:23, gender:'F'},
{name:'Ronald', Age:25, gender:'M'}, {name:'Michael', Age:20, gender:'F'}]
var cur_chat_user = [];
function AppViewModel() {
    var self = this;

    self.people = ko.observableArray(cur_chat_user);

    self.onlineUser = ko.observableArray(cur_on_user)

}

var model = new AppViewModel();
ko.applyBindings(model);
const s_width = screen.width
const main_chatbox = document.getElementById('main')
var prv_id = 'private_col'
var active_chat = 'main'
const channel_collapse = document.getElementsByClassName('collapse main_collapse')

function view_chatbox(to_user){
    const chatbox = document.getElementById(to_user)
    const cur_chatbox = document.getElementById(active_chat)
    cur_chatbox.classList.add('d-none')
    chatbox.classList.remove('d-none')
    active_chat = to_user
    toggleCanvas()
}

function remove(data){
    r_user = data.parentElement.innerText
    cur_chat_user = cur_chat_user.filter(x => x != r_user);
    //Add advance if loop below
    if (s_width <= 640){
        prv_id = 'private_canv_col'
    }
    if (cur_chat_user.length == 0){
        const prv = document.getElementById(prv_id)
        prv.classList.remove('show')
    }
    model.people(cur_chat_user)
    if (r_user == active_chat){
        main_chatbox.classList.remove('d-none')
        active_chat = 'main'
    }
}

function dm(data){
    const u_id = 'user' + data.parentElement.parentElement.id.replace('col', '');
    const user_name = document.getElementById(u_id).innerText
    //Add advance if loop below
    if (s_width <= 640){
        prv_id = 'private_canv_col'
    }
    const prv = document.getElementById(prv_id)
    prv.classList.add('show')
    if (cur_chat_user.includes(user_name)) return;
    cur_chat_user.push(user_name)
    model.people(cur_chat_user)
    view_chatbox(user_name)
    toggleCanvas()

}

function toggleCanvas(){
    const off_canv = document.getElementsByClassName('offcanvas show')
    if (off_canv[0]){
        off_canv[0].classList.toggle('show')
    }
}

[...channel_collapse].forEach((e) => {
e.addEventListener('click', function(){
    view_chatbox('main')
})
})
