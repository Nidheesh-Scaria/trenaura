const OrderSchema = require("../../models/orderSchema");
const UserSchema = require("../../models/userSchema");
const moment = require("moment");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

const httpStatus = require("../../util/statusCodes");
const { MESSAGES } = require("../../util/constants");

// const loadSalesReport = async (req, res) => {
//   try {
//     let { startDate, endDate, filter, search, page = 1 } = req.query;

//     page = parseInt(page) || 1;
//     const limit = 5;
//     let dateFilter = {};
//     const today = moment().endOf("day");

//     if (filter === "day") {
//       startDate = moment().subtract(1, "days").startOf("day");
//       endDate = today;
//     } else if (filter === "week") {
//       startDate = moment().subtract(7, "days").startOf("day");
//       endDate = today;
//     } else if (filter === "month") {
//       startDate = moment().subtract(1, "months").startOf("day");
//       endDate = today;
//     } else {
//       if (startDate) startDate = moment(startDate).startOf("day");
//       if (endDate) endDate = moment(endDate).endOf("day");
//     }

//     if (startDate && endDate) {
//       dateFilter = {
//         createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() },
//       };
//     }

//     let searchFilter = {};
//     if (search) {
//       searchFilter = { orderId: { $regex: search, $options: "i" } };
//     }

//     const query = { ...dateFilter, ...searchFilter };

//     const orders = await OrderSchema.find(query)
//       .populate("userId", "name email")
//       .sort({ createdAt: -1 })
//       .skip((page - 1) * limit)
//       .limit(limit)
//       .lean();

//     let summary = await OrderSchema.aggregate([
//       { $match: query },
//       {
//         $group: {
//           _id: null,
//           totalSales: { $sum: "$finalAmount" },
//           totalDiscount: { $sum: "$discount" },
//           totalCoupon: { $sum: "$couponDiscount" },
//           totalOrders: { $sum: 1 },
//         },
//       },
//     ]);

//     const summaryData = summary[0] || {
//       totalSales: 0,
//       totalDiscount: 0,
//       totalCoupon: 0,
//       totalOrders: 0,
//     };

//     return res.render("admin/salesReport", {
//       hideHeader: true,
//       hideFooter: true,
//       order: orders.map((o) => ({
//         ...o,
//         user: o.userId,
//         date: new Date(o.createdAt).toLocaleDateString(),
//         finalAmounts: Math.round(o.finalAmount),
//         discounts: Math.round(o.discount),
//       })),
//       totalSales: Math.round(summaryData.totalSales),
//       totalDiscount: Math.round(summaryData.totalDiscount),
//       totalCoupon: Math.round(summaryData.totalCoupon),
//       totalOrders: Math.round(summaryData.totalOrders),
//       startDate: startDate ? moment(startDate).format("YYYY-MM-DD") : "",
//       endDate: endDate ? moment(endDate).format("YYYY-MM-DD") : "",
//       filter,
//       search,
//       currentPage: page,
//       totalPages: Math.ceil(summaryData.totalOrders / limit),
//       today: moment().format("YYYY-MM-DD"),
//     });
//   } catch (error) {
//     console.error("Error in loadSalesReport:", error);
//     res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false });
//   }
// };

