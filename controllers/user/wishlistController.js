const userSchema = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const Wishlist = require("../../models/wishlistSchema");
const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");
const WalletTopupOrder = require("../../models/walletTopupOrderSchema ");

const bcrypt = require("bcrypt");
const saltRounds = 10;
const nodeMailer = require("nodemailer");
const { isLoggedIn } = require("../../middleware/userAuth");
const env = require("dotenv").config();
const httpStatus = require("../../util/statusCodes");
const { MESSAGES } = require("../../util/constants");
const { default: mongoose } = require("mongoose");
const razorpay = require("../../config/razorpay");
const razorpayInstance = require("../../config/razorpay");
const crypto = require("crypto");

//wishlist mangement

const loadWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const wishlist = await Wishlist.findOne({ userId })
      .populate({
        path: "products.productsId",
        match: { isBlocked: false, isDeleted: false },
      })
      .lean();
    //sorting items with a valid productId .
    if (wishlist?.products?.length) {
      wishlist.products = wishlist.products.filter(
        (product) => product.productsId !== null
      );
    }

    if (!wishlist || wishlist.products.length === 0) {
      return res.render("user/wishlist", {
        title: "Wishlist",
        adminHeader: true,
        isWishListEmpty: true,
        wishlistItems: [],
      });
    }

    return res.render("user/wishlist", {
      title: "Wishlist",
      adminHeader: true,
      wishlistItems: wishlist.products,
    });
  } catch (error) {
    console.error("Error in rendering wishlist:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

const addWishlist = async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.session.user;

    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = await Wishlist.create({
        userId,
        products: [{ productsId: productId }],
      });
    } else {
      let productIndex = wishlist.products.findIndex(
        (product) => product.productsId.toString() === productId
      );

      if (productIndex === -1) {
        wishlist.products.push({ productsId: productId });
      }
    }
    await wishlist.save();

    return res
      .status(httpStatus.OK)
      .json({ message: MESSAGES.WISHLIST.WISHLISTED });
  } catch (error) {
    console.error("Error in adding wishlist:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const productId = req.params.id;

    await Wishlist.updateOne(
      { userId },
      { $pull: { products: { productsId: productId } } }
    );

    return res
      .status(httpStatus.OK)
      .json({ message: MESSAGES.WISHLIST.ITEM_DELETED || "Deleted" });
  } catch (error) {
    console.error("Error in deleting wishlist item:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

module.exports = {
  loadWishlist,
  addWishlist,
  removeFromWishlist,
};
