const Order = require("../../models/orderSchema");
const ExcelJS = require("exceljs");

const httpStatus = require("../../util/statusCodes");
const { MESSAGES } = require("../../util/constants");

const getTopProducts = async (startDate, endDate) => {
  return await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
      },
    },
    { $unwind: "$orderedItems" },
    {
      $group: {
        _id: "$orderedItems.productId",
        totalQuantity: { $sum: "$orderedItems.quantity" },
        totalPrice: { $sum: "$orderedItems.totalPrice" },
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    {
      $project: {
        _id: 0,
        productName: "$product.productName",
        totalQuantity: 1,
        totalPrice: 1,
      },
    },
    { $sort: { totalQuantity: -1, totalPrice: -1 } },
    { $limit: 10 },
  ]);
};

const getTopCategories = async (startDate, endDate) => {
  return await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
      },
    },
    { $unwind: "$orderedItems" },
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
      $group: {
        _id: "$product.category",
        totalQuantity: { $sum: "$orderedItems.quantity" },
      },
    },
    {
      $lookup: {
        from: "categories",
        localField: "_id",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: "$category" },
    {
      $project: {
        _id: 0,
        categoryName: "$category.name",
        totalQuantity: 1,
      },
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: 10 },
  ]);
};

const getTopBrands = async (startDate, endDate) => {
  return await Order.aggregate([
    // Filtering orders with date
    {
      $match: {
        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
      },
    },
    { $unwind: "$orderedItems" },
    // joining product details
    {
      $lookup: {
        from: "products",
        localField: "orderedItems.productId",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    //group bt brand
    {
      $group: {
        _id: "$product.brand",
        totalQuantity: { $sum: "$orderedItems.quantity" },
      },
    },
    //joining brand collection
    {
      $lookup: {
        from: "brands",
        localField: "_id",
        foreignField: "_id",
        as: "brand",
      },
    },
    { $unwind: "$brand" },
    //getting brand name
    {
      $project: {
        _id: 0,
        brandName: "$brand.brandName",
        totalQuantity: 1,
      },
    },
    //sorting
    { $sort: { totalQuantity: -1 } },
    { $limit: 10 },
  ]);
};

const getSalesOverview = async (startDate, endDate) => {
  return await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
      },
    },
    { $unwind: "$orderedItems" },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        totalSales: {
          $sum: {
            $multiply: ["$orderedItems.totalPrice", "$orderedItems.quantity"],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

const dailySalesCount = async () => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  //daily sales createdAt: { $gte: startOfDay, $lte: endOfDay
  let dailySales = await Order.aggregate([
    {
      $match: { createdAt: { $gte: startOfDay, $lte: endOfDay } },
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalPrice: { $sum: "$totalPrice" },
      },
    },
  ]);

  return (dailySales = dailySales[0] || { totalOrders: 0, totalPrice: 0 });
};

const monthlySalesCount = async () => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const endOfMonth = new Date();
  // endOfMonth.setMonth(11, 31);
  endOfMonth.setMonth(endOfMonth.getMonth() + 1, 0);
  endOfMonth.setHours(23, 59, 59, 999);

  let monthlySales = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      },
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalPrice: { $sum: "$totalPrice" },
      },
    },
  ]);

  return (monthlySales = monthlySales[0] || { totalOrders: 0, totalPrice: 0 });
};

const cancelledItemsCount = async () => {
  let cancelledItems = await Order.aggregate([
    { $unwind: "$orderedItems" },
    {
      $addFields: {
        latestStatus: {
          $arrayElemAt: ["$orderedItems.statusHistory.status", -1],
        },
      },
    },
    { $match: { latestStatus: "Cancelled" } },
    {
      $group: {
        _id: null,
        totalCancelledItems: { $sum: 1 },
      },
    },
  ]);

  return (cancelledItems = cancelledItems[0] || { totalCancelledItems: 0 });
};