const loadSalesReport = async (req, res) => {
  try {
    let { startDate, endDate, filter, search, page = 1 } = req.query;
    page = parseInt(page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const today = moment().endOf("day");
    let dateFilter = {};

    // Date filter setup
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

    // ✅ Aggregation to get only delivered products
    const deliveredProducts = await OrderSchema.aggregate([
      { $match: { ...dateFilter, ...searchFilter } },

      // Unwind orderedItems
      { $unwind: "$orderedItems" },

      // Match only delivered items
      {
        $match: {
          "orderedItems.statusHistory.status": "Delivered",
        },
      },

      // Lookup for user details
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },

      { $unwind: "$user" },

      // Lookup for product details
      {
        $lookup: {
          from: "products",
          localField: "orderedItems.productId",
          foreignField: "_id",
          as: "product",
        },
      },

      { $unwind: "$product" },

      // Sort and paginate
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },

      // Project only what we need
      {
        $project: {
          orderId: 1,
          createdAt: 1,
          "user.name": 1,
          "user.email": 1,
          "product.productName": 1,
          "product.category": 1,
          "orderedItems.quantity": 1,
          "orderedItems.finalAmount": 1,
          "orderedItems.offerDiscount": 1,
          "orderedItems.couponDiscount": 1,
        },
      },
    ]);

    // ✅ Get summary for delivered products only
    const summary = await OrderSchema.aggregate([
      { $match: { ...dateFilter, ...searchFilter } },
      { $unwind: "$orderedItems" },
      {
        $match: {
          "orderedItems.statusHistory.status": "Delivered",
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$orderedItems.finalAmount" },
          totalDiscount: { $sum: "$orderedItems.offerDiscount" },
          totalCoupon: { $sum: "$orderedItems.couponDiscount" },
          totalDeliveredProducts: { $sum: 1 },
        },
      },
    ]);

    const summaryData = summary[0] || {
      totalSales: 0,
      totalDiscount: 0,
      totalCoupon: 0,
      totalDeliveredProducts: 0,
    };

    res.render("admin/salesReport", {
      hideHeader: true,
      hideFooter: true,
      order: deliveredProducts.map((o) => ({
        orderId: o.orderId,
        userName: o.user?.name,
        userEmail: o.user?.email,
        productName: o.product?.productName,
        category: o.product?.category,
        quantity: o.orderedItems.quantity,
        price: Math.round(o.orderedItems.finalAmount),
        discount: Math.round(o.orderedItems.offerDiscount),
        couponDiscount: Math.round(o.orderedItems.couponDiscount),
        date: new Date(o.createdAt).toLocaleDateString(),
      })),
      totalSales: Math.round(summaryData.totalSales),
      totalDiscount: Math.round(summaryData.totalDiscount),
      totalCoupon: Math.round(summaryData.totalCoupon),
      totalOrders: Math.round(summaryData.totalDeliveredProducts),
      startDate: startDate ? moment(startDate).format("YYYY-MM-DD") : "",
      endDate: endDate ? moment(endDate).format("YYYY-MM-DD") : "",
      filter,
      search,
      currentPage: page,
      totalPages: Math.ceil(summaryData.totalDeliveredProducts / limit),
      today: moment().format("YYYY-MM-DD"),
    });
  } catch (error) {
    console.error("Error in loadSalesReport:", error);
    res.status(500).json({ success: false });
  }
};

// const salesReportDownload = async (req, res) => {
//   try {
//     let { startDate, endDate, format } = req.body;
//     let dateFilter = {};

//     // Apply date filter if provided
//     if (startDate && endDate) {
//       const start = new Date(startDate);
//       const end = new Date(endDate);
//       end.setHours(23, 59, 59, 999);

//       dateFilter = { createdAt: { $gte: start, $lte: end } };
//     }

//     // Fetch orders
//     const orders = await OrderSchema.find({
//       ...dateFilter,
//       isOrderPlaced: true,
//     })
//       .populate("userId", "name")
//       .populate("orderedItems.productId", "productName")
//       .sort({ createdAt: -1 })
//       .lean();

//     if (!orders.length) {
//       return res.status(httpStatus.BAD_REQUEST).json({
//         success: false,
//         message: "No orders found for the selected period.",
//       });
//     }

//     // Summary Calculations
//     const totalOrders = orders.length;
//     const totalRevenue = orders.reduce((sum, o) => sum + (o.finalAmount || 0), 0);
//     const totalDiscount = orders.reduce((sum, o) => sum + (o.discount || 0), 0);
//     const totalCouponDiscount = orders.reduce(
//       (sum, o) => sum + (o.couponDiscount || 0),
//       0
//     );
//     const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

//     const paymentStats = {};
//     orders.forEach((o) => {
//       const method = o.paymentMethod || "Unknown";
//       paymentStats[method] = (paymentStats[method] || 0) + 1;
//     });

