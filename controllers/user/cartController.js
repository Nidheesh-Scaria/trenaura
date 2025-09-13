const userSchema = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");
const WalletTopupOrder = require("../../models/walletTopupOrderSchema ");
const CouponUsageSchema = require("../../models/couponUsageSchema ");
const CouponSchema = require("../../models/couponSchema");
const Wishlist = require("../../models/wishlistSchema");

const env = require("dotenv").config();
const httpStatus = require("../../util/statusCodes");
const { MESSAGES } = require("../../util/constants");
const { default: mongoose } = require("mongoose");

// cart management

const addToCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const productId = req.params.id;
    const { size, fromWishList } = req.body;

    const quantity = 1;

    const product = await Product.findById(productId);

    if (!product || product.isDeleted || product.isBlocked) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ message: "Product not available" });
    }

    const price = product.salePrice;
    const totalPrice = price * quantity;

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = await Cart.create({
        userId,
        items: [
          {
            productId,
            quantity,
            price,
            totalPrice,
            size,
          },
        ],
      });
    } else {
      const itemIndex = cart.items.findIndex(
        (item) => item.productId.toString() === productId
      );

      if (itemIndex > -1) {
        cart.items[itemIndex].quantity += quantity;
        cart.items[itemIndex].totalPrice =
          cart.items[itemIndex].quantity * price;
      } else {
        cart.items.push({ productId, quantity, price, totalPrice, size });
      }
    }

    await cart.save();
    const cartCount = await Cart.findOne({ userId }).lean();
    const cartLength = cartCount?.items?.length || 0;

    if (fromWishList) {
      await Wishlist.updateOne(
        { "products.productsId": productId },
        {
          $pull: { products: { productsId: productId } },
        }
      );
      
    }

    return res
      .status(httpStatus.OK)
      .json({ message: "Added to cart", cartCount: cartLength });
  } catch (error) {
    console.error("Error in addToCart:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred. Please try again later.",
    });
  }
};

const loadmyCart = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    const products = await Product.find().limit(8).lean();

    const cart = await Cart.findOne({ userId })
      .populate({
        path: "items.productId",
        match: { isBlocked: false, isDeleted: false },
      })
      .lean();
    let totalPrice = 0;
    //sorting items with a valid productId .
    if (cart?.items?.length) {
      cart.items = cart.items.filter((item) => item.productId !== null);

      //total price of the cart items
      totalPrice = cart.items.reduce((total, item) => {
        return total + item.totalPrice;
      }, 0);
    }

    //if cart is empty
    if (!cart || cart.items.length === 0) {
      return res.render("user/shopping-cart", {
        title: "Shopping Bag",
        adminHeader: true,
        hideFooter: false,
        isCartEmpty: true,
        cartItems: [],
        products,
      });
    }

    return res.render("user/shopping-cart", {
      title: "Shopping Bag",
      adminHeader: true,
      hideFooter: false,
      cartItems: cart.items,
      isCartEmpty: cart.items.length === 0,
      products,
      totalPrice,
    });
  } catch (error) {
    console.error("Error in loadmyCart:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred. Please try again later.",
    });
  }
};

