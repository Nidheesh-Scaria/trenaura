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
const DeliveryCharge = require("../../models/deliveryChargeSchema");

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
const { settings } = require("cluster");

//order management

const getDeliveryCharge = async (totalAmount) => {
  const deliveryCharge = await DeliveryCharge.findOne();

  if (
    deliveryCharge.freeDeliveryAbove &&
    totalAmount > deliveryCharge.freeDeliveryAbove
  ) {
    return 0;
  }

  if (deliveryCharge.type === "fixed") {
    return deliveryCharge.fixedCharge;
  }
  // if (deliveryCharge.type === "location") {
  //   let city = userAddress;

  //   let locationCharge = deliveryCharge.locationCharges.find(
  //     (lc) => lc.location.toLowerCase() === city.toLowerCase()
  //   );
  //   return locationCharge ? locationCharge.charge : 54; //if no city delivery charge 54
  // }
  return 0;
};

const debitWallet = async (userId, orderId, amount) => {
  return Wallet.findOneAndUpdate(
    { userId },
    {
      $inc: { balance: -amount },
      $push: {
        transactions: {
          orderId,
          type: "debit",
          amount,
          description: `Product purchase on ${new Date()} with orderId:${orderId}`,
        },
      },
    }
  );
};

const creditWallet = async (userId, orderId, amount, productId) => {
  const product = await Product.findById(productId).lean();
  productName = product.productName || "Unknown product";

  return Wallet.findOneAndUpdate(
    { userId },
    {
      $inc: { balance: amount },
      $push: {
        transactions: {
          orderId,
          type: "credit",
          amount,
          description: `Refund on ${new Date().toLocaleString()} || Product: ${productName}`,
        },
      },
    },
    { new: true, upsert: true }
  );
};

const decreaseStock = async (productId, quantity) => {
  return Product.updateOne(
    { _id: productId, quantity: { $gte: quantity } },
    { $inc: { quantity: -quantity } }
  );
};

