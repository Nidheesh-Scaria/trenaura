const OrderSchema = require("../models/orderSchema");
const AddressSchema = require("../models/addressSchema");
const UserSchema = require("../models/userSchema");
const ProductSchema = require("../models/productSchema");
const WalletSchema = require("../models/walletSchema");

const httpStatus = require("../util/statusCodes");
const { MESSAGES } = require("../util/constants");

//order management

const loadOrder = async (req, res) => {
  try {
    const raw = parseInt(req.query.page, 10);
    const page = Math.max(1, Number.isFinite(raw) ? raw : 1);
    const limit = 6;
    const search = req.query.search || "";

    let searchFilter = {};

    if (search) {
      searchFilter = {
        $or: [
          { paymentMethod: { $regex: search, $options: "i" } },
          { paymentStatus: { $regex: search, $options: "i" } },
          { currentStatus: { $regex: search, $options: "i" } },
        ],
      };
    }

    const orders = await OrderSchema.find(searchFilter)
      .populate("userId", "name email")
      .populate("orderedItems.productId", "productName productImages")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const filteredOrders = orders
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
            isUserRequested: item.returnRequest.isUserRequested,
            isReturnInitiated: item.returnRequest.isReturnInitiated,
            refundStatus:item.returnRequest.refundStatus
          }));
        order.formattedDate = new Date(order.createdAt).toLocaleDateString();
        order.user = order.userId;
        order.finalAmount = order.finalAmount;
        order.paymentStatus = order.paymentStatus;

        return order;
      })
      .filter((order) => order.orderedItems.length > 0);

    const count = await OrderSchema.countDocuments(searchFilter);

    return res.render("admin/order", {
      hideHeader: true,
      hideFooter: true,
      orders: filteredOrders,
      totalPage: Math.ceil(count / limit),
      currentPage: page,
      isMyOrderEmpty: filteredOrders.length === 0,
      search,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};

const orderMangement = async (req, res) => {
  try {
    const itemId = req.params.id;
    console.log("orderMangement", itemId);

    const orders = await OrderSchema.findOne(
      { "orderedItems._id": itemId },
      {
        orderedItems: { $elemMatch: { _id: itemId } },
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
        razorpayPaymentId: 1,
        orderId: 1,
      }
    )
      .populate("userId", "name email")
      .populate("orderedItems.productId", "productName productImages")
      .lean();

    orders.orderedItems = orders.orderedItems.filter((item) => item.productId);

    orders.formattedDate = new Date(orders.createdAt).toLocaleDateString();
    const item = orders.orderedItems[0];
    orders.itemId = item._id;
    const fullStatusHistory = item.statusHistory;
    orders.fullStatusHistory = fullStatusHistory.map((item) => ({
      status: item.status,
      date: new Date(item.changedAt).toLocaleString(),
    }));
    let latestOrderStatus = item.statusHistory[item.statusHistory.length - 1];
    orders.status = latestOrderStatus.status;
    orders.cancellationReason = latestOrderStatus.cancellationReason;
    orders.isAdminCancelled = latestOrderStatus.isAdminCancelled;
    let changedAtDate = latestOrderStatus.changedAt;
    orders.date = new Date(changedAtDate).toLocaleDateString();

    let returnRequest = item.returnRequest;
    orders.isUserRequested = returnRequest.isUserRequested;
    orders.returnRequestDate = new Date(
      returnRequest.returnRequest
    ).toLocaleString;
    orders.reason = returnRequest.reason;
    orders.comment = returnRequest.comment;
    orders.isAdminApproved = returnRequest.isAdminApproved;

    const address = await AddressSchema.findOne(
      { "address._id": orders.address },
      { "address.$": 1 }
    ).lean();

    res.render("admin/orderManagement", {
      hideHeader: true,
      hideFooter: true,
      orders,
      address: address.address[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};

const changeOrderStatus = async (req, res) => {
  try {
    const itemId = req.params.id;
    const { status, reason } = req.body;
    let formattedReason;

    if (reason) {
      formattedReason = reason.replace(/_/g, " ");
      foramttedDate =
        formattedReason.charAt(0).toUpperCase() + formattedReason.slice(1);
    }

    const updatedOrder = await OrderSchema.findOneAndUpdate(
      { "orderedItems._id": itemId },
      {
        $push: {
          "orderedItems.$.statusHistory": {
            status,
            changedAt: new Date(),
            cancellationReason: formattedReason,
            isAdminCancelled: true,
          },
        },
        $set: { currentStatus: status },
      },
      { new: true }
    );

    let item = updatedOrder.orderedItems.find(
      (i) => i._id.toString() === itemId.toString()
    );

    const updatedStatus = item.statusHistory.at(-1).status;
    const updatedDate = item.statusHistory.at(-1).changedAt;
    const updatedReason = item.statusHistory.at(-1).cancellationReason;
    const date = new Date(updatedDate).toLocaleString();

    return res.status(httpStatus.OK).json({
      message: "Status changed",
      status: updatedStatus,
      date: date,
      reason: updatedReason,
    });
  } catch (error) {
    console.error("error in changeOrderStatus ", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send("Internal Server Error");
  }
};

const changePyamentStatus = async (req, res) => {
  try {
    const itemId = req.params.id;
    const { payment } = req.body;
    let status;

    if (payment === "Unpaid" || payment === "Pending") {
      const updatedPaymentStatus = await OrderSchema.findOneAndUpdate(
        { "orderedItems._id": itemId },
        {
          $set: { paymentStatus: "Paid" },
        },
        { new: true }
      );
      status = updatedPaymentStatus.paymentStatus;
    } else if (payment === "Paid") {
      const updatedPaymentStatus = await OrderSchema.findOneAndUpdate(
        { "orderedItems._id": itemId },
        {
          $set: { paymentStatus: "Unpaid" },
        },
        { new: true }
      );
      status = updatedPaymentStatus.paymentStatus;
    } else {
      return res.status(httpStatus.BAD_REQUEST).json({
        message: "Something wrong in payment change (payment keyword)",
      });
    }

    return res
      .status(httpStatus.OK)
      .json({ message: "Payment method changed", status: status });
  } catch (error) {
    console.error("error in changePyamentStatus ", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send("Internal Server Error");
  }
};

const loadReviewReturn = async (req, res) => {
  try {
    const itemId = req.params.id;
    const order = await OrderSchema.findOne(
      { "orderedItems._id": itemId },
      {
        orderedItems: { $elemMatch: { _id: itemId } },
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
        orderId: 1,
        razorpayPaymentId: 1,
        userId: 1,
      }
    )
      .populate("userId", "name email")
      .populate("orderedItems.productId", "productName productImages")
      .lean();

    order.orderedItems = order.orderedItems.filter((item) => item.productId);

    order.formattedDate = new Date(order.createdAt).toLocaleDateString();
    const item = order.orderedItems[0];
    order.itemId = item._id;
    order.totalPrice = item.totalPrice;
    const fullStatusHistory = item.statusHistory;
    order.fullStatusHistory = fullStatusHistory.map((item) => ({
      status: item.status,
      date: new Date(item.changedAt).toLocaleString(),
    }));
    let latestOrderStatus = item.statusHistory[item.statusHistory.length - 1];
    order.status = latestOrderStatus.status;
    order.cancellationReason = latestOrderStatus.cancellationReason;
    order.isAdminCancelled = latestOrderStatus.isAdminCancelled;

    let changedAtDate = latestOrderStatus.changedAt;
    order.date = new Date(changedAtDate).toLocaleDateString();

    let returnRequest = item.returnRequest;
    order.isUserRequested = returnRequest.isUserRequested;
    order.returnReason = returnRequest.reason;
    order.returnComment = returnRequest.comment;
    order.refundStatus = returnRequest.refundStatus;
    order.isAdminApproved = returnRequest.isAdminApproved;
    order.refundDate = new Date(returnRequest.refundDate).toLocaleString();
    order.returnRequestdate = new Date(
      returnRequest.requestDate
    ).toLocaleDateString();

    console.log("order.isAdminApproved", order.isAdminApproved);

    const address = await AddressSchema.findOne(
      { "address._id": order.address },
      { "address.$": 1 }
    ).lean();

    const userId = order.userId._id;

    res.render("admin/reviewReturn", {
      hideHeader: true,
      hideFooter: true,
      order,
      userId,
      address: address.address[0],
    });
  } catch (error) {
    console.error("error in loadReviewOrder ", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send("Internal Server Error");
  }
};

const changeReturnStatus = async (req, res) => {
  try {
    const { isRejected, isAccepted } = req.body;
    const itemId = req.params.id;
    let updatedOrder;

    if (isAccepted) {
      updatedOrder = await OrderSchema.findOneAndUpdate(
        { "orderedItems._id": itemId },
        {
          $set: {
            "orderedItems.$.returnRequest.isAdminApproved": true,
            "orderedItems.$.returnRequest.decisionDate": new Date(),
            "orderedItems.$.returnRequest.isReturnInitiated": false,
          },
          $push: {
            "orderedItems.$.statusHistory": {
              status: "Returned",
              changedAt: new Date(),
            },
          },
        },
        { new: true }
      );
    } else if (isRejected) {
      updatedOrder = await OrderSchema.findOneAndUpdate(
        { "orderedItems._id": itemId },
        {
          $set: {
            "orderedItems.$.returnRequest.isAdminApproved": false,
            "orderedItems.$.returnRequest.decisionDate": new Date(),
            "orderedItems.$.returnRequest.isReturnInitiated": false,
          },
          $push: {
            "orderedItem.$.statushistory": {
              status: "Delivered",
              changedAt: new Date(),
            },
          },
        },
        { new: true }
      );
    }

    const updatedItem = updatedOrder.orderedItems[0];
    updatedOrder.status = updatedItem.returnRequest.isAdminApproved;

    if (isAccepted) {
      return res
        .status(httpStatus.OK)
        .json({ message: "Return request accepted " });
    } else if (isRejected) {
      return res
        .status(httpStatus.OK)
        .json({ message: "Return request rejected " });
    }
  } catch (error) {
    console.error("error in changeReturnStatus ", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send("Internal Server Error");
  }
};

const loadReturnOrRefund = async (req, res) => {
  try {
    const order = await OrderSchema.find(
      {
        "orderedItems.returnRequest.isUserRequested": true,
      },
      // {
      //   orderedItems: {
      //     $elemMatch: { "returnRequest.isUserRequested": true },
      //   },
      // }
    )
      .populate("userId", "name")
      .populate("orderedItems.productId", "productName productImages")
      .lean();

    const filteredOrders = order
      .map((order) => {
        order.orderedItems = order.orderedItems
          .filter((item) =>  item.productId !== null && item.returnRequest?.isUserRequested)
          .map((item) => ({
            id: item._id,
            productId: item.productId._id,
            productName: item.productId.productName,
            quantity: item.quantity,
            productImages: item.productId.productImages,
            returnStaus: item.returnRequest.isUserRequested,
            returnDate: new Date(
              item.returnRequest.requestDate
            ).toLocaleDateString(),
            reason: item.returnRequest.reason,
            isAdminApproved: item.returnRequest.isAdminApproved,
            decisionDate: item.returnRequest.decisionDate,
            refundStatus: item.returnRequest.refundStatus,
          }));
        order.user = order.userId;
        return order;
      })
      .filter((order) => order.orderedItems.length > 0);

    console.log("loadReturnOrRefund:", filteredOrders.reason);

    return res.render("admin/return-or-refund", {
      hideHeader: true,
      hideFooter: true,
      orders: filteredOrders,
    });
  } catch (error) {
    console.error("error in loadReturnOrRefund ", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send("Internal Server Error");
  }
};

const initiateRefund = async (req, res) => {
  try {
    const itemId = req.params.id;

    const order = await OrderSchema.findOne(
      { "orderedItems._id": itemId },
      {
        _id:1,
        orderedItems: { $elemMatch: { _id: itemId } },
        userId: 1,
        orderId: 1,
        paymentStatus: 1,
        paymentMethod: 1,
      }
    )
      .populate("userId", "name email")
      .populate("orderedItems.productId", "productName")
      .lean();

    order.orderedItems = order.orderedItems.filter((item) => item.productId);
    const item = order.orderedItems[0];
    order.totalPrice = item.totalPrice;
    order.itemName = item.productId.productName;
    const userId = order.userId._id;

    console.log("productname:", order.itemName);
    console.log("initiateRefund price:", order.totalPrice);

    console.log("initiateRefund userId:", userId);

    const updateWallet = await WalletSchema.findOneAndUpdate(
      { userId },
      {
        $inc: { balance: order.totalPrice },
        $push: {
          transactions: {
            orderId: order._id,
            type: "credit",
            amount: order.totalPrice,
            description: `Refund for the order ${order.orderId} - item name:${order.itemName}`,
          },
        },
      },
      { new: true }
    );

    const updatedOrder = await OrderSchema.findOneAndUpdate(
      { "orderedItems._id": itemId },
      {
        $set: {
          "orderedItems.$.returnRequest.refundStatus": true,
          "orderedItems.$.returnRequest.refundDate": new Date(),
        },
      },
      { new: true }
    );

    updatedOrder.orderedItems = updatedOrder.orderedItems.filter(
      (item) => item.productId
    );
    const updatedItem = updatedOrder.orderedItems[0];
    updatedOrder.status = updatedItem.returnRequest.refundStatus;
    updatedOrder.refundDate = updatedItem.returnRequest.refundDate;

    return res.status(httpStatus.OK).json({
      message: "Refund successfull",
      refundStatus: updatedOrder.status,
      refundDate: updatedOrder.refundDate,
    });
  } catch (error) {
    console.error("error in initiateRefund ", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send("Internal Server Error");
  }
};

module.exports = {
  loadOrder,
  orderMangement,
  changeOrderStatus,
  changePyamentStatus,
  loadReviewReturn,
  changeReturnStatus,
  loadReturnOrRefund,
  initiateRefund,
};