//     // EXCEL EXPORT

//     if (format === "excel") {
//       const workbook = new ExcelJS.Workbook();
//       const sheet = workbook.addWorksheet("Sales Report");

//       // --- Summary Section ---
//       sheet.addRow(["SALES REPORT SUMMARY"]).font = { bold: true, size: 14 };
//       sheet.addRow([]);
//       sheet.addRow(["Report Period:", `${startDate || "All"} to ${endDate || "All"}`]);
//       sheet.addRow(["Total Orders:", totalOrders]);
//       sheet.addRow(["Total Revenue:", `₹${totalRevenue.toFixed(2)}`]);
//       sheet.addRow(["Total Discount:", `₹${totalDiscount.toFixed(2)}`]);
//       sheet.addRow(["Coupon Discount:", `₹${totalCouponDiscount.toFixed(2)}`]);
//       sheet.addRow(["Average Order Value:", `₹${averageOrderValue.toFixed(2)}`]);
//       sheet.addRow([]);

//       sheet.addRow(["Payment Method Breakdown:"]);
//       Object.entries(paymentStats).forEach(([method, count]) => {
//         sheet.addRow([`${method}:`, count]);
//       });
//       sheet.addRow([]);
//       sheet.addRow([]);

//       // --- Table Headers ---
//       sheet.columns = [
//         { header: "Date", key: "date", width: 15 },
//         { header: "User Name", key: "userName", width: 20 },
//         { header: "Order ID", key: "orderId", width: 25 },
//         { header: "Product", key: "product", width: 25 },
//         { header: "Quantity", key: "quantity", width: 10 },
//         { header: "Final Amount", key: "finalAmount", width: 15 },
//         { header: "Discount", key: "discount", width: 15 },
//         { header: "Coupon Discount", key: "couponDiscount", width: 18 },
//         { header: "Payment Method", key: "paymentMethod", width: 20 },
//       ];

//       // --- Add Data Rows ---
//       orders.forEach((order) => {
//         order.orderedItems.forEach((item) => {
//           sheet.addRow({
//             date: new Date(order.createdAt).toLocaleDateString(),
//             userName: order.userId?.name || "N/A",
//             orderId: order.orderId,
//             product: item.productId?.productName || "N/A",
//             quantity: item.quantity,
//             finalAmount: `₹${order.finalAmount}`,
//             discount: `₹${order.discount}`,
//             couponDiscount: `₹${order.couponDiscount}`,
//             paymentMethod: order.paymentMethod || "Unknown",
//           });
//         });
//       });

//       // --- Style Header Row ---
//       sheet.getRow(20).eachCell((cell) => {
//         cell.font = { bold: true };
//         cell.alignment = { horizontal: "center", vertical: "middle" };
//         cell.fill = {
//           type: "pattern",
//           pattern: "solid",
//           fgColor: { argb: "FFE0E0E0" },
//         };
//       });

//       res.setHeader(
//         "Content-Type",
//         "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//       );
//       res.setHeader("Content-Disposition", "attachment; filename=sales-report.xlsx");

//       await workbook.xlsx.write(res);
//       res.end();
//     }

//     // PDF EXPORT

//     else if (format === "pdf") {
//       const doc = new PDFDocument({ margin: 34, size: "A4" });
//       res.setHeader("Content-Type", "application/pdf");
//       res.setHeader("Content-Disposition", "attachment; filename=sales-report.pdf");
//       doc.pipe(res);

//       // --- Title ---
//       doc.fontSize(20).font("Helvetica-Bold").text("Sales Report", { align: "center" });
//       doc.moveDown(1);

