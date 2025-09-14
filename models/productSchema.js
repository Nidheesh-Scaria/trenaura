const mongoose = require("mongoose");
const { Schema } = mongoose;

const productSchema = new Schema(
  {
    productName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    regularPrice: {
      type: Number,
      required: true,
    },
    salePrice: {
      type: Number,
      required: true,
    },
    productOffer: {
      type: Number,
      default: 0,
    },
    variants: {
      type: Map,
      of: Number,
      default: {
        XS: 0,
        S: 0,
        M: 0,
        L: 0,
        XL: 0,
        XXL: 0,
      },
    },
    size: {
      type: [String],
      default: [],
    },
    //for non sized products
    quantity: {
      type: Number,
      default: 0,
    },
    color: {
      type: String,
      required: true,
    },
    productImages: {
      type: [String],
      required: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["Available", "Out of Stock", "Discontinued"],
      default: "Available",
    },
  },
  { timestamps: true }
);

// Auto-update size before saving

productSchema.pre("save", function (next) {
  // If product has variants 
  if (this.variants && this.variants.size > 0) {
    this.size = [...this.variants.entries()]
      .filter(([_, qty]) => qty > 0)
      .map(([size]) => size);
  } else {
    // For non-sized products
    this.size = [];
  }
  next();
});


module.exports = mongoose.model("Product", productSchema);
