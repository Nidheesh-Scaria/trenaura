const DeliveryChargeSchema = require("../../models/deliveryChargeSchema");
const { MESSAGES } = require("../../util/constants");
const httpStatus = require("../../util/statusCodes");

const loadSettings = async (req, res) => {
  try {
    const deliveryCharge = await DeliveryChargeSchema.findOne().lean();
    return res.render("admin/settings", {
      hideHeader: true,
      hideFooter: true,
      deliveryCharge,
    });
  } catch (error) {
    console.error("loadSettings error", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Internal Server Error");
  }
};

const setDeliveryCharge = async (req, res) => {
  try {
    let { type, fixedCharge, freeAbove } = req.body;

    // Basic validation
    if (!type || !fixedCharge || !freeAbove) {
      return res.status(400).json({
        success: false,
        message: "Fill all the fields",
      });
    }

    // Upsert delivery charge
    const deliveryCharge = await DeliveryChargeSchema.findOneAndUpdate(
      {},
      {
        type,
        fixedCharge: Number(fixedCharge) || 0,
        freeAbove: Number(freeAbove) || 0,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "Delivery charges updated",
      deliveryCharge,
    });
  } catch (error) {
    console.error("setDeliveryCharge error", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: MESSAGES.INTERNAL_SERVER_ERROR || "Internal Server Error",
      });
  }
};

module.exports = {
  loadSettings,
  setDeliveryCharge,
};