//       // --- Summary Section ---
//       doc.fontSize(10).font("Helvetica-Bold").text("Summary", { underline: true });
//       doc.moveDown(1);
//       doc.font("Helvetica");
//       doc.text(`Report Period: ${startDate || "All"} TO ${endDate || "All"}`);
//       doc.text(`Total Orders: ${totalOrders}`);
//       doc.text(`Total Revenue: ${totalRevenue.toFixed(2)}`);
//       doc.text(`Total Discount: ${totalDiscount.toFixed(2)}`);
//       doc.text(`Coupon Discount: ${totalCouponDiscount.toFixed(2)}`);
//       doc.text(`Average Order Value: ${averageOrderValue.toFixed(2)}`);
//       doc.moveDown(1);

//       doc.font("Helvetica-Bold").text("Payment Method Breakdown:");
//       doc.font("Helvetica");
//       Object.entries(paymentStats).forEach(([method, count]) => {
//         doc.text(`• ${method}: ${count}`);
//       });
//       doc.moveDown(1);

//       // --- Table Setup ---
//       const pageWidth = doc.page.width - 2 * doc.page.margins.left;
//       const colWidths = [
//         pageWidth * 0.12, // Date
//         pageWidth * 0.15, // User
//         pageWidth * 0.18, // Order ID
//         pageWidth * 0.18, // Product
//         pageWidth * 0.08, // Qty
//         pageWidth * 0.12, // Final
//         pageWidth * 0.07, // Disc
//         pageWidth * 0.1,  // Pay
//       ];
//       const startX = doc.page.margins.left;
//       let startY = doc.y + 10;
//       const rowHeight = 25;

//       // --- Header ---
//       const headers = [
//         "Date",
//         "User",
//         "Order ID",
//         "Product",
//         "Qty",
//         "FinalAmount",
//         "Discount",
//         "Payment",
//       ];
//       doc.font("Helvetica-Bold").fontSize(9);
//       let x = startX;
//       headers.forEach((header, i) => {
//         doc.rect(x, startY, colWidths[i], rowHeight).stroke();
//         doc.text(header, x + 3, startY + 6, { width: colWidths[i] - 6, align: "center" });
//         x += colWidths[i];
//       });

//       startY += rowHeight;
//       doc.font("Helvetica").fontSize(8);

//       // --- Add Rows ---
//       const addRow = (row) => {
//         let x = startX;
//         row.forEach((text, i) => {
//           doc.rect(x, startY, colWidths[i], rowHeight).stroke();
//           doc.text(String(text), x + 3, startY + 6, {
//             width: colWidths[i] - 6,
//             align: i === 5 || i === 6 ? "right" : "left",
//           });
//           x += colWidths[i];
//         });
//         startY += rowHeight;
//       };

//       const checkPage = () => {
//         if (startY + rowHeight > doc.page.height - doc.page.margins.bottom) {
//           doc.addPage();
//           startY = doc.page.margins.top;
//           x = startX;
//           doc.font("Helvetica-Bold").fontSize(9);
//           headers.forEach((header, i) => {
//             doc.rect(x, startY, colWidths[i], rowHeight).stroke();
//             doc.text(header, x + 3, startY + 6, {
//               width: colWidths[i] - 6,
//               align: "center",
//             });
//             x += colWidths[i];
//           });
//           startY += rowHeight;
//           doc.font("Helvetica").fontSize(9);
//         }
//       };

//       orders.forEach((order) => {
//         order.orderedItems.forEach((item) => {
//           checkPage();
//           addRow([
//             new Date(order.createdAt).toLocaleDateString(),
//             order.userId?.name || "N/A",
//             order.orderId,
//             item.productId?.productName?.slice(0,25) || "N/A",
//             item.quantity,
//             order.finalAmount.toFixed(2),
//             order.discount.toFixed(2),
//             order.paymentMethod || "Unknown",
//           ]);
//         });
//       });

//       doc.end();
//     }

//     // Invalid format
//     else {
//       return res.status(400).json({ success: false, message: "Invalid format type." });
//     }
//   } catch (error) {
//     console.error("Error in salesReportDownload:", error);
//     res
//       .status(httpStatus.INTERNAL_SERVER_ERROR)
//       .json({ success: false, message: "Error generating report." });
//   }
// };

