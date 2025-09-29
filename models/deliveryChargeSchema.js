const mongoose = require("mongoose");
const { Schema } = mongoose;

const deliveryChargeSchema = new Schema({
  type: {
    type: String,
    enum: ["fixed", "location"],
    required: true,
  },
  fixedCharge: {
    type: Number,
    default: 0,
  },
  // locationCharges: [
  //   {
  //     location: { type: String, required: true },
  //     charge: { type: Number, required: true },
  //   },
  // ],
  freeDeliveryAbove: {
    type: Number,
    default: 2000,
  },
});

const DeliveryCharge = mongoose.model("DeliveryCharge", deliveryChargeSchema);
module.exports = DeliveryCharge;
