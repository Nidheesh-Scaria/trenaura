const form = document.getElementById("loginForm");

//sweet alert
const message = document.getElementById("message").value;
const warning = document.getElementById("errorMessage").value;
if (message) {
  Swal.fire({
    title: message,
    showClass: {
      popup: `
        animate__animated
        animate__fadeInUp
        animate__faster
      `,
    },
    hideClass: {
      popup: `
        animate__animated
        animate__fadeOutDown
        animate__faster
      `,
    },
  });
}


if (warning) {
  
  document.getElementById('mainError').innerText = warning;
}


form.addEventListener("submit", function (e) {
  // Clear previous errors
  document.getElementById("emailError").innerText = "";
  document.getElementById("passwordError").innerText = "";
  document.getElementById("mainError").innerText = "";
  
  

  // Get field values
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  

  let valid = true;

  // Validate Email
  if (email === "") {
    
    document.getElementById("emailError").innerText = "Email is required";
    valid = false;
  }

  // Validate Password
  if (password === "") {
    
    document.getElementById("passwordError").innerText = "Password is required";
    valid = false;
  }

  if (!email.trim().includes("@")) {
   
    document.getElementById("emailError").innerText = "Email is invalid.";
    valid = false;
  }
  if (!valid) {
    e.preventDefault();
  }

});