const salesReportDownload = async (req, res) => {
  try {
    let { startDate, endDate, format } = req.body;
    let dateFilter = {};

    // Apply date filter if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = { createdAt: { $gte: start, $lte: end } };
    }

    // Fetch only delivered products
    const orders = await OrderSchema.aggregate([
      { $match: { ...dateFilter, isOrderPlaced: true } },
      { $unwind: "$orderedItems" },
      {
        $match: {
          "orderedItems.statusHistory.status": "Delivered",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $lookup: {
          from: "products",
          localField: "orderedItems.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          orderId: 1,
          createdAt: 1,
          paymentMethod: 1,
          discount: 1,
          couponDiscount: 1,
          finalAmount: 1,
          "user.name": 1,
          "product.productName": 1,
          "orderedItems.quantity": 1,
          "orderedItems.couponDiscount": 1,
          "orderedItems.finalAmount": 1,
          "orderedItems.totalPrice": 1,
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    if (!orders.length) {
      return res.status(404).json({
        success: false,
        message: "No delivered products found for the selected period.",
      });
    }

    //  Adjusted summary calculations for delivered products only
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce(
      (sum, o) => sum + (o.finalAmount || 0),
      0
    );
    const totalDiscount = orders.reduce((sum, o) => sum + (o.discount || 0), 0);
    const totalCouponDiscount = orders.reduce(
      (sum, o) => sum + (o.couponDiscount || 0),
      0
    );
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const paymentStats = {};
    orders.forEach((o) => {
      const method = o.paymentMethod || "Unknown";
      paymentStats[method] = (paymentStats[method] || 0) + 1;
    });

    // --- EXCEL EXPORT ---
    if (format === "excel") {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Sales Report");

      sheet.addRow(["SALES REPORT SUMMARY"]).font = { bold: true, size: 14 };
      sheet.addRow([]);
      sheet.addRow([
        "Report Period:",
        `${startDate || "All"} to ${endDate || "All"}`,
      ]);
      sheet.addRow(["Total Delivered Products:", totalOrders]);
      sheet.addRow(["Total Revenue:", `₹${totalRevenue.toFixed(2)}`]);
      sheet.addRow(["Total Discount:", `₹${totalDiscount.toFixed(2)}`]);
      sheet.addRow(["Coupon Discount:", `₹${totalCouponDiscount.toFixed(2)}`]);
      sheet.addRow([
        "Average Order Value:",
        `₹${averageOrderValue.toFixed(2)}`,
      ]);
      sheet.addRow([]);

      sheet.addRow(["Payment Method Breakdown:"]);
      Object.entries(paymentStats).forEach(([method, count]) => {
        sheet.addRow([`${method}:`, count]);
      });
      sheet.addRow([]);
      sheet.addRow([]);

      sheet.columns = [
        { header: "Date", key: "date", width: 15 },
        { header: "User Name", key: "userName", width: 20 },
        { header: "Order ID", key: "orderId", width: 25 },
        { header: "Product", key: "product", width: 25 },
        { header: "Quantity", key: "quantity", width: 10 },
        { header: "totalPrice", key: "totalPrice", width: 15 },
        { header: "Final Amount", key: "finalAmount", width: 15 },
        { header: "Coupon Discount", key: "couponDiscount", width: 18 },
        { header: "Payment Method", key: "paymentMethod", width: 20 },
      ];

      orders.forEach((order) => {
        sheet.addRow({
          date: new Date(order.createdAt).toLocaleDateString(),
          userName: order.user?.name || "N/A",
          orderId: order.orderId,
          product: order.product?.productName || "N/A",
          quantity: order.orderedItems.quantity,
          totalPrice: `₹${order.orderedItems.totalPrice}`,
          finalAmount: `₹${order.orderedItems.finalAmount}`,
          couponDiscount: `₹${order.orderedItems.couponDiscount || 0}`,
          paymentMethod: order.paymentMethod || "Unknown",
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
      return res.end();
    }

    // --- PDF EXPORT ---
    else if (format === "pdf") {
      const doc = new PDFDocument({ margin: 34, size: "A4" });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=sales-report.pdf"
      );
      doc.pipe(res);

      doc
        .fontSize(20)
        .font("Helvetica-Bold")
        .text("Sales Report", { align: "center" });
      doc.moveDown(1);

      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("Summary", { underline: true });
      doc.moveDown(1);
      doc.font("Helvetica");
      doc.text(`Report Period: ${startDate || "All"} TO ${endDate || "All"}`);
      doc.text(`Total Delivered Products: ${totalOrders}`);
      doc.text(`Total Revenue: ${totalRevenue.toFixed(2)}`);
      doc.text(`Total Discount: ${totalDiscount.toFixed(2)}`);
      doc.text(`Coupon Discount: ${totalCouponDiscount.toFixed(2)}`);
      doc.text(`Average Order Value: ${averageOrderValue.toFixed(2)}`);
      doc.moveDown(1);

      doc.font("Helvetica-Bold").text("Payment Method Breakdown:");
      doc.font("Helvetica");
      Object.entries(paymentStats).forEach(([method, count]) => {
        doc.text(`• ${method}: ${count}`);
      });
      doc.moveDown(1);

      // keep your same table drawing code...
      const pageWidth = doc.page.width - 2 * doc.page.margins.left;
      const colWidths = [
        pageWidth * 0.12,
        pageWidth * 0.15,
        pageWidth * 0.18,
        pageWidth * 0.18,
        pageWidth * 0.08,
        pageWidth * 0.12,
        pageWidth * 0.07,
        pageWidth * 0.1,
      ];
      const startX = doc.page.margins.left;
      let startY = doc.y + 10;
      const rowHeight = 25;

      const headers = [
        "Date",
        "User",
        "Order ID",
        "Product",
        "Qty",
        "FinalAmount",
        "Discount",
        "Payment",
      ];

      doc.font("Helvetica-Bold").fontSize(9);
      let x = startX;
      headers.forEach((header, i) => {
        doc.rect(x, startY, colWidths[i], rowHeight).stroke();
        doc.text(header, x + 3, startY + 6, {
          width: colWidths[i] - 6,
          align: "center",
        });
        x += colWidths[i];
      });

      startY += rowHeight;
      doc.font("Helvetica").fontSize(8);

      const addRow = (row) => {
        let x = startX;
        row.forEach((text, i) => {
          doc.rect(x, startY, colWidths[i], rowHeight).stroke();
          doc.text(String(text), x + 3, startY + 6, {
            width: colWidths[i] - 6,
            align: i === 5 || i === 6 ? "right" : "left",
          });
          x += colWidths[i];
        });
        startY += rowHeight;
      };

      const checkPage = () => {
        if (startY + rowHeight > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          startY = doc.page.margins.top;
          x = startX;
          doc.font("Helvetica-Bold").fontSize(9);
          headers.forEach((header, i) => {
            doc.rect(x, startY, colWidths[i], rowHeight).stroke();
            doc.text(header, x + 3, startY + 6, {
              width: colWidths[i] - 6,
              align: "center",
            });
            x += colWidths[i];
          });
          startY += rowHeight;
          doc.font("Helvetica").fontSize(9);
        }
      };

      orders.forEach((order) => {
        checkPage();
        addRow([
          new Date(order.createdAt).toLocaleDateString(),
          order.user?.name || "N/A",
          order.orderId,
          order.product?.productName?.slice(0, 25) || "N/A",
          order.orderedItems.quantity,
          order.orderedItems.finalAmount || 0,
          order.orderedItems.couponDiscount || 0,
          order.paymentMethod || "Unknown",
        ]);
      });

      doc.end();
    }

    // Invalid format
    else {
      return res
        .status(400)
        .json({ success: false, message: "Invalid format type." });
    }
  } catch (error) {
    console.error("Error in salesReportDownload:", error);
    res
      .status(500)
      .json({ success: false, message: "Error generating report." });
  }
};

module.exports = {
  loadSalesReport,
  salesReportDownload,
};