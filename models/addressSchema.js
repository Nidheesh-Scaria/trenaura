const mongoose = require("mongoose");
const { Schema } = mongoose;

const addressSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  address: [
    {
      addressType: {
        type: String,
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
      address: {
        type: String,
        required: true,
      },
      pincode: {
        type: Number,
        required: true,
      },
      locality: {
        type: String,
        required: true,
      },

      phone: {
        type: Number,
        required: true,
      },
      altPhone: {
        type: Number,
        required: false,
      },
      landMark: {
        type: String,
        required: false,
      },
      selected: {
        type: Boolean,
        default: false,
      },
    },
  ],
});

const Address = mongoose.model("Address", addressSchema);

module.exports = Address;
