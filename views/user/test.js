let currentCancelButton = null;
function openCancelModal(id, btn) {
  currentCancelButton = btn;
  $("#cancelOrderId").val(id);
  $("#cancelOrderModal").modal("show");
}

$("#cancelOrderForm").on("submit", function (e) {
  e.preventDefault();
  const id = $("#cancelOrderId").val();
  if (currentCancelButton) currentCancelButton.disabled = true;

  fetch(`cancelOrder/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "Cancelled" }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        $("#cancelOrderModal").modal("hide");

        const statusEl = document.getElementById(`statusHistory-${id}`);
        if (statusEl) {
          statusEl.innerText = "Cancelled";
          statusEl.style.color = "#dc3545";
        }

        // Disable the cancel button
        const btn = document.getElementById(`cancelBtn-${id}`);

        if (btn) {
          btn.disabled = true;
          btn.classList.remove("btn-secondary");
          btn.classList.add("diabledButton");
        }

        Swal.fire("Cancelled!", data.message, "success");
      } else {
        Swal.fire("Error", data.message, "error");
        if (currentCancelButton) currentCancelButton.disabled = false;
      }
    })
    .catch(() => {
      Swal.fire("Error", "Something went wrong", "error");
      if (currentCancelButton) currentCancelButton.disabled = false;
    });
});

async function orderDetails(event, id) {
  event.preventDefault();
  window.location.href = `/orderDetails/${id}`;
}
