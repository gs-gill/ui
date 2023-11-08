let arr = [5, 3, 7, 1, 9, 4, 2];
let speedObject = { slow: 1.5, medium: 0.75, fast: 0.25 };
let color2 = "lime";
let color1 = "red";
function VisualModel() {
  var self = this;

  self.items = ko.observableArray(arr);
  self.algo = ko.observableArray(["bubbleSort", "insertionSort", "quickSort"]);
  self.speed = ko.observable(["slow", "medium", "fast"]);
  self.selectedSpeed = ko.observable("");
  self.selectedAlgo = ko.observable("");
  self.node = ko.observableArray([]);
  self.sort = function () {
    if (self.selectedAlgo() === "bubbleSort") {
      bubbleSort();
    } else if (self.selectedAlgo() === "insertionSort") {
      insertionSort();
    } else {
      quickSort(arr, 0, arr.length - 1);
    }
  };
  self.source = null;
  self.destination = null;
}

var model = new VisualModel();
ko.applyBindings(model);

function setColor(idx1, idx2, color) {
  let left = document.getElementById(idx1);
  let right = document.getElementById(idx2);

  left.style.backgroundColor = color;
  right.style.backgroundColor = color;
}

function shuffle(id1, id2) {
  let lbar = document.getElementById(id1);
  let rbar = document.getElementById(id2);
  let lcheck = lbar.style.transform.length;
  let rcheck = rbar.style.transform.length;
  let dis = Math.abs(id1 - id2) * 2;

  if (lcheck === 0 && rcheck === 0) {
    lbar.style.transform = "translate(" + dis + "rem)";
    rbar.style.transform = "translate(-" + dis + "rem)";
  } else if (lcheck != 0 && rcheck != 0) {
    lbar.style.transform += "translate(" + dis + "rem)";
    rbar.style.transform += "translate(-" + dis + "rem)";
  } else if (lcheck != 0 && rcheck === 0) {
    lbar.style.transform += "translate(" + dis + "rem)";
    rbar.style.transform = "translate(-" + dis + "rem)";
  } else if (lcheck === 0 && rcheck != 0) {
    lbar.style.transform = "translate(" + dis + "rem)";
    rbar.style.transform += "translate(-" + dis + "rem)";
  }
  lbar.id = id2;
  rbar.id = id1;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generate_cube() {
  let h = Math.round(window.innerHeight/20);
  let w = Math.floor(window.innerWidth/20)-1;
  let t1 = window.innerWidth
  let t2 = window.innerHeight
  console.log(t1, t2)
  console.log(t1/20, t2/20)
  model.node.removeAll()
  for (let i = 0; i < 8*8; i++) {
    model.node.push(i)
  }

}

function draw_line(){
  l = document.createElement('svg');
  l.setAttribute('width', '100')
  l.setAttribute('height', '100')
  i = document.createElement('line')
  i.setAttribute('x1', '50');
  i.setAttribute('y1','350');
  i.setAttribute('x1', '50');
  i.setAttribute('y2', '350');
  i.setAttribute('stroke','black');
  l.style = 'width: 500; height: 500';
  l.appendChild(i);
  document.body.appendChild(l);
  // '<svg width="500" height="500"><line x1="50" y1="50" x2="350" y2="350" stroke="black"/></svg>'

}

function set_bg(index){
  ele = document.getElementById(index)
  if (model.source == null || (model.destination != null && model.source != index)){
    console.log('setting source');
    model.source = index;
    ele.style = 'background-color: black';
    
  }
  else if (model.destination == null || model.destination != index){
    console.log('setting destination');
    model.destination = index;
    ele.style = 'background-color: white';
  }

  else if (model.source == index){
    console.log('resetting source');
    model.source = null;
    document.getElementById(index).style.removeProperty('background-color');
  
  // else {
  //   model.destination = null;
  //   document.getElementById(index).style.removeProperty('background-color');
  // }
    
  }

  
  
}



function generate_array() {
  arr = [];
  for (let i = 0; i < 40; i++) {
    var r = Math.floor(Math.random() * 50) + 1;
    arr.push(r);
  }
  model.items.removeAll();
  model.items(arr);
  console.log(arr);
}

async function bubbleSort() {
  console.log("Running Bubble Sort");
  var len = arr.length;

  var isSwapped = false;

  for (let i = 0; i < len; i++) {
    isSwapped = false;

    for (let j = 0; j < len - 1; j++) {
      setColor(j, j + 1, color1);
      if (arr[j] > arr[j + 1]) {
        var temp = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = temp;
        shuffle(j, j + 1);
        isSwapped = true;
      }
      await sleep(speedObject[model.selectedSpeed()] * 1000);
      setColor(j, j + 1, color2);
    }

    if (!isSwapped) {
      break;
    }
  }

  console.log(arr);
}

async function insertionSort() {
  console.log("Running Insertion Sort");
  let i, key, j;
  for (i = 1; i < arr.length; i++) {
    key = arr[i];
    j = i - 1;

    while (j >= 0 && arr[j] > key) {
      arr[j + 1] = arr[j];
      setColor(j, j + 1, color1);
      shuffle(j, j + 1);
      await sleep(speedObject[model.selectedSpeed()] * 1000);
      setColor(j, j + 1, color2);
      j = j - 1;
    }
    arr[j + 1] = key;
  }
}

function swap(arr, i, j) {
  let temp = arr[i];
  arr[i] = arr[j];
  arr[j] = temp;
}

async function partition(arr, low, high) {
  let pivot = arr[high];

  let i = low - 1;
  setColor(high, high, 'orange')
  for (let j = low; j <= high - 1; j++) {
    setColor(i + 1, j, color1);
    if (arr[j] < pivot) {
      i++;
      swap(arr, i, j);
      shuffle(i, j);
      await sleep(speedObject[model.selectedSpeed()] * 1000);
      setColor(i, j, color2);
    } else {
      await sleep(speedObject[model.selectedSpeed()] * 1000);
      setColor(i + 1, j, color2);
    }
  }
  swap(arr, i + 1, high);
  setColor(i + 1, high, color1);
  shuffle(i + 1, high);
  await sleep(speedObject[model.selectedSpeed()] * 1000);
  setColor(i + 1, high, color2);
  return i + 1;
}

async function quickSort(arr, low, high) {
  if (low < high) {
    let pi = await partition(arr, low, high);
    Promise.awaitAll([quickSort(arr, low, pi - 1), quickSort(arr, pi + 1, high)])
  }
}
