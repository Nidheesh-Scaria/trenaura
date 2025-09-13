async function removeFromWishlist(event, id) {
  event.preventDefault();

  const res = await fetch(`/removeFromWishlist/${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const data = await res.json();

  if (res.ok) {
    Toastify({
      text: data.message,
      duration: 3000,
      close: true,
      gravity: "top",
      position: "center",
      style: {
        background: "linear-gradient(to right, #0f2027, #203a43, #2c5364)",
      },
      className: "custom-toast",
      onClick: () => {
        alert("Toast clicked!");
      },
    }).showToast();
    document.getElementById(`wishlist-item-${id}`)?.remove();
  } else {
    console.log("error deleting wishlist");
  }
}

document.querySelectorAll(".size-btn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    document
      .querySelectorAll(".size-btn")
      .forEach((b) => b.classList.remove("selected"));
    e.target.classList.add("selected");
  });
});

async function addToCarts(event, id) {
  event.preventDefault();
  document.getElementById(`error-${id}`).innerText = "";
  const selectedBtn = document.querySelector(".size-btn.selected");

  if (!selectedBtn) {
    document.getElementById(`error-${id}`).innerText =
      "Please select a size before adding to cart.";
    return;
  }

  const size = selectedBtn.value;
  const fromWishList = true;

  const res = await fetch(`/addToCart/${id}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ size, fromWishList }),
  });

  const data = await res.json();

  if (res.ok) {
    Toastify({
      text: data.message,
      duration: 3000,
      close: true,
      gravity: "top",
      position: "center",
      style: {
        background: "linear-gradient(to right, #0f2027, #203a43, #2c5364)",
      },
      className: "custom-toast",
    }).showToast();

    document.getElementById(`wishlist-item-${id}`)?.remove();
  } else {
    console.error("Failed to add item:", data.message || "Unknown error");
  }
}
