async function increaseQuantity(event, id) {
  try {
    event.preventDefault();

    const res = await fetch(`/increaseQuantity/${id}`, {
      method: "PATCH",
      headers: { "Content-type": "application/json" },
    });

    const data = await res.json();

    if (res.ok) {
      Toastify({
        text: data.message,
        duration: 3000,
        close: true,
        gravity: "bottom",
        position: "center",
        style: {
          background: "linear-gradient(to right, #0f2027, #203a43, #2c5364)",
        },
        className: "custom-toast",
      }).showToast();

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } else {
      Toastify({
        text: "Failed to increase quantity",
        duration: 3000,
        close: true,
        gravity: "bottom",
        position: "center",
        style: {
          background: "linear-gradient(to right, #8B0000, #B22222, #DC143C)",
        },
        className: "custom-toast",
      }).showToast();

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  } catch (err) {
    console.error("Error increasing quantity:", err);
  }
}

async function removefromCart(event, id) {
  try {
    event.preventDefault();

    const res = await fetch(`/removefromCart/${id}`, {
      method: "DELETE",
      headers: { "Content-type": "application/json" },
    });

    const data = await res.fetch();

    if (res.ok) {
      const itemElememt = document.getElementById(`cart-item-${id}`);
      if (itemElememt) {
        itemElememt.remove();
      }

      Toastify({
        text: data.message || "item deleted",
        duration: 3000,
        close: true,
        gravity: "bottom",
        position: "center",
        style: {
          background: "linear-gradient(to right, #8B0000, #B22222, #DC143C)",
        },
        className: "custom-toast",
      }).showToast();
    } else {
      console.error("failed in deleteing item");
    }
  } catch (err) {
    console.error("Error removing item:", err);
  }
}

async function decreaseQuantity(event, id) {
  try {
    event.preventDefault();

    const res = await fetch(`/decreaseQuantity/${id}`, {
      method: "PATCH",
      headers: { "Content-type": "application/json" },
    });

    const data = await res.json();

    if (res.ok) {
      Toastify({
        text: data.message,
        duration: 3000,
        close: true,
        gravity: "bottom",
        position: "center",
        style: {
          background: "linear-gradient(to right, #0f2027, #203a43, #2c5364)",
        },
        className: "custom-toast",
      }).showToast();

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } else {
      Toastify({
        text: "Failed to increase quantity",
        duration: 3000,
        close: true,
        gravity: "bottom",
        position: "center",
        style: {
          background: "linear-gradient(to right, #8B0000, #B22222, #DC143C)",
        },
        className: "custom-toast",
      }).showToast();

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  } catch {
    console.error("Error removing item:", err);
  }
}