const increaseQuantity = async (req, res) => {
  try {
    const { id: itemId } = req.params;
    const userId = req.session.user;
    const { quantity } = req.body;

    const cart = await Cart.findOne(
      { userId, "items._id": itemId },
      { "items.$": 1 }
    )
      .populate("items.productId", "quantity")
      .lean();

    if (!cart || !cart.items.length) {
      return res.status(404).json({ message: "Item not found" });
    }

    const item = cart.items[0];
    const stock = item.productId.quantity;

    if (quantity >= stock) {
      return res.status(httpStatus.BAD_REQUEST).json({
        message: "Quantity should be less than the total stock of the product",
      });
    }

    // Increase quantity
    await Cart.updateOne(
      { userId, "items._id": itemId },
      { $inc: { "items.$.quantity": 1 } }
    );

    const updatedCart = await Cart.findOne({ userId })
      .populate("items.productId")
      .lean();

    const updatedItem = updatedCart.items.find(
      (item) => item._id.toString() === itemId
    );
    const totalPrice = updatedItem.quantity * updatedItem.price;
    const grandTotal = updatedCart.items.reduce((total, item) => {
      return total + item.price * item.quantity;
    }, 0);
    //updating with new values
    await Cart.updateOne(
      { userId, "items._id": itemId },
      { $set: { "items.$.totalPrice": totalPrice } }
    );

    return res.status(httpStatus.OK).json({
      message: MESSAGES.CART.QUANTITY_INCREASE || "Increased by One",
      quantity: updatedItem.quantity,
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

const decreaseQuantity = async (req, res) => {
  try {
    const { id: itemId } = req.params;
    const userId = req.session.user;

    // Fetch current item first
    const cart = await Cart.findOne(
      { userId, "items._id": itemId },
      { "items.$": 1 }
    ).lean();

    if (!cart || !cart.items.length) {
      return res.status(404).json({ message: "Item not found" });
    }

    const item = cart.items[0];

    if (item.quantity <= 1) {
      return res.status(400).json({ message: "Minimum quantity is 1" });
    }
    // Decrease quantity
    await Cart.updateOne(
      { userId, "items._id": itemId },
      { $inc: { "items.$.quantity": -1 } }
    );

    const updatedCart = await Cart.findOne({ userId })
      .populate("items.productId")
      .lean();

    const updatedItem = updatedCart.items.find(
      (item) => item._id.toString() === itemId
    );

    const totalPrice = updatedItem.quantity * updatedItem.price;
    const grandTotal = updatedCart.items.reduce((total, item) => {
      return total + item.quantity * item.price;
    }, 0);

    //updating with new values
    await Cart.updateOne(
      { userId, "items._id": itemId },
      { $set: { "items.$.totalPrice": totalPrice } }
    );

    return res.status(httpStatus.OK).json({
      message: MESSAGES.CART.QUANTITY_DECREASE || "Quantity decreased",
      quantity: updatedItem.quantity,
      totalPrice,
      grandTotal,
    });
  } catch (error) {
    console.error("Error in decreasing the quantity:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred. Please try again later.",
    });
  }
};

const removefromCart = async (req, res) => {
  try {
    const itemId = req.params.id;
    const userId = req.session.user;

    await Cart.updateOne({ userId }, { $pull: { items: { _id: itemId } } });

    return res
      .status(httpStatus.OK)
      .json({ message: MESSAGES.CART.ITEM_DELETED || "item deleted" });
  } catch (error) {
    console.error("Error in removing item from cart:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred. Please try again later.",
    });
  }
};

const applyCoupon = async (req, res) => {
  try {
    const userId = req.session.user;
    const { couponCode, cartTotal, quantity } = req.body;

    const coupon = await CouponSchema.findOne({
      code: couponCode,
      isActive: true,
    });

    if (!coupon)
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ message: "Invalid Coupon" });

    if (coupon.expiryDate < new Date()) {
      return res.status(400).json({ message: "Coupon expired" });
    }

    if (cartTotal < coupon.minOrderValue) {
      return res.status(400).json({
        message: `Minimum order value should be ${coupon.minOrderValue}`,
      });
    }

    let finalAmount = cartTotal;
    let discountAmount;

    const cart = await Cart.findOne({ userId });
    if (coupon.discountType === "flat") {
      discountAmount = coupon.discountValue;
      finalAmount = cartTotal - coupon.discountValue;
    } else if (coupon.discountType === "percentage") {
      discountAmount = (coupon.discountValue / 100) * cartTotal;
      finalAmount = cartTotal - discountAmount;
    }
    if (finalAmount < 0) finalAmount = 0;

    res.json({
      message: "Coupon applied successfully",
      discountAmount,
      finalAmount,
      couponCode,
    });
  } catch (error) {
    console.error("Error in applyCoupon:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred. Please try again later.",
      finalAmount,
      discountAmount,
    });
  }
};

const removeCoupon = async (req, res) => {
  try {
    const userId = req.session.user;
    const { couponId } = req.body;
  } catch (error) {
    console.error("Error in removeCoupon:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred. Please try again later.",
    });
  }
};

module.exports = {
  addToCart,
  loadmyCart,
  increaseQuantity,
  decreaseQuantity,
  removefromCart,
  applyCoupon,
  removeCoupon,
};
