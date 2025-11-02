document.getElementById('message').innerText=""

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
  e.preventDefault(); // Stop form submission first

  // Clear all previous error messages
  const errorFields = [
    "emailError",
    "passwordError",
    "confirmError",
    "mobileError",
    "nameError",
    "referralError",
  ];
  errorFields.forEach((id) => (document.getElementById(id).innerText = ""));

  let valid = true;

  // Trimmed values for easier checking
  const nameValue = userName.value.trim();
  const emailValue = email.value.trim();
  const mobileValue = mobile.value.trim();
  const passwordValue = password.value.trim();
  const confirmValue = confirmPassword.value.trim();

  // Regular expressions for validation
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const mobilePattern = /^\d{10}$/;
  const passwordNumber = /\d/;
  const passwordSpecial = /[^a-zA-Z0-9\s]/;

  // Name validation
  if (nameValue === "") {
    document.getElementById("nameError").innerText = "Name is required.";
    valid = false;
  }

  // Mobile validation
  if (mobileValue === "") {
    document.getElementById("mobileError").innerText = "Mobile number is required.";
    valid = false;
  } else if (!mobilePattern.test(mobileValue)) {
    document.getElementById("mobileError").innerText = "Mobile number must be exactly 10 digits.";
    valid = false;
  }

  // Email validation
  if (emailValue === "") {
    document.getElementById("emailError").innerText = "Email is required.";
    valid = false;
  } else if (!emailPattern.test(emailValue)) {
    document.getElementById("emailError").innerText = "Please enter a valid email address.";
    valid = false;
  }

  // Password validation
  if (passwordValue === "") {
    document.getElementById("passwordError").innerText = "Password is required.";
    valid = false;
  } else if (passwordValue.length < 6) {
    document.getElementById("passwordError").innerText = "Password must be at least 6 characters.";
    valid = false;
  } else if (!passwordNumber.test(passwordValue)) {
    document.getElementById("passwordError").innerText = "Password must contain at least one number (0-9).";
    valid = false;
  } else if (!passwordSpecial.test(passwordValue)) {
    document.getElementById("passwordError").innerText = "Password must contain at least one special symbol (e.g., !, @, #).";
    valid = false;
  }

  // Confirm password validation
  if (confirmValue === "") {
    document.getElementById("confirmError").innerText = "Please confirm your password.";
    valid = false;
  } else if (passwordValue !== confirmValue) {
    document.getElementById("confirmError").innerText = "Passwords do not match.";
    valid = false;
  }

  // If all validations pass, submit the form
  if (valid) {
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = "Submitting...";
    }
    e.target.submit();
  }
});

