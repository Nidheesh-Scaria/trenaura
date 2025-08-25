const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");
const Product = require("./productSchema");

const orderSchema = new Schema({
  orderId: {
    type: String,
    default: () => uuidv4(),
    unique: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  orderedItems: [
    {
      productId: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
      price: {
        type: Number,
        default: 0,
      },
    },
  ],
  totalPrice: {
    type: Number,
    required: true,
  },
  discount: {
    type: Number,
    default: 0,
  },
  finalAmount: {
    type: Number,
    required: true,
  },
  address: {
    type: Schema.Types.ObjectId,
    ref: "Address",
    required: true,
  },
  invoiceDate: {
    type: Date,
  },
  statusHistory: [
    {
      status: {
        type: String,
        enum: [
          "Pending",
          "Processing",
          "Shipped",
          "OutForDelivery",
          "Delivered",
          "Cancelled",
          "Returned",
        ],
        default: "Pending",
      },
      changedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  currentStatus: {
    type: String,
    default: "Pending"
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  couponApplied: {
    type: Boolean,
    default: false,
  },
  paymentMethod: {
    type: String,
    enum: ["COD", "Razorpay", "PayPal"],
    default: "COD",
  },
  paymentStatus: {
    type: String,
    enum: ["Paid", "Unpaid", "Failed"],
    default: "Unpaid",
  },
});

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
