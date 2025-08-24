const OrderSchema = require("../models/orderSchema");
const AddressSchema = require("../models/addressSchema");
const UserSchema = require("../models/userSchema");

const httpStatus = require("../util/statusCodes");
const { MESSAGES } = require("../util/constants");

//order management

const loadOrder = async (req, res) => {
  try {
    const orders = await OrderSchema.find()
      .populate("userId", "name email")
      .populate("orderedItems.productId", "productName productImages")
      .sort({ createdAt: -1 })
      .lean();

    const filteredOrders = orders
      .map((order) => {
        order.orderedItems = order.orderedItems.filter(
          (item) => item.productId
        );
        order.foramttedDate = new Date(order.createdAt).toLocaleDateString();
        order.statusHistory =
          order.statusHistory[order.statusHistory.length - 1].status;
        return order;
      })
      .filter((order) => order.orderedItems.length > 0);

    return res.render("admin/order", {
      hideHeader: true,
      hideFooter: true,
      orders: filteredOrders,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};

const orderMangement = async (req, res) => {
  try {
    const orderId = req.params.id;

    const orders = await OrderSchema.findById(orderId)
      .populate("userId", "name email")
      .populate("orderedItems.productId", "productName productImages")
      .lean();

    orders.orderedItems = orders.orderedItems.filter((item) => item.productId);
    orders.formattedDate = new Date(orders.createdAt).toLocaleDateString();
    const status = orders.statusHistory[orders.statusHistory.length - 1].status;
    const statusDate = orders.statusHistory[orders.statusHistory.length - 1].changedAt;
    const date = new Date(statusDate).toLocaleString();

    const address = await AddressSchema.findOne(
      { "address._id": orders.address },
      { "address.$": 1 }
    ).lean();

    res.render("admin/orderManagement", {
      hideHeader: true,
      hideFooter: true,
      orders,
      address: address.address[0],
      status,
      date,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};

const changeOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status } = req.body;

    const updatedOrder = await OrderSchema.findByIdAndUpdate(
      orderId,
      {
        $push: { statusHistory: { status, changedAt: new Date() } },
      },
      { new: true }
    );

    const updatedStatus =
      updatedOrder.statusHistory[updatedOrder.statusHistory.length - 1].status;
    const updatedDate =
      updatedOrder.statusHistory[updatedOrder.statusHistory.length - 1]
        .changedAt;
    const date = new Date(updatedDate).toLocaleString();

    return res
      .status(httpStatus.OK)
      .json({ message: "Status changed", status: updatedStatus, date: date });
  } catch (error) {
    console.error("error in changeOrderStatus ", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send("Internal Server Error");
  }
};

const changePyamentStatus = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { payment } = req.body;
    let status;

    if (payment === "Unpaid") {
      const updatedPaymentStatus = await OrderSchema.findByIdAndUpdate(
        orderId,
        {
          $set: { paymentStatus: "Paid" },
        },
        { new: true }
      );
      status = updatedPaymentStatus.paymentStatus;
    } else if (payment === "Paid") {
      const updatedPaymentStatus = await OrderSchema.findByIdAndUpdate(
        orderId,
        {
          $set: { paymentStatus: "Unpaid" },
        },
        { new: true }
      );
      status = updatedPaymentStatus.paymentStatus;
    } else {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({
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

module.exports = {
  loadOrder,
  orderMangement,
  changeOrderStatus,
  changePyamentStatus,
};
