const form = document.getElementById("signupForm");
const email = document.getElementById("email");
const userName = document.getElementById("name");
const mobile = document.getElementById("mobile");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");

//sweet alert
const message = document.getElementById('message').value;
if (message) {
  let timerInterval;
Swal.fire({
  title: "OOPS",
  html: message,
  timer: 3000,
  timerProgressBar: true,
  didOpen: () => {
    // Swal.showLoading();
    const timer = Swal.getPopup().querySelector("b");
    timerInterval = setInterval(() => {
      timer.textContent = `${Swal.getTimerLeft()}`;
    }, 100);
  },
  willClose: () => {
    clearInterval(timerInterval);
  }
}).then((result) => {
  /* Read more about handling dismissals below */
  if (result.dismiss === Swal.DismissReason.timer) {
    console.log("I was closed by the timer");
  }
});
 
}






form.addEventListener("submit", function (e) {
  // Clear previous error messages
  document.getElementById("emailError").innerText = "";
  document.getElementById("passwordError").innerText = "";
  document.getElementById("confirmError").innerText = "";
  document.getElementById("mobileError").innerText = "";
  document.getElementById("nameError").innerText = "";

  let valid = true;

  if (mobile.value.trim() === "") {
    e.preventDefault();
    document.getElementById("mobileError").innerText =
      "Mobile number is required.";
    valid = false;
  }

  if (userName.value.trim() === "") {
    e.preventDefault();
    document.getElementById("nameError").innerText = "Name is required.";
    valid = false;
  }

  if (email.value.trim() === "") {
    e.preventDefault();
    document.getElementById("emailError").innerText = "Email is required.";
    valid = false;
  }

  if (password.value.trim() === "") {
    e.preventDefault();
    document.getElementById("passwordError").innerText =
      "Password is required.";
    valid = false;
  }

  if (confirmPassword.value.trim() === "") {
    e.preventDefault();
    document.getElementById("confirmError").innerText =
      "Please confirm your password.";
    valid = false;
  } else if (password.value !== confirmPassword.value) {
    e.preventDefault();
    document.getElementById("confirmError").innerText =
      "Passwords do not match.";
    valid = false;
  }



  if (!email.value.trim().includes("@")) {
    e.preventDefault();
    document.getElementById("emailError").innerText = "Email is invalid.";
  } else if (mobile.value.trim().length < 10||mobile.value.trim().length > 10) {
    e.preventDefault();
    document.getElementById("mobileError").innerText = "Invalid mobile number!";
  } else if (password.value.trim().length < 4) {
    e.preventDefault();
    document.getElementById("passwordError").innerText =
      "Password must be at least 4 characters!";
  } else if (password.value !== confirmPassword.value) {
    e.preventDefault();
    document.getElementById("confirmError").innerText =
      "Passwords do not match.";
    valid = false;
  }

  if (!valid) {
    return;
  }

  e.target.submit();

});
