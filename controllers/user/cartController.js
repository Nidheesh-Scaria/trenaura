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
const DeliveryChargeSchema = require("../../models/deliveryChargeSchema");

const env = require("dotenv").config();
const httpStatus = require("../../util/statusCodes");
const { MESSAGES } = require("../../util/constants");
const { default: mongoose } = require("mongoose");

// cart management
const getDeliveryCharge = async (totalAmount) => {
  const deliveryCharge = await DeliveryChargeSchema.findOne();

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
            size: size ? size : null,
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

    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      match: { isBlocked: false, isDeleted: false },
    });

    let totalPrice = 0;
    let deliveryCharge = 0;
    if (cart?.items?.length) {
      // filter invalid products
      cart.items = cart.items.filter((item) => item.productId !== null);

      if (cart.items.length > 0) {
        isCartEmpty = false;

        // update prices in DB
        cart.items.forEach((item) => {
          const currentSalePrice = item.productId.salePrice;
          item.price = currentSalePrice;
          item.totalPrice = currentSalePrice * item.quantity;
        });

        // cart total
        totalPrice = cart.items.reduce(
          (total, item) => total + item.totalPrice,
          0
        );

        deliveryCharge = await getDeliveryCharge(totalPrice);
        totalPrice += deliveryCharge;

        // save updated cart to DB
        await cart.save();
      }
    }

    return res.redirect("/renderMyCart");
  } catch (error) {
    console.error("Error in loadmyCart:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred. Please try again later.",
    });
  }
};

const renderMyCart = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    const products = await Product.find().limit(8).lean();
    let deliveryCharge=0

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

      cart.items = cart.items.map((item) => {
        const currentSalePrice = item.productId.salePrice;
        const updatedTotal = currentSalePrice * item.quantity;

        // update the item
        return {
          ...item,
          price: currentSalePrice,
          totalPrice: updatedTotal,
        };
      });

      //total price of the cart items
      totalPrice = cart.items.reduce((total, item) => {
        return total + item.totalPrice;
      }, 0);
    }

    deliveryCharge = await getDeliveryCharge(totalPrice);
    let finalAmount = deliveryCharge + totalPrice;

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
      deliveryCharge,
      finalAmount,
    });
  } catch (error) {
    console.error("Error in loadmyCart:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred. Please try again later.",
    });
  }
};

const cartOrderSummary = async (req, res) => {
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

    let deliveryCharge=await getDeliveryCharge(totalPrice)
    let finalAmount=deliveryCharge+totalPrice

    //if cart is empty
    if (!cart || cart.items.length === 0) {
      return res.render("user/cartOrderSummary", {
        title: "Order Summary",
        adminHeader: true,
        hideFooter: false,
        isCartEmpty: true,
        cartItems: [],
        products,
      });
    }

    return res.render("user/cartOrderSummary", {
      title: "Order Summary",
      adminHeader: true,
      hideFooter: false,
      cartItems: cart.items,
      isCartEmpty: cart.items.length === 0,
      products,
      totalPrice,
      finalAmount,
      deliveryCharge,
    });
  } catch (error) {
    console.error("Error in loadmyCart:", error);
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
    const { couponCode, cartTotal } = req.body;

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

    let finalAmount = 0;
    let discountAmount = 0;
    let deliveryCharge=await getDeliveryCharge(cartTotal)
    

    const cart = await Cart.findOne({ userId });

    if (coupon.discountType === "flat") {
      discountAmount = coupon.discountValue;
    
    } else if (coupon.discountType === "percentage") {
      discountAmount = (coupon.discountValue / 100) * cartTotal;
      
    }

    discountAmount = Math.min(discountAmount, cartTotal);

    finalAmount = cartTotal - discountAmount;
    finalAmount += deliveryCharge;
    discountAmount = Math.round(discountAmount);
    
    finalAmount = Math.round(finalAmount);
    

    req.session.appliedCoupon = {
      discountAmount,
      finalAmount,
      couponCode,
      couponId: coupon._id,
      cartTotal,
    };

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
      return res.status(400).json({ message: "Coupon usage limit reached" });
    }

    usage.usageCount += 1;
    await usage.save();

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
      
    });
  }
};

