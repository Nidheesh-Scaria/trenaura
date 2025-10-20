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

//wishlist mangement

const loadWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const wishlist = await Wishlist.findOne({ userId })
      .populate({
        path: "products.productsId",
        match: { isBlocked: false, isDeleted: false, size: { $ne: [] } },
        populate: {
          path: "brand",
          select: "brandName",
          match: { isBlocked: false },
        },
      })
      .lean();

    if (!wishlist || !wishlist.products?.length) {
      return res.render("user/wishlist", {
        title: "Wishlist",
        adminHeader: true,
        isWishListEmpty: true,
        wishlistItems: [],
      });
    }

    // sort products by addedOn (latest first), filter invalid, and map useful fields
    const sortedProducts = wishlist.products
      .filter((p) => p.productsId) // remove products that failed populate
      .sort((a, b) => new Date(b.addedOn) - new Date(a.addedOn)) // sort in JS
      .map((item) => {
        const product = item.productsId;

        const availableVariants = Object.entries(product.variants || {})
          .filter(([_, qty]) => qty > 0)
          .map(([size, qty]) => ({ size, qty }));

        return {
          _id: product._id,
          productName: product.productName,
          color: product.color,
          regularPrice: product.regularPrice,
          salePrice: product.salePrice,
          description: product.description,
          brand: product.brand?.brandName || "Unknown",
          productImages: product.productImages,
          availableVariants,
          addedOn: item.addedOn,
        };
      });

    if (sortedProducts.length === 0) {
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
      wishlistItems: sortedProducts,
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
      //checking the product already exists
      const alreadyExists = wishlist.products.some(
        (p) => p.productsId.toString() === productId
      );
      if (alreadyExists) {
        return res.status(httpStatus.OK).json({
          message: "Already in wishlist",
          wishlistCount: wishlist.products.length,
        });
      }

      let productIndex = wishlist.products.findIndex(
        (product) => product.productsId.toString() === productId
      );

      if (productIndex === -1) {
        wishlist.products.push({ productsId: productId });
      }
    }
    await wishlist.save();

    const wishlistCount = wishlist.products.length;
    console.log(wishlistCount);
    return res
      .status(httpStatus.OK)
      .json({ message: MESSAGES.WISHLIST.WISHLISTED, wishlistCount });
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

    const wishlist = await Wishlist.findOne({ userId }).lean();
    const wishlistCount = wishlist ? wishlist.products.length : 0;

    return res
      .status(httpStatus.OK)
      .json({ message: MESSAGES.WISHLIST.ITEM_DELETED || "Deleted", wishlistCount});
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
