const mongoose = require("mongoose");
const { Schema } = mongoose;

const cartSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  items: [
    {
      productId: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      quantity: {
        type: Number,
        default: 1,
      },
      price: {
        type: Number,
        required: true,
      },
      totalPrice: {
        type: Number,
        required: true,
      },
      size: {
        type: String,
        required: true,
      },
      status: {
        type: String,
        default: "Placed",
      },
      cancellationReason: {
        type: String,
        default: "None",
      },
    },
    { timestamps: true },
  ],
});

const Cart = mongoose.model("Cart", cartSchema);

module.exports = Cart;
