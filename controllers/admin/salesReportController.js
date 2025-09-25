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
        date:new Date(o.createdAt).toLocaleDateString(),
        finalAmounts:Math.round(o.finalAmount),
        discounts:Math.round(o.discount)
      })),
      totalSales:Math.round(summaryData.totalSales) ,
      totalDiscount: Math.round(summaryData.totalDiscount) ,
      totalCoupon:Math.round(summaryData.totalCoupon),
      totalOrders:Math.round(summaryData.totalOrders),
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
      .populate("orderedItems.productId", "productName")
      .sort({ createdAt: -1 })
      .lean();

    if (format === "excel") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Sales Report");

      worksheet.columns = [
        { header: "Date", key: "createdAt", width: 20 },
        { header: "User Name", key: "user", width: 20 },
        { header: "Order ID", key: "orderId", width: 30 },
        { header: "Product", key: "productName", width: 30 },
        { header: "Quantity", key: "quantity", width: 15 },
        { header: "Total Price", key: "totalPrice", width: 15 },
        { header: "Final Amount", key: "finalAmount", width: 15 },
        { header: "Discount", key: "discount", width: 15 },
        { header: "Coupon Discount", key: "couponDiscount", width: 15 },
        { header: "Coupon", key: "coupon", width: 15 },
      ];

      order.forEach((orders) => {
        orders.orderedItems.forEach((item) => {
          worksheet.addRow({
            createdAt: new Date(orders.createdAt).toLocaleDateString(),
            user: orders.userId.name || "N/A",
            orderId: orders.orderId,
            productName: item.productId.productName,
            quantity: item.quantity,
            totalPrice: item.totalPrice,
            finalAmount: orders.finalAmount,
            discount: orders.discount,
            couponDiscount: orders.couponDiscount,
            coupon: orders.couponApplied ? "Yes" : "No",
          });
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
        "attachment; filename=sales-report.pdf"
      );

      doc.pipe(res);

      // Title
      doc.fontSize(18).text("Sales Report", { align: "center" });
      doc.moveDown(1);

      const tableTop = 100;
      const itemX = 30;

      // Column widths
      const columnWidths = {
        user: 100,
        orderId: 100,
        product: 150,
        date: 60,
        quantity: 50,
        finalAmount: 70,
        discount: 60,
        coupon: 50,
      };

      const rowPadding = 5;

      // Table header
      doc
        .fontSize(12)
        .text("User", itemX, tableTop, { width: columnWidths.user });
      doc.text("Order Id", itemX + columnWidths.user, tableTop, {
        width: columnWidths.orderId,
      });
      doc.text(
        "Product",
        itemX + columnWidths.user + columnWidths.orderId,
        tableTop,
        { width: columnWidths.product }
      );
      doc.text(
        "Date",
        itemX + columnWidths.user + columnWidths.orderId + columnWidths.product,
        tableTop,
        { width: columnWidths.date }
      );
      doc.text(
        "Quantity",
        itemX +
          columnWidths.user +
          columnWidths.orderId +
          columnWidths.product +
          columnWidths.date,
        tableTop,
        { width: columnWidths.quantity }
      );
      doc.text(
        "Final Amount",
        itemX +
          columnWidths.user +
          columnWidths.orderId +
          columnWidths.product +
          columnWidths.date +
          columnWidths.quantity,
        tableTop,
        { width: columnWidths.finalAmount }
      );
      // doc.text("Discount", itemX + columnWidths.user + columnWidths.orderId + columnWidths.product + columnWidths.date + columnWidths.quantity + columnWidths.finalAmount, tableTop, { width: columnWidths.discount });
      // doc.text("Coupon", itemX + columnWidths.user + columnWidths.orderId + columnWidths.product + columnWidths.date + columnWidths.quantity + columnWidths.finalAmount + columnWidths.discount, tableTop, { width: columnWidths.coupon });

      let y = tableTop + 25;

      order.forEach((order) => {
        order.orderedItems.forEach((item) => {
          // Calculate row height based on tallest cell
          const userHeight = doc.heightOfString(order.userId?.name || "N/A", {
            width: columnWidths.user,
          });
          const productHeight = doc.heightOfString(item.productId.productName, {
            width: columnWidths.product,
          });
          const rowHeight = Math.max(userHeight, productHeight) + rowPadding;

          // Page break if row exceeds page
          if (y + rowHeight > doc.page.height - 40) {
            doc.addPage();
            y = 70;
          }

          // Row data
          doc.text(order.userId?.name || "N/A", itemX, y, {
            width: columnWidths.user,
          });
          doc.text(order.orderId, itemX + columnWidths.user, y, {
            width: columnWidths.orderId,
          });
          doc.text(
            item.productId.productName.slice(0, 20),
            itemX + columnWidths.user + columnWidths.orderId,
            y,
            { width: columnWidths.product }
          );
          doc.text(
            new Date(order.createdAt).toLocaleDateString(),
            itemX +
              columnWidths.user +
              columnWidths.orderId +
              columnWidths.product,
            y,
            { width: columnWidths.date }
          );
          doc.text(
            item.quantity,
            itemX +
              columnWidths.user +
              columnWidths.orderId +
              columnWidths.product +
              columnWidths.date,
            y,
            { width: columnWidths.quantity }
          );
          doc.text(
            `₹${order.finalAmount}`,
            itemX +
              columnWidths.user +
              columnWidths.orderId +
              columnWidths.product +
              columnWidths.date +
              columnWidths.quantity,
            y,
            { width: columnWidths.finalAmount }
          );
          // doc.text(`₹${item.discount || 0}`, itemX + columnWidths.user + columnWidths.orderId + columnWidths.product + columnWidths.date + columnWidths.quantity + columnWidths.finalAmount, y, { width: columnWidths.discount });
          // doc.text(order.couponApplied ? "Yes" : "No", itemX + columnWidths.user + columnWidths.orderId + columnWidths.product + columnWidths.date + columnWidths.quantity + columnWidths.finalAmount + columnWidths.discount, y, { width: columnWidths.coupon });

          // Move y to next row
          y += rowHeight;
        });
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