const returnedItemsCount = async () => {
  let returnedItems =await Order.aggregate([
    { $unwind: "$orderedItems" },
    {
      $addFields: {
        latestStatus: {
          $arrayElemAt: ["$orderedItems.statusHistory.status", -1],
        },
      },
    },
    { $match: { latestStatus: "Returned" } },
    {
      $group: {
        _id: null,
        totalReturnedItems: { $sum: 1 },
      },
    },
  ]);
  return (returnedItems = returnedItems[0] || { totalReturnedItems: 0 });
};

const loadDashboard = async (req, res) => {
  try {
    return res.render("admin/dashboard", {
      title: "Admin Dashboard - Trenaura",
      hideHeader: true,
      hideFooter: true,
      adminHeader: false,
    });
  } catch (error) {
    console.error("Error rendering dashboard:", error);
    return res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.INTERNAL_SERVER_ERROR });
  }
};

const getDashboardData = async (req, res) => {
  try {
    const now = new Date();
    let { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      const now = new Date();
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    } else {
      startDate = new Date(startDate);
      endDate = new Date(endDate);
      endDate.setHours(23, 59, 59, 999);
    }

    //getting data
    let dailySales = await dailySalesCount();
    let monthlySales = await monthlySalesCount();
    let cancelledItems = await cancelledItemsCount();
    let returnedItems = await returnedItemsCount();

    //getting chart data
    const topProducts = await getTopProducts(startDate, endDate);
    const topCatgories = await getTopCategories(startDate, endDate);
    const topBrands = await getTopBrands(startDate, endDate);
    const salesOverview = await getSalesOverview(startDate, endDate);


    
    return res.status(httpStatus.OK).json({
      success: true,
      dailySales,
      monthlySales,
      cancelledItems,
      returnedItems,
      topProducts: {
        labels: topProducts.map((l) => l.productName),
        data: topProducts.map((d) => d.totalQuantity),
        price: topProducts.map((p) => p.totalPrice),
      },
      topCatgories: {
        labels: topCatgories.map((l) => l.categoryName),
        data: topCatgories.map((d) => d.totalQuantity),
      },
      topBrands: {
        labels: topBrands.map((l) => l.brandName),
        data: topBrands.map((d) => d.totalQuantity),
      },
      salesOverview: {
        labels: salesOverview.map((l) => l._id),
        data: salesOverview.map((d) => d.totalSales),
      },
    });
  } catch (error) {
    console.error("Error in getDashboardData:", error);
    return res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGES.INTERNAL_SERVER_ERROR });
  }
};

const downloadLedger = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ message: "Start date and end date are required" });
    }

    const orders = await Order.find({
      createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
    })
      .populate("userId", "name email")
      .populate({
        path: "orderedItems.productId",
        select: "productName brand category",
        populate: [
          { path: "brand", select: "brandName" },
          { path: "category", select: "name" },
        ],
      });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Ledger");

    worksheet.columns = [
      { header: "Date", key: "date", width: 15 },
      { header: "Order ID", key: "orderId", width: 20 },
      { header: "Customer", key: "customer", width: 25 },
      { header: "Product", key: "product", width: 25 },
      { header: "Category", key: "category", width: 20 },
      { header: "Brand", key: "brand", width: 20 },
      { header: "Quantity", key: "quantity", width: 10 },
      { header: "Price", key: "price", width: 15 },
      { header: "Total", key: "total", width: 15 },
      { header: "Payment Method", key: "payment", width: 20 },
    ];

    orders.forEach((order) => {
      order.orderedItems.forEach((item) => {
        worksheet.addRow({
          date: order.createdAt.toISOString().split("T")[0],
          orderId: order.orderId,
          customer: order.userId ? order.userId.name : "Guest",
          product: item.productId
            ? item.productId.productName
            : "Unknown product",
          category: item.productId?.category?.name || "Unknown category",
          brand: item.productId?.brand?.brandName || "Unknown brand",
          quantity: item.quantity || 0,
          price: item.price || 0,
          total: item.price * item.quantity,
          payment: order.paymentMethod || "N/A",
        });
      });
    });

    //set headers

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Ledger_${startDate}_to_${endDate}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Ledger Download Error:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false });
  }
};

module.exports = {
  loadDashboard,
  downloadLedger,
  getDashboardData,
};
