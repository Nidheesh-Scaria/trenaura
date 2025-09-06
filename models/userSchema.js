const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
    default: null,
  },
  googleId: {
    type: String,
    unique: true,
    // sparse: true,
    // default: null,
  },
  password: {
    type: String,
    required: false,
    select: false,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  gender:{
    type:String,
    enum:["Male","Female","Other"],
    required:false,
  },
  cart: [
    {
      type: Schema.Types.ObjectId,
      ref: "Cart",
    },
  ],
  wallet: {
    type: Number,
    default: 0,
  },
  wishList: [
    {
      type: Schema.Types.ObjectId,
      ref: "Wishlist",
    },
  ],
  orderHistory: [
    {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
  ],
  createdOn: {
    type: Date,
    default: Date.now,
  },
   referralCode: {
    type: String,
    unique: true
  },
   referredBy: {
    type: String, // store referralCode of referrer
    default: null
  },
  redeemed: {
    type: Boolean,
    default:false,
  },
  redeemedUser: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
      // required: true,
    },
  ],
  searchHistory: [
    {
      category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
      },
      brand: {
        type: String,
      },
      searchOn: {
        type: Date,
        default: Date.now,
      },
    },
  ],
});

const User = mongoose.model("User", userSchema);

module.exports = User;
