const userSchema = require("../models/userSchema");
const { MESSAGES } = require("../util/constants");
const httpStatus = require("../util/statusCodes");



const customerInfo = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 3;

    const query = {
      isAdmin: false,
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ],
    };

    const userData = await userSchema
      .find(query)
      .select("name email phone createdOn isBlocked")
      .limit(limit)
      .sort({ createdOn: -1 })
      .skip((page - 1) * limit)
      .lean()
      .exec();

    const customers = userData.map((user,index) => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || "N/A",
      createdOn: user.createdOn
        ? new Date(user.createdOn).toISOString().split("T")[0]
        : "N/A",
      status: user.isBlocked ? "blocked" : "active",
      isBlocked: user.isBlocked,
      serialNumber: (page - 1) * limit + index + 1 
    }));

    const count = await userSchema.countDocuments(query);

    res.render("admin/customers", {
      hideHeader: true,
      hideFooter: true,
      customers: customers,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      search: search,
    });
    
  } catch (error) {
    console.error(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send(MESSAGES.INTERNAL_SERVER_ERROR|| "Internal Server Error");
  }
};

const customerBlocked = async (req, res) => {
  try {
    const id = req.params.id;
    await userSchema.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.status(httpStatus.OK).json({ success: true });
  } catch (error) {
    console.error("Block error:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false });
  }
};

const customerUnBlocked = async (req, res) => {
  try {
    const id = req.params.id;
    await userSchema.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.status(httpStatus.OK).json({ success: true });
  } catch (error) {
    console.error("Unblock error:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false });
  }
};

module.exports = {
  customerInfo,
  customerBlocked,
  customerUnBlocked,
};