const removeCoupon = async (req, res) => {
  try {
    const userId = req.session.user;
    const { coupon } = req.body;

    if (!req.session.appliedCoupon) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ message: "No coupon Applied" });
    }

    let { discountAmount, finalAmount, couponCode, couponId ,cartTotal} =
      req.session.appliedCoupon;

    delete req.session.appliedCoupon;

    if (couponId) {
      await CouponUsageSchema.findOneAndUpdate(
        { couponId, userId },
        { $inc: { usageCount: -1 } }
      );
    }

    let deliveryCharge=await getDeliveryCharge(cartTotal)
    cartTotal+=deliveryCharge

    return res.json({
      message: "Coupon removed Successfully",
      discountAmount,
      finalAmount:cartTotal,
    });
  } catch (error) {
    console.error("Error in removeCoupon:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred. Please try again later.",
    });
  }
};

// const increaseQuantity = async (req, res) => {
//   try {
//     const { id: itemId } = req.params;
//     const userId = req.session.user;
//     const { quantity, size } = req.body;

//     console.log("increaseQuantity", size);

//     if (quantity >= 5) {
//       return res.status(400).json({
//         message: "!Sorry,quantity is limited to 5",
//       });
//     }

//     const cart = await Cart.findOne({
//       userId,
//       "items._id": itemId,
//       "items.size": size,
//     }).populate("items.productId", "variants salePrice");

//     if (!cart || !cart.items.length) {
//       return res.status(400).json({ message: "Item not found" });
//     }

//     const item = cart.items.find((i) => i._id.toString() === itemId && i.size === size);
//     const stock = item.productId.variants[cart.items[0].size];

//     if (item.quantity >= stock) {
//       return res.status(httpStatus.BAD_REQUEST).json({
//         message: "Quantity should be less than the total stock of the product",
//       });
//     }

//     // Increase quantity
//     await Cart.updateOne(
//       { userId, "items._id": itemId },
//       { $inc: { "items.$.quantity": 1 } }
//     );

//     const updatedCart = await Cart.findOne({ userId })
//       .populate("items.productId")
//       .lean();

//     const updatedItem = updatedCart.items.find(
//       (i) => i._id.toString() === itemId && i.size === size
//     );
//     const totalPrice = updatedItem.quantity * updatedItem.price;
//     let grandTotal = updatedCart.items.reduce((total, item) => {
//       return total + item.price * item.quantity;
//     }, 0);

//     let deliveryCharge = 0;

//     if (grandTotal < 2001) {
//       deliveryCharge = 54;
//       grandTotal += deliveryCharge;
//     }
//     //updating with new values
//     await Cart.updateOne(
//       { userId, "items._id": itemId },
//       { $set: { "items.$.totalPrice": totalPrice } }
//     );

//     return res.status(httpStatus.OK).json({
//       message: MESSAGES.CART.QUANTITY_INCREASE || "Increased by One",
//       quantity: updatedItem.quantity,
//       totalPrice,
//       grandTotal,
//       deliveryCharge,
//     });
//   } catch (error) {
//     console.error("Error in increasing the quantity:", error);
//     res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
//       success: false,
//       message: "An error occurred. Please try again later.",
//     });
//   }
// };

// const decreaseQuantity = async (req, res) => {
//   try {
//     const { id: itemId } = req.params;
//     const userId = req.session.user;
//     const { size } = req.body;
//     console.log("decreaseQuantity+++++++++++++", size);

//     // Fetch current item first
//     const cart = await Cart.findOne({
//       userId,
//       "items._id": itemId,
//       "items.size": size,
//     }).lean();

//     if (!cart || !cart.items.length) {
//       return res
//         .status(httpStatus.BAD_REQUEST)
//         .json({ message: "Item not found" });
//     }

//     const item = cart.items;

//     if (item.quantity <= 1) {
//       return res
//         .status(httpStatus.BAD_REQUEST)
//         .json({ message: "Minimum quantity is 1" });
//     }
//     // Decrease quantity
//     await Cart.updateOne(
//       { userId, "items._id": itemId },
//       { $inc: { "items.$.quantity": -1 } }
//     );

//     const updatedCart = await Cart.findOne({ userId })
//       .populate("items.productId")
//       .lean();

//     const updatedItem = updatedCart.items.find(
//       (i) => i._id.toString() === itemId && i.size === size
//     );

