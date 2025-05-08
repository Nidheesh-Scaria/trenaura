// const mongoose = require("mongoose");
// const { Schema } = mongoose;

// const productSchema = new Schema(
//   {
//     productName: {
//       type: String,
//       required: true,
//     },
//     description: {
//       type: String,
//       required: true,
//     },
//     brand: {
//       type: String,
//       required: true,
//     },
//     category: {
//       type: Schema.Types.ObjectId,
//       ref: "Category",
//       required: true,
//     },
//     regularPrice: {
//       type: Number,
//       required: true,
//     },
//     salePrice: {
//       type: Number,
//       required: true,
//     },
//     productOffer: {
//       type: Number,
//       default: 0,
//     },
//     quantity: {
//       type: Number,
//       default: true,
//     },
//     color: {
//       type: Number,
//       required: true,
//     },
//     productImage: {
//       type: [String],
//       required: true,
//     },
//     blockStatus: {
//       type: Boolean,
//       default: false,
//     },
//     status: {
//       type: String,
//       enum: ["Available", "Out of Stock", "Discountinued"],
//       required: true,
//       default: "Available",
//     },
//   },
//   { timestamps: true }
// );

// const Product = mongoose.model("Product", productSchema);

// module.exports = Product;

const mongoose = require('mongoose');
const { Schema } = mongoose;

const productSchema = new Schema({
  productName: {
    type: String,
    required: true
  },
  description: { 
    type: String,
    required: true
  },
  brand: {
    type: String,
    required: false
  },
  category: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  regularPrice: {
    type: Number,
    required: true
  },
  salePrice: {
    type: Number,
    required: true
  },
  productOffer: {
    type: Number,
    default: 0
  },
  quantity: {
    type: Number,
    required: true
  },
  size: {
    type: [String],
    default: []
  },
  color: {
    type: String,
    required: true
  },
  productImages: {
    type: [String],
    required: true
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  isDeleted:{
    type: Boolean,
    default: false
  },
  createdOn: {
    type: Date,
    default: Date.now,
  },

  status: {
    type: String,
    enum: ['Available', 'Out of Stock', 'Discontinued'],
    default: 'Available'
  }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);