const loadMyOrder = async (req, res) => {
  try {
    const userId = req.session.user;

    let orders = await Order.find({ userId })
      .sort({ createdAt: -1 })
      .populate("userId", "name email")
      .populate("orderedItems.productId", "productName productImages")
      .lean();

    orders = orders.map((order) => {
      order.orderedItems = order.orderedItems.map((item) => {
        const statusHistory = item.statusHistory || [];

        const latestStatusEntry =
          statusHistory.length > 0
            ? statusHistory[statusHistory.length - 1]
            : null;

        let latestStatusDate = new Date(
          latestStatusEntry.changedAt
        ).toLocaleString();

        return {
          ...item,
          latestStatus: latestStatusEntry
            ? latestStatusEntry.status
            : "Pending",
          latestStatusDate,
          returnRequest: item.returnRequest || null,
          isUserRequested: item.returnRequest.isUserRequested || false,
        };
      });

      return order;
    });

    return res.render("user/myOrder", {
      title: "My order",
      adminHeader: true,
      myOrder: orders,
      isMyOrderEmpty: orders.length === 0 ? true : false,
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
    const orderId = req.params.id;

    const orders = await Order.findOne(
      { userId, _id: orderId },
      {
        orderedItems: 1,
        address: 1,
        totalPrice: 1,
        discount: 1,
        finalAmount: 1,
        invoiceDate: 1,
        createdAt: 1,
        paymentMethod: 1,
        couponApplied: 1,
        paymentStatus: 1,
        paymentDate: 1,
        couponDiscount: 1,
        deliveryCharge: 1,
        razorpayPaymentId: 1,
        orderId: 1,
        isOrderPlaced: 1,
      }
    )
      .populate("userId", "name")
      .populate(
        "orderedItems.productId",
        "productName productImages description"
      )
      .lean();

    orders.orderedItems = orders.orderedItems.filter((item) => item.productId);

    orders.formattedDate = new Date(orders.createdAt).toLocaleDateString();

    orders.orderedItems = orders.orderedItems.map((item) => {
      const fullStatusHistory = item.statusHistory || [];

      const formattedStatusHistory = fullStatusHistory.map((statusItem) => ({
        status: statusItem.status,
        date: new Date(statusItem.changedAt).toLocaleString(),
      }));

      const latestStatus =
        fullStatusHistory.length > 0
          ? fullStatusHistory[fullStatusHistory.length - 1]
          : null;
      const latestStatusDate = latestStatus ? latestStatus.changedAt : null;

      //order return status
      const returnRequest = item.returnRequest;
      const isUserRequested = returnRequest.isUserRequested;

      return {
        ...item,
        fullStatusHistory: formattedStatusHistory,
        latestStatus: latestStatus ? latestStatus.status : "Pending",
        latestStatusDate: new Date(latestStatusDate).toLocaleString(),
        returnRequest,
        isUserRequested,
        isAdminCancelled: latestStatus ? latestStatus.isAdminCancelled : false,
        cancellationReason: latestStatus
          ? latestStatus.cancellationReason
          : null,
      };
    });
    const isOrderPlaced = orders.isOrderPlaced;
    console.log(orders)
    console.log('address',orders.address)
    const address = await Address.findOne(
      { "address._id": orders.address },
      { "address.$": 1 }
    ).lean();

    return res.render("user/orderDetails", {
      title: "Order details",
      adminHeader: true,
      orders,
      isOrderPlaced,
      address: address.address[0],
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

    req.session.productDetails = { size, quantity };

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
    const userId = req.session.user;
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

    if (!productId) {
      return res.redirect(`/cartOrderSummary`);
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).send("Product not found");
    }

    let quantity = 1;
    const price = product.salePrice;
    const totalPrice = price * quantity;

    //saving item to cart
    let cart = await Cart.findOne({ userId });

    if (!cart) {
      //creating new cart if no cart
      cart = await Cart.create({
        userId,
        items: [
          {
            productId,
            quantity: 1,
            price,
            totalPrice,
            size,
          },
        ],
      });
    } else {
      const itemIndex = cart.items.findIndex(
        (item) =>
          item.productId.toString() === productId.toString() &&
          item.size === size
      ); //returns -1 if no item found
      if (itemIndex > -1) {
        let currentQuantity = cart.items[itemIndex].quantity;
        const availableStock = product.variants.get(size) || 0;

        //quantity limits to 5
        if (currentQuantity >= 5) {
          cart.items[itemIndex].quantity = 5;
          //checking stock before increasing quantity
        } else if (currentQuantity >= availableStock) {
          cart.items[itemIndex].quantity = availableStock;

          //increasing quantity
        } else {
          cart.items[itemIndex].quantity += 1;
        }

        cart.items[itemIndex].totalPrice =
          cart.items[itemIndex].quantity * price;
      } else {
        cart.items.push({ productId, quantity: 1, price, totalPrice, size });
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
      .sort({ createdOn: -1 })
      .lean();

    const addedItem = updatedCart.items.find(
      (item) =>
        item.productId &&
        item.productId._id.toString() === productId.toString() &&
        item.size === size
    );

    const itemId = addedItem ? addedItem._id : null;
    const productSize = addedItem ? addedItem.size : null;

    return res.redirect(`/orderSummary?cartId=${itemId}&size=${productSize}`);
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

const loadOrderSummary = async (req, res) => {
  try {
    const userId = req.session.user;
    const itemId = req.query.cartId;
    const size = req.query.size;
    let deliveryCharge = 0;

    const cart = await Cart.findOne(
      { userId },
      { items: { $elemMatch: { _id: itemId, size: size } } }
    )
      .populate({
        path: "items.productId",
        select:
          "regularPrice salePrice productImages color productName appliedOffer",
        match: { isBlocked: false, isDeleted: false, isActive: true },
      })
      .lean();

    if (!cart || !cart.items || cart.items.length === 0) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .send(MESSAGES.CART.ITEM_NOT_FOUND || "Item not found in cart");
    }

    const item = cart.items[0];

    let totalPrice = item.totalPrice;
    let discount = item.productId.regularPrice * item.quantity - totalPrice;

    deliveryCharge = await getDeliveryCharge(totalPrice);
    let finalAmount = deliveryCharge + totalPrice;

    if (!item.productId) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .send(
          MESSAGES.PRODUCT_NOT_FOUND || "Product not available for ordering"
        );
    }

    return res.render("user/orderSummary", {
      title: "Order Summary",
      adminHeader: true,
      hideFooter: false,
      item,
      deliveryCharge,
      totalPrice,
      finalAmount,
      discount,
    });
  } catch (error) {
    console.error("Error in rendering loadOrderSummary:", error);
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

    let { itemId, couponCode, amount, orderId } = req.query;

    //for retry payments
    if (orderId) {
      const order = await Order.findById(orderId)
        .populate("orderedItems.productId")
        .populate("address")
        .lean();

      if (!order) {
        return res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          message: "Order not found or already removed",
        });
      }

      const activeItems = order.orderedItems.filter((item) => {
        const lastStatus =
          item.statusHistory[item.statusHistory.length - 1]?.status;
        return lastStatus !== "Cancelled";
      });

      if (activeItems.length === 0) {
        return res.render("user/message", {
          title: "Retry Payment",
          adminHeader: true,
          message:
            "Oops! All items in this order are cancelled. Retry payment is not allowed.",
          redirectUrl: "/loadMyOrder",
          buttonText: "Go to My Orders",
        });
      }

      let grandTotal = activeItems.reduce(
        (sum, item) => sum + item.totalPrice,
        0
      );

      grandTotal = grandTotal + order.deliveryCharge;

      grandTotal = Number(grandTotal);

      return res.render("user/paymentMethod", {
        title: "Payment method",
        adminHeader: true,
        grandTotal,
        itemId: null,
        couponCode,
        orderId,
      });
    }

    //for all the cart items
    if (!itemId) {
      const cart = await Cart.findOne({ userId })
        .populate("items.productId", "productName productImages salePrice")
        .lean();

      //cheking if the cart is empty
      if (!cart || !cart.items || cart.items.length === 0) {
        return res
          .status(httpStatus.BAD_REQUEST)
          .json({ message: MESSAGES.CART.CART_EMPTY || "Cart is empty" });
      }

      let grandTotal = cart.items.reduce((total, item) => {
        return total + item.totalPrice;
      }, 0);

      let deliveryCharge = await getDeliveryCharge(grandTotal);

      grandTotal = Number(grandTotal);

      grandTotal += deliveryCharge;

      return res.render("user/paymentMethod", {
        title: "Payment method",
        adminHeader: true,
        grandTotal,
        itemId,
        couponCode,
        orderId: null,
      });
    }

    const cart = await Cart.findOne(
      { userId, "items._id": itemId },
      { "items.$": 1 }
    ).populate("items.productId");

    const item = cart.items[0];
    let grandTotal = item.totalPrice;

    grandTotal = Number(grandTotal);
    let deliveryCharge = await getDeliveryCharge(grandTotal);
    grandTotal += deliveryCharge;

    return res.render("user/paymentMethod", {
      title: "Payment method",
      adminHeader: true,
      itemId,
      grandTotal,
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
    const userId = req.session.user;
    let { itemId, paymentMethod, couponCode, retryOrderId } = req.body;
    let newOrder;
    let isWholeCart;
    let item;
    let savedOrder;
    let finalAmount;
    let deliveryCharge = 0;
    let isRetryPayment = false;

    let orderId = retryOrderId;

    // if (orderId) {
    //   const order = await Order.findById(orderId);

    //   finalAmount = order.finalAmount;

    //   await Order.findByIdAndUpdate(orderId, {
    //     $set: { paymentMethod: paymentMethod.toUpperCase() },
    //   });

    //   return res.status(httpStatus.OK).json({
    //     orderId,
    //     finalAmount,
    //     isRetryPayment: true,
    //     redirectUrl: isWholeCart
    //       ? `/order-placed?isWholeCart=${isWholeCart}`
    //       : `/order-placed?itemId=${itemId}&isWholeCart=${isWholeCart}`,
    //   });
    // }
    //Retry Payment
    if (orderId) {
      const order = await Order.findById(orderId);

      if (!order) {
        return res.status(httpStatus.NOT_FOUND).json({
          success: false,
          message: "Order not found",
        });
      }

      // Filter out cancelled items
      const activeItems = order.orderedItems.filter((item) => {
        const lastStatus =
          item.statusHistory[item.statusHistory.length - 1]?.status;
        return lastStatus !== "Cancelled";
      });

      if (activeItems.length === 0) {
        return res.render("user/message", {
          title: "Retry Payment",
          message:
            "Oops! All items in this order are cancelled. Retry payment is not allowed.",
          redirectUrl: "/orders",
          buttonText: "Go to My Orders",
        });
      }

      // Recalculate total and final amount
      const newTotal = activeItems.reduce(
        (acc, item) => acc + item.totalPrice,
        0
      );
      const newFinalAmount =
        newTotal + (order.deliveryCharge || 0) - (order.discount || 0);

      order.totalPrice = newTotal;
      order.finalAmount = newFinalAmount;
      order.paymentMethod = paymentMethod.toUpperCase();
      await order.save();

      return res.status(httpStatus.OK).json({
        orderId,
        finalAmount: order.finalAmount,
        isRetryPayment: true,
        redirectUrl: `/order-placed?itemId=${itemId || null}`,
      });
    }

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
      .populate({
        path: "items.productId",
        select:
          "productName productImages salePrice category variants quantity",
        populate: {
          path: "category",
          select: "name",
        },
      })
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

    //for single item
    if (itemId) {
      item = cart.items.find((i) => i._id.toString() === itemId);
      if (!item) {
        console.error("Item not found in cart:", itemId);
        return res.status(httpStatus.BAD_REQUEST).send({
          message: MESSAGES.CART.ITEM_NOT_FOUND || "Item not found in cart",
        });
      }
      let discount = 0;
      let couponApplied = false;

      let discountAmount, lastAmount, couponCode, couponId;

      if (req.session.appliedCoupon) {
        ({ discountAmount, lastAmount, couponCode, couponId } =
          req.session.appliedCoupon);
      }
      //cheking the coupon
      if (couponCode) {
        const coupon = await CouponSchema.findOne({
          _id: couponId,
          code: couponCode,
          isActive: true,
        });

        if (coupon.discountType === "flat") {
          discount = coupon.discountValue;
        } else if (coupon.discountType === "percentage") {
          discount = (coupon.discountValue / 100) * item.totalPrice;
        }
        discount = Math.round(discount);
        couponApplied = true;
      }
      deliveryCharge = await getDeliveryCharge(item.totalPrice);
      let totalDiscount = Math.round(discount) || 0;

      totalDiscount = Math.min(totalDiscount, item.totalPrice);
      let finalAmount = Math.max(item.totalPrice - totalDiscount, 0);
      finalAmount += deliveryCharge;
      finalAmount = Math.round(finalAmount);

      newOrder = new Order({
        userId: userId,
        orderedItems: [
          {
            productId: item.productId._id,
            quantity: item.quantity,
            price: item.price,
            variant: item.size,
            totalPrice: item.totalPrice,
            discount,
            finalAmount,
            statusHistory: [
              {
                status: "Pending",
              },
            ],
          },
        ],
        totalPrice: item.totalPrice,
        discount,
        couponDiscount: discount,
        couponApplied,
        finalAmount,
        deliveryCharge,
        address: selectedAddress._id,
        paymentMethod,
        paymentStatus: "Unpaid",
        isOrderPlaced: false,
      });
      savedOrder = await newOrder.save();
      isWholeCart = false;
    }
    //order for the whole cart
    else {
      const orderedItems = cart.items.map((item) => ({
        productId: item.productId._id,
        category: item.productId.category?.name || null,
        quantity: item.quantity,
        price: item.price,
        variant: item.size,
        totalPrice: item.totalPrice,
        statusHistory: [{ status: "Pending" }],
      }));
      const numberOfItems = cart.items.length;

      const totalPrice = orderedItems.reduce(
        (sum, item) => sum + item.totalPrice,
        0
      );

      let discount = 0;
      let couponApplied = false;
      //checking the coupons
      if (couponCode) {
        const coupon = await CouponSchema.findOne({
          code: couponCode,
          isActive: true,
        });
        //cheking of coupon exists
        if (!coupon) {
          return res.status(httpStatus.BAD_REQUEST).json({
            message:
              MESSAGES.COUPON.INVALID_COUPON || "Invalid or inactive coupon",
          });
        }

        if (coupon.discountType === "flat") {
          discount = coupon.discountValue;
        } else if (coupon.discountType === "percentage") {
          discount = (coupon.discountValue / 100) * totalPrice;
        }
        discount = Math.round(discount);
        couponApplied = true;
      }

      discount = Math.min(discount, totalPrice);

      finalAmount = Math.max(totalPrice - discount, 0);
      finalAmount = Math.round(finalAmount);

      deliveryCharge = await getDeliveryCharge(totalPrice);

      finalAmount += deliveryCharge;

      if (discount > 0 && couponApplied) {
        orderedItems.forEach((item) => {
          const itemShare = item.totalPrice / totalPrice;
          const perItemDiscount = Math.round(discount * itemShare);
          item.discount = perItemDiscount;

          item.finalAmount = Math.max(item.totalPrice - perItemDiscount, 0);
        });
      } else {
        orderedItems.forEach((item) => {
          item.discount = 0;
          item.finalAmount = item.totalPrice;
        });
      }

      newOrder = new Order({
        userId,
        orderedItems,
        totalPrice,
        discount,
        couponDiscount: discount,
        couponApplied,
        finalAmount,
        address: selectedAddress._id,
        paymentMethod,
        deliveryCharge,
        paymentStatus: "Unpaid",
        isOrderPlaced: false,
      });

      isWholeCart = true;

      savedOrder = await newOrder.save();
    }

    orderId = savedOrder._id;
    finalAmount = savedOrder.finalAmount;

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
    const orderId = req.query.orderId;
    const isRetryPayment = req.query.isRetryPayment;
    const isWholeCart = req.query.isWholeCart === "true";

    const order = await Order.findById(orderId).populate({
      path: "orderedItems.productId",
      populate: {
        path: "category",
        select: "name",
      },
    });
    if (!order) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ message: MESSAGES.ORDER.NOT_FOUND || "Order not found" });
    }

    if (isRetryPayment) {
      order.isOrderPlaced = true;
      await order.save();
      return res.render("user/orderSuccess", {
        title: "Order placed",
        adminHeader: true,
      });
    }

    order.isOrderPlaced = true;
    await order.save();

    for (const item of order.orderedItems) {
      const productId = item.productId._id;
      const quantity = item.quantity;

      const product = await Product.findOneAndUpdate(
        {
          _id: productId,
          [`variants.${item.variant}`]: { $gte: quantity },
        },
        { $inc: { [`variants.${item.variant}`]: -quantity } },
        { new: true }
      );

      if (product) {
        product.size = Object.entries(product.variants)
          .filter(([_, qty]) => qty > 0)
          .map(([size]) => size);
        await product.save();
      }
    }

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

    return res.redirect("/orderPlaced");
  } catch (error) {
    console.error("Error in orderPlaced :", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

const getOrderPlaced = async (req, res) => {
  try {
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
      },
      { new: true }
    );

    const orderId = updatedOrder._id;

    const cancelledItem = updatedOrder.orderedItems.find(
      (item) => item._id == itemId
    );

    if (!cancelledItem) {
      return res.status(404).json({
        success: false,
        message: "Cancelled item not found in order.",
      });
    }

    const { productId, quantity, updatedStatus, variant, finalAmount } =
      cancelledItem;

    //increasing the quantity after cancel order
    const product = await Product.findOneAndUpdate(
      {
        _id: productId,
        [`variants.${variant}`]: { $gte: 0 },
      },
      { $inc: { [`variants.${variant}`]: quantity } },
      { new: true }
    );

    if (product) {
      product.size = Object.entries(product.variants)
        .filter(([_, qty]) => qty > 0)
        .map(([size]) => size);
      await product.save();
    }
    if (updatedOrder.paymentStatus === "Paid") {
      await creditWallet(userId, orderId, finalAmount, productId);
    }

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

    return res.status(httpStatus.OK).json({
      message: MESSAGES.ORDER.RETURN_INITIATED || "Return request initiated",
    });
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

//wallet payment
const walletPayment = async (req, res) => {
  try {
    const userId = req.session.user;
    const { itemId, paymentMethod, couponCode, grandTotal, orderId } =
      req.query;

    req.session.walletData = { itemId, paymentMethod, couponCode, orderId };
    let insufficientBalance = false;
    let noWallet = false;

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.render("user/confirmWalletPayment", {
        title: "Order details",
        adminHeader: true,
        noWallet: true,
      });
    }

    let item;
    if (itemId) {
      item = await Cart.findOne();
    }
    let amount = Number(grandTotal);

    let walletBalance = wallet.balance;
    if (walletBalance < amount) {
      insufficientBalance = true;
    }

    return res.render("user/confirmWalletPayment", {
      title: "Order details",
      adminHeader: true,
      walletBalance,
      amount,
      itemId,
      insufficientBalance,
      noWallet,
    });
  } catch (error) {
    console.error("Error in walletPayment :", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

const confirmWalletPayment = async (req, res) => {
  try {
    const userId = req.session.user;
    const { itemId, paymentMethod, couponCode, orderId } =
      req.session.walletData;
    let item;
    let newOrder, savedOrder;

    const cart = await Cart.findOne({ userId });
    const wallet = await Wallet.findOne({ userId });
    const userAddress = await Address.findOne({ userId });
    //cheking address
    if (
      !userAddress ||
      !userAddress.address ||
      userAddress.address.length === 0
    ) {
      return res.status(httpStatus.BAD_REQUEST).json({
        message: MESSAGES.ADD_ADDRESS.ADDRESS_NOT_FOUND || "Please add address",
      });
    }
    const selectedAddress = userAddress.address.find(
      (a) => a.selected === true
    );

    if (orderId) {
      const order = await Order.findById(orderId);
      if (!order) {
        return res
          .status(httpStatus.BAD_REQUEST)
          .json({ message: "Order not found" });
      }

      const finalAmount = order.finalAmount;
      if (!wallet || wallet.balance < finalAmount) {
        return res.status(httpStatus.BAD_REQUEST).json({
          message:
            MESSAGES.WALLET.INSUFFICIENT_BALANCE ||
            "Insufficient wallet balance",
        });
      }

      await debitWallet(userId, order.orderId, order.finalAmount);
      await Order.findByIdAndUpdate(
        orderId,
        {
          $set: {
            paymentMethod: "WALLET",
            paymentStatus: "Paid",
            isOrderPlaced: true,
          },
        },
        { new: true }
      );

      return res.status(httpStatus.OK).json({
        message: MESSAGES.ORDER.ORDER_PLACED || "Order placed successfully",
      });
    }

    //for one order
    if (itemId) {
      item = cart.items.find((i) => i._id.toString() === itemId);

      let discount = 0;
      let couponApplied = false;

      //cheking the coupon
      if (couponCode) {
        const coupon = await CouponSchema.findOne({
          code: couponCode,
          isActive: true,
        });
        //cheking of coupon exists
        if (coupon.discountType === "flat") {
          discount = coupon.discountValue;
        } else if (coupon.discountType === "percentage") {
          discount = (coupon.discountValue / 100) * item.totalPrice;
        }
        couponApplied = true;

        //changing usageCount
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
            .status(httpStatus.BAD_REQUEST)
            .json({
              message:
                MESSAGES.COUPON.USAGE_LIMIT || "Coupon usage limit reached",
            });
        }

        usage.usageCount += 1;
        await usage.save();
      }

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
        couponDiscount: discount,
        couponApplied,
        finalAmount,
        address: selectedAddress._id,
        paymentMethod: "WALLET",
        paymentStatus: "Unpaid",
      });
      savedOrder = await newOrder.save();

      if (!wallet || wallet.balance < finalAmount) {
        return res
          .status(httpStatus.BAD_REQUEST)
          .json({
            message:
              MESSAGES.WALLET.INSUFFICIENT_BALANCE ||
              "Insufficient wallet balance",
          });
      }

      await debitWallet(userId, savedOrder.orderId, finalAmount);
      savedOrder.paymentStatus = "Paid";
      savedOrder.isOrderPlaced = true;
      await savedOrder.save();

      //decreaseing stock--------------------------
      const productId = item.productId._id;
      const quantity = item.quantity;

      const product = await Product.findOneAndUpdate(
        {
          _id: productId,
          [`variants.${item.size}`]: { $gte: quantity },
        },
        {
          $inc: { [`variants.${item.size}`]: -quantity },
        },
        { new: true }
      );

      if (product) {
        product.size = Object.entries(product.variants)
          .filter(([_, qty]) => qty > 0)
          .map(([size]) => size);
        await product.save();
      }

      isWholeCart = false;
      await Cart.updateOne(
        { userId, "items._id": itemId },
        { $pull: { items: { _id: itemId } } }
      );
    } else {
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
      //checking the coupons
      if (couponCode) {
        const coupon = await CouponSchema.findOne({
          code: couponCode,
          isActive: true,
        });
        //cheking of coupon exists
        if (!coupon) {
          return res
            .status(httpStatus.BAD_REQUEST)
            .json({
              message:
                MESSAGES.COUPON.INVALID_COUPON || "Invalid or inactive coupon",
            });
        }

        if (coupon.discountType === "flat") {
          discount = coupon.discountValue;
        } else if (coupon.discountType === "percentage") {
          discount = (coupon.discountValue / 100) * totalPrice;
        }

        //changing usageCount
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
            .status(httpStatus.BAD_REQUEST)
            .json({
              message:
                MESSAGES.COUPON.USAGE_LIMIT || "Coupon usage limit reached",
            });
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
        paymentMethod: "WALLET",
        paymentStatus: "unpaid",
      });

      isWholeCart = true;

      savedOrder = await newOrder.save();

      if (!wallet || wallet.balance < finalAmount) {
        return res
          .status(httpStatus.BAD_REQUEST)
          .json({
            message:
              MESSAGES.WALLET.INSUFFICIENT_BALANCE ||
              "Insufficient wallet balance",
          });
      }

      await debitWallet(userId, savedOrder.orderId, finalAmount);
      savedOrder.paymentStatus = "Paid";
      savedOrder.isOrderPlaced = true;
      await savedOrder.save();

      // decrease stock for each item-------------------------

      for (const item of orderedItems) {
        const product = await Product.findOneAndUpdate(
          {
            _id: item.productId,
            [`variants.${item.size}`]: { $gte: item.quantity },
          },
          { $inc: { [`variants.${item.size}`]: -item.quantity } },
          { new: true }
        );
        if (product) {
          product.size = Object.entries(product.variants)
            .filter(([_, qty]) => qty > 0)
            .map(([size]) => size);
          await product.save();
        }
      }

      await Cart.deleteOne({ userId });
    }
    const updatedCart = await Cart.findOne({ userId });
    //if the cart empty delete the whole cart
    if (updatedCart && updatedCart.items.length === 0) {
      await Cart.deleteOne({ userId });
    }

    return res
      .status(httpStatus.OK)
      .json({
        message: MESSAGES.ORDER.ORDER_PLACED || "Order placed successfully",
      });
  } catch (error) {
    console.error("Error in confirmWalletPayment :", error);
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
    const userId = req.session.user;
    const { itemId, orderId, finalAmount } = req.body;

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.ORDER.NOT_FOUND || "Order not found",
      });
    }
    let amount = order.finalAmount;
    amount = amount;

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
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      itemId,
      isWholeCart,
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      const order = await Order.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        {
          paymentStatus: "Paid",
          razorpayPaymentId: razorpay_payment_id,
          isOrderPlaced: true,
        },
        { new: true }
      ).populate({
        path: "orderedItems.productId",
        populate: { path: "category", select: "name" },
      });

      if (!order) {
        return res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          message:
            MESSAGES.RAZORPAY.NOT_FOUND_AT_VERIFICATION ||
            "Order not found while verifying payment",
        });
      }

      for (const item of order.orderedItems) {
        const productId = item.productId._id;
        const quantity = item.quantity;

        const product = await Product.findOneAndUpdate(
          {
            _id: productId,
            [`variants.${item.variant}`]: { $gte: quantity },
          },
          { $inc: { [`variants.${item.variant}`]: -quantity } },
          { new: true }
        );

        if (product) {
          product.size = Object.entries(product.variants)
            .filter(([_, qty]) => qty > 0)
            .map(([size]) => size);
          await product.save();
        }
      }

      const userId = order.userId;
      if (isWholeCart) {
        await Cart.deleteOne({ userId });
      } else if (itemId) {
        await Cart.updateOne(
          { userId, "items._id": itemId },
          { $pull: { items: { _id: itemId } } }
        );

        const updatedCart = await Cart.findOne({ userId });
        if (updatedCart && updatedCart.items.length === 0) {
          await Cart.deleteOne({ userId });
        }
      }

      return res.json({
        success: true,
        message: MESSAGES.RAZORPAY.VERIFIED || "Payment verified successfully",
      });
    } else {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({
          success: false,
          message:
            MESSAGES.RAZORPAY.VERIFICATION_FAILED ||
            "Payment verification failed",
        });
    }
  } catch (error) {
    console.error("Error verifying Razorpay payment:", error);
    res.status(httpStatus.OK).json({
      success: false,
      message: MESSAGES.INTERNAL_SERVER_ERROR || "Something went wrong ",
    });
  }
};

const failedPayment = async (req, res) => {
  try {
    const orderId = req.query.id;
    let message = req.query.message;
    message = JSON.stringify(message, null, 2);

    return res.render("user/paymentFailure", {
      adminHeader: true,
      orderId,
      message,
    });
  } catch (error) {
    console.error("Error failedPayement:", error);
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
  getOrderPlaced,
  cancelOrder,
  orderDetails,
  loadReturnOrder,
  returnOrder,
  createRazorpayOrder,
  verifyPayment,
  loadOrderSummary,
  walletPayment,
  confirmWalletPayment,
  failedPayment,
};