//     const totalPrice = updatedItem.quantity * updatedItem.price;
//     const grandTotal = updatedCart.items.reduce((total, item) => {
//       return total + item.quantity * item.price;
//     }, 0);

//     let deliveryCharge = 0;

//     if (grandTotal < 2001) {
//       deliveryCharge = 54;
//       grandTotal = grandTotal + deliveryCharge;
//       console.log(deliveryCharge);
//     }

//     //updating with new values
//     await Cart.updateOne(
//       { userId, "items._id": itemId },
//       { $set: { "items.$.totalPrice": totalPrice } }
//     );

//     return res.status(httpStatus.OK).json({
//       message: MESSAGES.CART.QUANTITY_DECREASE || "Quantity decreased",
//       quantity: updatedItem.quantity,
//       totalPrice,
//       grandTotal,
//       deliveryCharge,
//     });
//   } catch (error) {
//     console.error("Error in decreasing the quantity:", error);
//     res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
//       success: false,
//       message: "An error occurred. Please try again later.",
//     });
//   }
// };

const increaseQuantity = async (req, res) => {
  try {
    const { id: itemId } = req.params;
    const userId = req.session.user;
    const { quantity, size } = req.body;

    if (quantity >= 5) {
      return res
        .status(400)
        .json({ message: "!Sorry, quantity is limited to 5" });
    }

    const cart = await Cart.findOne({
      userId,
      "items._id": itemId,
      "items.size": size,
    }).populate("items.productId");

    if (!cart) {
      return res.status(400).json({ message: "Item not found" });
    }

    const item = cart.items.find(
      (i) => i._id.toString() === itemId && i.size === size
    );
    if (!item) {
      return res.status(400).json({ message: "Item not found" });
    }

    const stock = item.productId.variants[item.size];
    if (item.quantity >= stock) {
      return res.status(400).json({
        message: "Quantity should be less than the total stock of the product",
      });
    }

    // Increase quantity
    item.quantity += 1;

    // Recalculate price with latest salePrice
    item.price = item.productId.salePrice;
    item.totalPrice = item.price * item.quantity;

    // Save
    await cart.save();

    // Recalculate grand total
    // let grandTotal = cart.items.reduce((total, i) => total + i.totalPrice, 0);
    let grandTotal = item.totalPrice;

    console.log("increase grandtotal:::", grandTotal);
    let deliveryCharge = await getDeliveryCharge(grandTotal);
    console.log("increase deliveryCharge:::", deliveryCharge);
    grandTotal += deliveryCharge;

    return res.status(200).json({
      message: "Qunatity increased by One",
      quantity: item.quantity,
      totalPrice: item.totalPrice,
      grandTotal,
      deliveryCharge,
    });
  } catch (error) {
    console.error("Error in increasing the quantity:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred. Please try again later.",
    });
  }
};

const decreaseQuantity = async (req, res) => {
  try {
    const { id: itemId } = req.params;
    const userId = req.session.user;
    const { size } = req.body;

    const cart = await Cart.findOne({
      userId,
      "items._id": itemId,
      "items.size": size,
    }).populate("items.productId");

    if (!cart) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ message: "Item not found" });
    }

    const item = cart.items.find(
      (i) => i._id.toString() === itemId && i.size === size
    );
    if (!item) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ message: "Item not found" });
    }

    if (item.quantity <= 1) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ message: "Minimum quantity is 1" });
    }

    // Decrease quantity
    item.quantity -= 1;

    // Recalculate price with latest salePrice
    item.price = item.productId.salePrice;
    item.totalPrice = item.price * item.quantity;

    // Save
    await cart.save();

    // Recalculate grand total
    let grandTotal = item.totalPrice;
    let deliveryCharge = await getDeliveryCharge(grandTotal);
    grandTotal += deliveryCharge;

    return res.status(200).json({
      message: "Quantity decreased",
      quantity: item.quantity,
      totalPrice: item.totalPrice,
      grandTotal,
      deliveryCharge,
    });
  } catch (error) {
    console.error("Error in decreasing the quantity:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred. Please try again later.",
    });
  }
};

module.exports = {
  addToCart,
  loadmyCart,
  cartOrderSummary,
  increaseQuantity,
  decreaseQuantity,
  removefromCart,
  applyCoupon,
  removeCoupon,
  renderMyCart,
};
