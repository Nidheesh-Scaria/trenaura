const increaseQuantity = async (req, res) => {
  try {
    const { id: itemId } = req.params;
    const userId = req.session.user;
    const { size } = req.body;

    // Fetch the cart item along with product details
    const cart = await Cart.findOne(
      { userId, "items._id": itemId, "items.size": size },
      { "items.$": 1 }
    )
      .populate("items.productId", "variants salePrice isDeleted isBlocked")
      .lean();

    if (!cart || !cart.items?.length) {
      return res.status(httpStatus.NOT_FOUND).json({
        success: false,
        message: "Item not found in cart",
      });
    }

    const item = cart.items[0];

    // Check if product is valid
    if (
      !item.productId ||
      item.productId.isDeleted ||
      item.productId.isBlocked
    ) {
      return res.status(httpStatus.NOT_FOUND).json({
        success: false,
        message: "Product not available for ordering",
      });
    }

    // Get stock for the selected variant size
    const stock = item.productId.variants?.[size];

    if (!stock || stock <= 0) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: `Selected size (${size}) not available for this product`,
      });
    }

    // Maximum allowed quantity: minimum of 5 or available stock
    const maxAllowed = Math.min(5, stock);

    if (item.quantity >= maxAllowed) {
      // Update cart to set quantity to maxAllowed
      await Cart.updateOne(
        { userId, "items._id": itemId, "items.size": size },
        {
          $set: {
            "items.$.quantity": maxAllowed,
            "items.$.totalPrice": maxAllowed * item.price,
          },
        }
      );

      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: `!Sorry, quantity is limited to ${maxAllowed}`,
        quantity: maxAllowed,
        totalPrice: maxAllowed * item.price,
      });
    }

    // Increase quantity by 1
    const newQuantity = item.quantity + 1;
    const totalPrice = newQuantity * item.price;

    await Cart.updateOne(
      { userId, "items._id": itemId, "items.size": size },
      {
        $set: {
          "items.$.quantity": newQuantity,
          "items.$.totalPrice": totalPrice,
        },
      }
    );

    // Fetch updated cart for grand total
    const updatedCart = await Cart.findOne({ userId })
      .populate("items.productId")
      .lean();

    const grandTotal = updatedCart.items.reduce(
      (total, i) => total + i.price * i.quantity,
      0
    );

    return res.status(httpStatus.OK).json({
      success: true,
      message: "Quantity increased by one",
      quantity: newQuantity,
      totalPrice,
      grandTotal,
    });
  } catch (error) {
    console.error("Error in increasing the quantity:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred. Please try again later.",
    });
  }
};

module.exports = increaseQuantity;
