function openRefundModal() {
  document.getElementById("refundModal").style.display = "block";
}
function openAcceptModal() {
  document.getElementById("acceptModal").style.display = "block";
}
function openRejectModal() {
  document.getElementById("rejectModal").style.display = "block";
}
function closeModal() {
  document.getElementById("rejectModal").style.display = "none";
  document.getElementById("acceptModal").style.display = "none";
  document.getElementById("refundModal").style.display = "none";
}

function showToast(message, isError = false) {
  Toastify({
    text: message,
    duration: 3000,
    close: true,
    gravity: "top",
    position: "center",
    style: {
      background: isError
        ? "linear-gradient(to right, #b31217, #e52d27)"
        : "linear-gradient(to right, #0f2027, #203a43, #2c5364)",
    },
    className: "custom-toast",
  }).showToast();
}

async function acceptReturn(event, id) {
  event.preventDefault();

  try {
    const isAccepted = true;

    const res = await fetch(`/admin/changeReturnStatus/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAccepted }),
    });

    const data = await res.json();

    if (res.ok) {
      showToast(data.message);
      document.getElementById("refund-div").style.display = "block";
      document.getElementById("refund-status").style.display = "none";
      document.getElementById("cancel-accept").style.display = "none";
      closeModal();
    } else {
      showToast(data.message, true);
    }
  } catch (error) {
    console.error("Error accepting return:", error);
    Swal.fire({
      icon: "error",
      title: "Oops!",
      text: "Server error. Please try again later.",
    });
  }
}

async function rejectReturn(event, id) {
  event.preventDefault();
  console.log("acceptReturn id:", id);

  try {
    const isRejected = true;
    const res = await fetch(`/admin/changeReturnStatus/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRejected }),
    });

    const data = await res.json();

    if (res.ok) {
      showToast(data.message);
      document.getElementById("cancel-accept").style.display = "none";
      document.getElementById("refund-div").style.display = "none";
      document.getElementById(
        "refund-status"
      ).innerHTML = `<span style="color:#b31217;">Return request rejected</span>`;
      document.getElementById("refund-status").style.display = "block";
      closeModal();
    } else {
      showToast(data.message, true);
    }
  } catch (error) {
    console.error("Error accepting return:", error);
    Swal.fire({
      icon: "error",
      title: "Oops!",
      text: "Server error. Please try again later.",
    });
  }
}

async function initiateRefund(event, id, userId) {
  event.preventDefault();

  try {
    console.log("User id", userId);

    console.log("initiateRefund item id :", id);

    const res = await fetch(`/admin/initiateRefund/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    const data = await res.json();

    if (res.ok) {
      showToast(data.message);

      document.getElementById("cancel-accept").style.display = "none";
      document.getElementById("refund-div").style.display = "none";

      document.getElementById(
        "refund-status"
      ).innerHTML = `Refund completed on ${data.refundDate}`;
      document.getElementById("refund-status").style.display = "block";
      closeModal();
    } else {
      showToast(data.message, true);
    }
    closeModal();
  } catch (error) {
    console.error("Error navigating to order management:", error);
  }
}
