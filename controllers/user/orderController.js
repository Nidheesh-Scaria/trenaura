const userSchema = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const Wishlist = require("../../models/wishlistSchema");
const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");
const WalletTopupOrder = require("../../models/walletTopupOrderSchema ");
const CouponSchema = require("../../models/couponSchema");
const CouponUsageSchema = require("../../models/couponUsageSchema ");

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

//order management

const loadMyOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const raw = parseInt(req.query.page, 10);
    const page = Math.max(1, Number.isFinite(raw) ? raw : 1);
    const limit = 5;

    const myOrders = await Order.find({ userId })
      .populate({
        path: "orderedItems.productId",
        match: { isBlocked: false, isDeleted: false },
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const filteredOrders = myOrders
      .map((order) => {
        order.orderedItems = order.orderedItems
          .filter((item) => item.productId !== null)
          .map((item) => ({
            id: item._id,
            productId: item.productId._id,
            productName: item.productId.productName,
            productImages: item.productId.productImages,
            quantity: item.quantity,
            regularPrice: item.productId.regularPrice,
            price: item.price,
            totalPrice: item.totalPrice,
            statusHistory:
              item.statusHistory[item.statusHistory.length - 1].status,
            isAdminCancelled:
              item.statusHistory[item.statusHistory.length - 1]
                .isAdminCancelled,
            isReturnInitiated: item.returnRequest.isReturnInitiated,
          }));
        order.formattedDate = new Date(order.createdAt).toLocaleDateString();
        return order;
      })
      .filter((order) => order.orderedItems.length > 0);

    console.log("loadMyOrder", filteredOrders.isReturnInitiated);

    const count = await Order.countDocuments({ userId });

    if (filteredOrders.length === 0) {
      return res.render("user/myOrder", {
        title: "My order",
        adminHeader: true,
        isMyOrderEmpty: true,
        myOrder: [],
      });
    }

    return res.render("user/myOrder", {
      title: "My order",
      adminHeader: true,
      myOrder: filteredOrders,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      isMyOrderEmpty: filteredOrders.length === 0,
    });
  } catch (error) {
    console.error("Error in loadMyOrder:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

const orderDetails = async (req, res) => {
  try {
    const userId = req.session.user;
    const itemId = req.params.id;

    const orders = await Order.findOne(
      { userId, "orderedItems._id": itemId },
      {
        orderedItems: { $elemMatch: { _id: itemId } },
        totalPrice: 1,
        discount: 1,
        finalAmount: 1,
        address: 1,
        createdAt: 1,
        paymentMethod: 1,
        paymentDate: 1,
        paymentStatus: 1,
        orderId: 1,
      }
    )
      .populate("userId", "name")
      .populate(
        "orderedItems.productId",
        "productName productImages description"
      )
      .lean();

    const item = orders.orderedItems[0];

    let latestStatus = item.statusHistory[item.statusHistory.length - 1];
    let updatedDate = latestStatus.changedAt;
    let latestOrderStatus = latestStatus.status;
    const date = new Date(updatedDate).toLocaleString();
    const orderedDate = new Date(orders.createdAt).toLocaleDateString();

    const fullStatusHistory = item.statusHistory.map((history) => ({
      status: history.status,
      changedAt: new Date(history.changedAt).toLocaleString(),
      cancellationReason: history.cancellationReason,
      isAdminCancelled: history.isAdminCancelled,
    }));

    const isUserRequested = item.returnRequest.isUserRequested;
    console.log("orderDetails isUserRequested:", isUserRequested);

    const isCancelled = fullStatusHistory.some((h) => h.status === "Cancelled");

    const address = await Address.findOne(
      { "address._id": orders.address },
      { "address.$": 1 }
    ).lean();

    return res.render("user/orderDetails", {
      title: "Order details",
      adminHeader: true,
      orders,
      date,
      address: address.address[0],
      latestOrderStatus,
      orderedDate,
      fullStatusHistory,
      isCancelled,
      itemId,
      isUserRequested,
    });
  } catch (error) {
    console.error("Error in orderDetails :", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

const loadAddressForOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const productId = req.params.id;
    const { size, quantity } = req.query;
    const user = await userSchema.findById(userId);
    const userAddresses = await Address.findOne({ userId });

    const addresses = userAddresses ? userAddresses.address : [];

    // Converting Mongoose documents to plain objects
    const plainAddresses = addresses.map((address) =>
      address.toObject ? address.toObject() : address
    );

    return res.render("user/orderAddress", {
      title: "select address",
      adminHeader: true,
      addresses: plainAddresses,
      productId,
      size,
      quantity,
    });
  } catch (error) {
    console.error("Error in loading address for order:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

const submitAddress = async (req, res) => {
  try {
    const addressId = req.body.selectedAddress;
    userId = req.session.user;
    const { productId, size } = req.body;

    //submitting address
    await Address.updateOne(
      { userId },
      { $set: { "address.$[].selected": false } }
    );

    const result = await Address.updateOne(
      { userId, "address._id": addressId },
      { $set: { "address.$.selected": true } }
    );
    const product = await Product.findById(productId);

    let quantity = 1;
    const price = product.salePrice;
    const totalPrice = price * quantity;

    //saving item to cart

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
    //saving cart
    await cart.save();

    //getting cart items
    const updatedCart = await Cart.findOne({ userId })
      .populate({
        path: "items.productId",
        match: { isBlocked: false, isDeleted: false },
      })
      .lean();

    //fetching the current item
    const currentItem = updatedCart.items.find(
      (item) => item.productId && item.productId._id.toString() === productId
    );

    //add to cart then
    return res.render("user/orderSummary", {
      title: "Order Summary",
      adminHeader: true,
      hideFooter: false,
      cartItems: currentItem ? [currentItem] : [],
      totalPrice: currentItem ? currentItem.totalPrice : 0,
    });
  } catch (error) {
    console.error(
      "Error in selecting address and saving to cart for order:",
      error
    );
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

const loadPaymentMethod = async (req, res) => {
  try {
    const userId = req.session.user;
    const { itemId } = req.query;
    const { couponCode, amount } = req.query;

    //for all the cart items
    if (!itemId) {
      const cart = await Cart.findOne({ userId })
        .populate("items.productId", "productName productImages salePrice")
        .lean();

      //cheking ifthe cart is empty
      if (!cart || !cart.items || cart.items.length === 0) {
        return res
          .status(httpStatus.BAD_REQUEST)
          .json({ message: MESSAGES.CART.CART_EMPTY || "Cart is empty" });
      }

      const grandTotal = cart.items.reduce((total, item) => {
        return total + item.totalPrice;
      }, 0);

      return res.render("user/paymentMethod", {
        title: "Payment method",
        adminHeader: true,
        grandTotal: amount,
        itemId,
        couponCode,
      });
    }

    const cart = await Cart.findOne(
      { userId, "items._id": itemId },
      { "items.$": 1 }
    ).populate("items.productId");

    const item = cart.items[0];
    const grandTotal = item.totalPrice;

    return res.render("user/paymentMethod", {
      title: "Payment method",
      adminHeader: true,
      itemId,
      grandTotal: amount,
      couponCode,
    });
  } catch (error) {
    console.error("Error in rendering payment method for order:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

const orderSuccess = async (req, res) => {
  try {
    console.log("orderSuccess reached");
    const userId = req.session.user;
    let { itemId, paymentMethod, couponCode } = req.body;

    //getting address
    const userAddress = await Address.findOne({ userId });
    //cheking address
    if (
      !userAddress ||
      !userAddress.address ||
      userAddress.address.length === 0
    ) {
      console.error("No address found for user:", userId);
      return res.status(httpStatus.BAD_REQUEST).json({
        message: MESSAGES.ADD_ADDRESS.ADDRESS_NOT_FOUND || "Please add address",
      });
    }
    const selectedAddress = userAddress.address.find(
      (a) => a.selected === true
    );

    //getting cart items
    const cart = await Cart.findOne({ userId })
      .populate("items.productId", "productName productImages salePrice")
      .lean();

    if (!cart || cart.items.length === 0) {
      console.error("Cart not found for user:", userId, " itemId:", itemId);
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ message: MESSAGES.CART.CART_NOT_FOUND || "Cart not found" });
    }

    //checking payment methods

    if (
      paymentMethod !== "cod" &&
      paymentMethod !== "razorpay" &&
      paymentMethod !== "wallet"
    ) {
      return res.status(httpStatus.BAD_REQUEST).json({
        message:
          MESSAGES.PAYMENT.PAYMENT_METHOD_INVALID || "Invalid payment method",
      });
    }

    paymentMethod = paymentMethod.toUpperCase();

    let newOrder;
    let isWholeCart;
    let item;
    let savedOrder;

    //for single item
    if (itemId) {
      item = cart.items.find((i) => i._id.toString() === itemId);
      if (!item) {
        console.error("Item not found in cart:", itemId);
        return res.status(httpStatus.BAD_REQUEST).send({
          message: MESSAGES.CART.IREM_NOT_FOUND || "Item not found in cart",
        });
      }
      let discount = 0;

      //cheking the coupon
      if (couponCode) {
        const coupon = await CouponSchema.findOne({
          code: couponCode,
          isActive: true,
        });
        //cheking of coupon exists
        if (!coupon) {
          return res
            .status(400)
            .json({ message: "Invalid or inactive coupon" });
        }
        if (coupon.discountType === "flat") {
          discount = coupon.discountValue;
        } else if (coupon.discountType === "percentage") {
          discount = (coupon.discountValue / 100) * item.totalPrice;
        }

        //changeing usageCount
        let usage = await CouponUsageSchema.findOne({
          couponId: coupon._id,
          userId,
        });
        if (!usage) {
          usage = await CouponUsageSchema.create({
            couponId: coupon._id,
            userId,
            usageCount: 0,
          });
        }
        if (usage.usageCount >= coupon.usageLimit) {
          return res
            .status(400)
            .json({ message: "Coupon usage limit reached" });
        }

        usage.usageCount += 1;
        await usage.save();
      }

      // const finalAmount = item.totalPrice - discount;
      const finalAmount = Math.max(item.totalPrice - discount, 0);

      newOrder = new Order({
        userId: userId,
        orderedItems: [
          {
            productId: item.productId._id,
            quantity: item.quantity,
            price: item.price,
            totalPrice: item.totalPrice,
            statusHistory: [
              {
                status: "Pending",
              },
            ],
          },
        ],
        totalPrice: item.totalPrice,
        discount,
        finalAmount,
        address: selectedAddress._id,
        paymentMethod,
        paymentStatus: "Unpaid",
      });
      savedOrder = await newOrder.save();

      //decreaseing stock
      const productId = item.productId._id;
      const quantity = item.quantity;
      await Product.updateOne(
        { _id: productId },
        { $inc: { quantity: -quantity } }
      );

      isWholeCart = false;
    }
    //order for the whole cart
    else {
      const orderedItems = cart.items.map((item) => ({
        productId: item.productId._id,
        quantity: item.quantity,
        price: item.price,
        totalPrice: item.totalPrice,
        statusHistory: [{ status: "Pending" }],
      }));

      const totalPrice = orderedItems.reduce(
        (sum, item) => sum + item.totalPrice,
        0
      );
      let discount = 0;

      if (couponCode) {
        const coupon = await CouponSchema.findOne({
          code: couponCode,
          isActive: true,
        });
        //cheking of coupon exists
        if (!coupon) {
          return res
            .status(400)
            .json({ message: "Invalid or inactive coupon" });
        }

        if (coupon.discountType === "flat") {
          discount = coupon.discountValue;
        } else if (coupon.discountType === "percentage") {
          discount = (coupon.discountValue / 100) * totalPrice;
        }

        //changeing usageCount
        let usage = await CouponUsageSchema.findOne({
          couponId: coupon._id,
          userId,
        });
        if (!usage) {
          usage = await CouponUsageSchema.create({
            couponId: coupon._id,
            userId,
            usageCount: 0,
          });
        }
        if (usage.usageCount >= coupon.usageLimit) {
          return res
            .status(400)
            .json({ message: "Coupon usage limit reached" });
        }

        usage.usageCount += 1;
        await usage.save();
      }

      // const finalAmount = totalPrice - discount;
      const finalAmount = Math.max(totalPrice - discount, 0);

      newOrder = new Order({
        userId,
        orderedItems,
        totalPrice,
        discount,
        finalAmount,
        address: selectedAddress._id,
        paymentMethod,
        paymentStatus: "Unpaid",
      });

      isWholeCart = true;

      savedOrder = await newOrder.save();

      // decrease stock for each item
      for (const item of orderedItems) {
        await Product.updateOne(
          { _id: item.productId },
          { $inc: { quantity: -item.quantity } }
        );
      }
    }

    const orderId = savedOrder._id;
    const finalAmount = savedOrder.finalAmount;

    return res.status(httpStatus.OK).json({
      orderId,
      finalAmount,
      redirectUrl: isWholeCart
        ? `/order-placed?isWholeCart=${isWholeCart}`
        : `/order-placed?itemId=${itemId}&isWholeCart=${isWholeCart}`,
    });
  } catch (error) {
    console.error("Error in rendering orderSuccess :", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

const orderPlaced = async (req, res) => {
  try {
    const userId = req.session.user;
    const itemId = req.query.itemId;
    const isWholeCart = req.query.isWholeCart === "true";

    if (isWholeCart) {
      //remove item from cart
      await Cart.deleteOne({ userId });
    } else if (itemId) {
      //remove item from cart
      await Cart.updateOne(
        { userId, "items._id": itemId },
        { $pull: { items: { _id: itemId } } }
      );
      // check  cart is empty
      const updatedCart = await Cart.findOne({ userId });
      //if the cart empty delete the whole cart
      if (updatedCart && updatedCart.items.length === 0) {
        await Cart.deleteOne({ userId });
      }
    }

    return res.render("user/orderSuccess", {
      title: "Order placed",
      adminHeader: true,
    });
  } catch (error) {
    console.error("Error in rendering orderPlaced :", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const itemId = req.params.id;
    const userId = req.session.user;
    const { status, reason } = req.body;

    let formattedReason = reason.replace(/_/g, " ");

    formattedReason =
      formattedReason.charAt(0).toUpperCase() + formattedReason.slice(1);

    const updatedOrder = await Order.findOneAndUpdate(
      { userId, "orderedItems._id": itemId },
      {
        $push: {
          "orderedItems.$.statusHistory": {
            status,
            changedAt: new Date(),
            cancellationReason: formattedReason,
            isAdminCancelled: false,
          },
        },
        $set: { currentStatus: status },
      },
      { new: true }
    );

    const productIds = updatedOrder.orderedItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      updatedStatus: item.statusHistory[item.statusHistory.length - 1].status,
    }));

    const { productId, quantity, updatedStatus } = productIds[0];
    //increasing the quantity after cancel order
    await Product.updateOne(
      { _id: productId },
      { $inc: { quantity: quantity } }
    );

    return res.json({
      success: true,
      message: "Order cancelled",
      status: updatedStatus,
    });
  } catch (error) {
    console.error("Error in cancelOrder :", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

// return management
const loadReturnOrder = async (req, res) => {
  try {
    console.log("loadReturnOrder reached");

    const userId = req.session.user;
    const itemId = req.params.id;

    const orders = await Order.findOne(
      { userId, "orderedItems._id": itemId },
      {
        orderedItems: { $elemMatch: { _id: itemId } },
        totalPrice: 1,
        discount: 1,
        finalAmount: 1,
        address: 1,
        createdAt: 1,
        paymentMethod: 1,
        paymentDate: 1,
        paymentStatus: 1,
        orderId: 1,
      }
    )
      .populate("userId", "name")
      .populate(
        "orderedItems.productId",
        "productName productImages description"
      )
      .lean();

    const item = orders.orderedItems[0];

    let latestStatus = item.statusHistory[item.statusHistory.length - 1];
    let updatedDate = latestStatus.changedAt;
    let latestOrderStatus = latestStatus.status;
    const date = new Date(updatedDate).toLocaleString();
    const orderedDate = new Date(orders.createdAt).toLocaleDateString();

    const fullStatusHistory = item.statusHistory.map((history) => ({
      status: history.status,
      changedAt: new Date(history.changedAt).toLocaleString(),
      cancellationReason: history.cancellationReason,
      isAdminCancelled: history.isAdminCancelled,
    }));

    const isCancelled = fullStatusHistory.some((h) => h.status === "Cancelled");

    const address = await Address.findOne(
      { "address._id": orders.address },
      { "address.$": 1 }
    ).lean();

    return res.render("user/returnOrder", {
      title: "Order details",
      adminHeader: true,
      orders,
      date,
      address: address.address[0],
      latestOrderStatus,
      orderedDate,
      fullStatusHistory,
      isCancelled,
      itemId,
    });
  } catch (error) {
    console.error("Error in loadReturnOrder :", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

const returnOrder = async (req, res) => {
  try {
    const userId = req.session.user;

    const itemId = req.params.id;

    const { comment, reason } = req.body;

    const orders = await Order.findOneAndUpdate(
      { userId, "orderedItems._id": itemId },
      {
        $set: {
          "orderedItems.$.returnRequest.isUserRequested": true,
          "orderedItems.$.returnRequest.reason": reason,
          "orderedItems.$.returnRequest.requestDate": new Date(),
          "orderedItems.$.returnRequest.rejectComment": comment,
          "orderedItems.$.returnRequest.isReturnInitiated": true,
        },
      },
      { new: true }
    );

    return res
      .status(httpStatus.OK)
      .json({ message: "Return request initiated" });
  } catch (error) {
    console.error("Error in returnOrder :", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

//razorpayPayments
const createRazorpayOrder = async (req, res) => {
  try {
    console.log("createRazorpayOrder reached");
    const userId = req.session.user;
    const { itemId, orderId, finalAmount } = req.body;

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: "Order not found",
      });
    }
    const amount = order.finalAmount;

    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: crypto.randomUUID(),
    };

    const razorpayOrder = await razorpayInstance.orders.create(options);

    order.razorpayOrderId = razorpayOrder.id;
    order.paymentMethod = "RAZORPAY";
    order.paymentStatus = "Pending";
    order.paymentDate = new Date();
    //saving
    await order.save();

    res.json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      orderId: razorpayOrder.id,
      amount,
      currency: "INR",
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(httpStatus.OK).json({
      success: false,
      message: MESSAGES.INTERNAL_SERVER_ERROR || "Something went wrong ",
    });
  }
};

const verifyPayment = async (req, res) => {
  console.log("verifyPayment reached");
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;
    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      await Order.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        { paymentStatus: "Paid", razorpayPaymentId: razorpay_payment_id }
      );

      return res.json({
        success: true,
        message: "Payment verified successfully",
      });
    } else {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ success: false, message: "Payment verification failed" });
    }
  } catch (error) {
    console.error("Error verifying Razorpay payment:", error);
    res.status(httpStatus.OK).json({
      success: false,
      message: MESSAGES.INTERNAL_SERVER_ERROR || "Something went wrong ",
    });
  }
};

module.exports = {
  loadMyOrder,
  loadAddressForOrder,
  submitAddress,
  loadPaymentMethod,
  orderSuccess,
  orderPlaced,
  cancelOrder,
  orderDetails,
  loadReturnOrder,
  returnOrder,
  createRazorpayOrder,
  verifyPayment,
};
