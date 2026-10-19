const form = document.getElementById("join-form");
const nameInput = document.getElementById("name");
const ageInput = document.getElementById("age");

function setError(input, message) {
  input.setAttribute("aria-invalid", String(Boolean(message)));
  document.getElementById(`${input.id}-error`).textContent = message;
}

function validate() {
  const name = nameInput.value.trim();
  const age = Number(ageInput.value);
  setError(nameInput, name.length < 2 ? "Use at least 2 characters." : "");
  setError(ageInput, !Number.isInteger(age) || age < 13 || age > 120 ? "Enter an age from 13 to 120." : "");
  return name.length >= 2 && Number.isInteger(age) && age >= 13 && age <= 120;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!validate()) return;
  const params = new URLSearchParams({ name: nameInput.value.trim(), age: ageInput.value, gender: document.getElementById("gender").value });
  window.location.assign(`/index.html?${params}`);
});

[nameInput, ageInput].forEach((input) => input.addEventListener("input", () => {
  if (input.getAttribute("aria-invalid") === "true") validate();
}));
