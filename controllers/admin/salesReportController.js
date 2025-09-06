const OrderSchema = require("../../models/orderSchema");
const UserSchema = require("../../models/userSchema");

const httpStatus = require("../../util/statusCodes");
const { MESSAGES } = require("../../util/constants");
const fs = require("fs");

const loadSalesReport = async (req, res) => {
  try {
    const order = await OrderSchema.find()
      .populate("userId", "name email")
      .populate("orderedItems.productId", "productName productImages")
      .lean();

    const filteredOrders = order
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
            refundStatus: item.returnRequest.refundStatus,
          }));
        order.formattedDate = new Date(order.createdAt).toLocaleDateString();
        order.user = order.userId;
        order.finalAmount = order.finalAmount;
        order.paymentStatus = order.paymentStatus;

        return order;
      })
      .filter((order) => order.orderedItems.length > 0);

    let totalSales = order.reduce((total, item) => {
      return total + (item.finalAmount || 0);
    }, 0);
    let totalDiscount = order.reduce((total, item) => {
      return total + (item.discount || 0);
    }, 0);
    
    totalSales = Number(totalSales.toFixed(2));
    totalDiscount = Number(totalDiscount.toFixed(2));

    return res.render("admin/salesReport", {
      hideHeader: true,
      hideFooter: true,
      order: filteredOrders,
      totalSales,
      totalDiscount,
    });
  } catch (error) {
    console.error("Error in loadSalesReport:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false });
  }
};

module.exports = {
  loadSalesReport,
};
