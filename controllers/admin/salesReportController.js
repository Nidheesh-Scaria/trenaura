const OrderSchema = require("../../models/orderSchema");
const UserSchema = require("../../models/userSchema");
const moment = require("moment");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

const httpStatus = require("../../util/statusCodes");
const { MESSAGES } = require("../../util/constants");

const loadSalesReport = async (req, res) => {
  try {
    let { startDate, endDate, filter, search, page = 1 } = req.query;

    page = parseInt(page) || 1;
    const limit = 5;
    let dateFilter = {};
    const today = moment().endOf("day");

    if (filter === "day") {
      startDate = moment().subtract(1, "days").startOf("day");
      endDate = today;
    } else if (filter === "week") {
      startDate = moment().subtract(7, "days").startOf("day");
      endDate = today;
    } else if (filter === "month") {
      startDate = moment().subtract(1, "months").startOf("day");
      endDate = today;
    } else {
      if (startDate) startDate = moment(startDate).startOf("day");
      if (endDate) endDate = moment(endDate).endOf("day");
    }

    if (startDate && endDate) {
      dateFilter = {
        createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() },
      };
    }

    
    let searchFilter = {};
    if (search) {
      searchFilter = { orderId: { $regex: search, $options: "i" } };
    }

    const query = { ...dateFilter, ...searchFilter };

    
    const orders = await OrderSchema.find(query)
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();


    let summary = await OrderSchema.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$finalAmount" },
          totalDiscount: { $sum: "$discount" },
          totalCoupon: { $sum: "$couponDiscount" },
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    const summaryData = summary[0] || {
      totalSales: 0,
      totalDiscount: 0,
      totalCoupon: 0,
      totalOrders: 0,
    };

    return res.render("admin/salesReport", {
      hideHeader: true,
      hideFooter: true,
      order: orders.map((o) => ({
        ...o,
        user: o.userId,
      })),
      totalSales: summaryData.totalSales,
      totalDiscount: summaryData.totalDiscount,
      totalCoupon: summaryData.totalCoupon,
      totalOrders: summaryData.totalOrders,
      startDate: startDate ? moment(startDate).format("YYYY-MM-DD") : "",
      endDate: endDate ? moment(endDate).format("YYYY-MM-DD") : "",
      filter,
      search,
      currentPage: page,
      totalPages: Math.ceil(summaryData.totalOrders / limit),
      today: moment().format("YYYY-MM-DD"),
    });
  } catch (error) {
    console.error("Error in loadSalesReport:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false });
  }
};


const salesReportDownload = async (req, res) => {
  try {
    let { startDate, endDate, format } = req.body;
    let dateFilter = {};

    if (startDate && endDate) {
      let start = new Date(startDate);
      let end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      dateFilter = {
        createdAt: { $gte: start, $lte: end },
      };
    }

    const order = await OrderSchema.find(dateFilter)
      .populate("userId", "name")
      .sort({ createdAt: -1 })
      .lean();

    if (format === "excel") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Sales Report");

      worksheet.columns = [
        { header: "User Name", key: "user", width: 20 },
        { header: "Order ID", key: "orderId", width: 30 },
        { header: "Date", key: "createdAt", width: 20 },
        { header: "Total", key: "totalPrice", width: 15 },
        { header: "Final Amount", key: "finalAmount", width: 15 },
        { header: "Discount", key: "discount", width: 15 },
        { header: "Coupon", key: "coupon", width: 15 },
      ];

      order.forEach((orders) => {
        worksheet.addRow({
          user: orders.userId.name || "N/A",
          orderId: orders.orderId,
          createdAt: orders.createdAt,
          totalPrice: orders.totalPrice,
          finalAmount: orders.finalAmount,
          discount: orders.discount,
          coupon: orders.couponApplied ? "Yes" : "No",
        });
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=sales-report.xlsx"
      );
      await workbook.xlsx.write(res);
      res.end();
    }
    //for pdf
    else if (format === "pdf") {
      const doc = new PDFDocument({ margin: 30, size: "A4" });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachement; filename=sales-report.pdf"
      );

      doc.pipe(res);

      doc.fontSize(18).text("Sales Reportt", { align: "center" });
      doc.moveDown();

      order.forEach((orders) => {
        doc
          .fontSize(12)
          .text(
            `User: ${orders.userId?.name || "N/A"} | OrderID: ${
              orders.orderId
            } | Date: ${new Date(
              orders.createdAt
            ).toLocaleDateString()} | Total: ₹${orders.totalPrice} | Final: ₹${
              orders.finalAmount
            } | Discount: ₹${orders.discount} | Coupon: ${
              orders.couponApplied ? "Yes" : "No"
            }`
          );
        doc.moveDown(0.5);
      });
      doc.end();
    } else {
      return res.json("Invaid Format");
    }
  } catch (error) {
    console.error("Error in salesReportDownload:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false });
  }
};

module.exports = {
  loadSalesReport,
  salesReportDownload,
};
