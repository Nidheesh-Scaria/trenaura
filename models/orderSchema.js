const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");
const Product = require("./productSchema");

const orderSchema = new Schema({
  orderId: {
    type: String,
    default: () => "OD" + Date.now() + Math.floor(Math.random() * 1000),
    unique: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
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
      totalPrice: {
        type: Number,
        default: 0,
      },
      offerDiscount: {
        type: Number,
        default: 0,
      },
      couponDiscount: {
        type: Number,
        default: 0,
      },
      variant: {
        type: String,
        default: null,
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
          cancellationReason: {
            type: String,
          },
          isAdminCancelled: {
            type: Boolean,
            default: false,
          },
        },
      ],
      returnRequest: {
        isUserRequested: {
          type: Boolean,
          default: false,
        },
        isReturnInitiated: {
          type: Boolean,
          default: null,
        },
        reason: {
          type: String,
        },
        comment: {
          type: String,
        },
        requestDate: {
          type: Date,
          default: null,
        },
        isAdminApproved: {
          type: Boolean,
          default: null, //null for pending true for approved and false for rejected
        },
        rejectReason: {
          type: String,
        },

        decisionDate: {
          type: Date,
          default: null,
        },
        refundStatus: {
          type: Boolean,
          default: null, //null for pending true for success and false for fail
        },
        refundDate: {
          type: Date,
          default: null,
        },
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
  couponDiscount: {
    type: Number,
    default: 0,
  },
  deliveryCharge: {
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
    default: null,
  },
  currentStatus: {
    type: String,
    default: "Pending",
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
    enum: ["COD", "RAZORPAY", "WALLET"],
    default: "COD",
  },
  paymentStatus: {
    type: String,
    enum: ["Paid", "Unpaid", "Failed", "Pending"],
    default: "Unpaid",
  },
  isOrderPlaced: {
    type: Boolean,
    default: false,
  },
  razorpayOrderId: {
    type: String,
  },
  razorpayPaymentId: {
    type: String,
  },
  razorpaySignature: {
    type: String,
  },
  paymentDate: {
    type: Date,
    default: null,
  },
});

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
