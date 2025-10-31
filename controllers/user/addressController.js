const userSchema = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const Wishlist = require("../../models/wishlistSchema");
const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");
const WalletTopupOrder = require("../../models/walletTopupOrderSchema ");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const nodeMailer = require("nodemailer");
const { isLoggedIn } = require("../../middleware/userAuth");
const env = require("dotenv").config();
const httpStatus = require("../../util/statusCodes");
const { MESSAGES } = require("../../util/constants");
const { default: mongoose } = require("mongoose");
const razorpay = require("../../config/razorpay");
const razorpayInstance = require("../../config/razorpay");
const crypto = require("crypto");

const GOOGLEMAP_API_KEY = process.env.GOOGLE_MAP_KEY;

//address management
const loadmyAddress = async (req, res) => {
  try {
    const userId = req.session.user || req.user;

    const user = await userSchema.findById(userId);

    const userAddresses = await Address.findOne(
      { userId },
      {
        address: {
          $filter: {
            input: "$address",
            as: "addr",
            cond: { $eq: ["$$addr.isDeleted", false] },
          },
        },
      }
    );
    


    const addresses = userAddresses ? userAddresses.address : [];
    // Converting Mongoose documents to plain objects
    const plainAddresses = addresses.map((address) =>
      address.toObject ? address.toObject() : address
    );

    res.render("user/addressManage", {
      title: "Address management",
      adminHeader: true,
      name: user.name,
      user,
      addresses: plainAddresses,
      userId: user._id,
    });
  } catch (error) {
    console.error("Error in rendering address management:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const addAddress = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    const {
      addressType,
      name,
      locality,
      address,
      cityOrTown,
      state: selectedState,
      pincode,
      phone,
      altPhone,
      landmark,
    } = req.body;

    if (
      !name ||
      !phone ||
      !pincode ||
      !address ||
      !selectedState ||
      !addressType ||
      !locality ||
      !cityOrTown
    ) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ message: MESSAGES.ADD_ADDRESS.MISSING_FIELDS });
    }

    const newAddress = {
      addressType,
      name,
      locality,
      address,
      city: cityOrTown,
      landMark: landmark,
      state: selectedState,
      pincode: Number(pincode),
      phone: Number(phone),
      altPhone: altPhone ? Number(altPhone) : undefined,
      selected: true,
    };

    //getting address of particular user
    const userAddress = await Address.findOne({ userId });

    if (userAddress) {
      userAddress.address.push(newAddress);
      await userAddress.save();
    } else {
      await Address.create({ userId, address: [newAddress] });
    }

    return res
      .status(httpStatus.OK)
      .json({ message: MESSAGES.ADD_ADDRESS.SUCCESS || "Address added" });
  } catch (error) {
    console.error("Error in rendering product info:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const loadEditAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.session.user || req.user;

    //getting address of particular user
    const userAddresses = await Address.findOne({ userId });

    if (!userAddresses) {
      return res.status(httpStatus.NOT_FOUND).json({
        message: MESSAGES.ADD_ADDRESS.ADDRESS_NOT_FOUND || "No address found",
      });
    }

    const address = userAddresses.address.find(
      (addr) => addr._id.toString() === addressId
    );

    if (!address) {
      return res.status(httpStatus.NOT_FOUND).json({
        message: MESSAGES.ADD_ADDRESS.ADDRESS_NOT_FOUND || "Address not found",
      });
    }

    res.status(httpStatus.OK).json(address);
  } catch (error) {
    console.error("Error in loading edit address:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const editAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.session.user || req.user;

    const {
      addressType,
      name,
      locality,
      address,
      city,
      state,
      pincode,
      phone,
      altPhone,
      landMark,
    } = req.body;

    // Validation
    if (
      !name ||
      !phone ||
      !pincode ||
      !address ||
      !state ||
      !addressType ||
      !locality ||
      !city
    ) {
      return res.status(httpStatus.BAD_REQUEST).json({
        message: MESSAGES.FILL_ALL_FIELDS || "Fill all required fields",
      });
    }

    // Find the user's address document
    const userAddresses = await Address.findOne({ userId });

    if (!userAddresses) {
      return res.status(httpStatus.NOT_FOUND).json({
        message: MESSAGES.ADD_ADDRESS.ADDRESS_NOT_FOUND || "No addresses found",
      });
    }

    const isAddress = await Address.findOne({ "address._id": addressId });
    const result = isAddress.address.find(
      (addr) => addr._id.toString() === addressId
    );
    // Find and update the specific address
    const addressIndex = userAddresses.address.findIndex(
      (addr) => addr._id.toString() === addressId
    );

    if (addressIndex === -1) {
      return res.status(httpStatus.NOT_FOUND).json({
        message: MESSAGES.ADD_ADDRESS.ADDRESS_NOT_FOUND || "Address not found",
      });
    }

    // Update the address
    userAddresses.address[addressIndex] = {
      ...userAddresses.address[addressIndex],
      addressType,
      name,
      locality,
      address,
      city,
      landMark,
      state,
      pincode: Number(pincode),
      phone: Number(phone),
      altPhone: altPhone ? Number(altPhone) : null,
    };

    //saving address
    await userAddresses.save();

    return res.status(httpStatus.OK).json({
      message: MESSAGES.EDIT_ADDRESS.SUCCESS || "Edited Successfully",
    });
  } catch (error) {
    console.error("Error in updating address:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const deleteAddress = async (req, res) => {
  try {
    const id = req.params.id;

    //removing address from array
    await Address.updateOne(
      { "address._id": id },
      { $set: { "address.$.isDeleted": true } }
    );
    res
      .status(httpStatus.OK)
      .json({ message: MESSAGES.EDIT_ADDRESS.DELETE_ADDRESS || "Deleted" });
  } catch (error) {
    console.error("Error in deleting address:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const getLocationDetails = async (req, res) => {
  try {
    const { pincode } = req.params;

    //setting url for accesing data from Goole API
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${pincode}&key=${GOOGLEMAP_API_KEY}`;

    const response = await fetch(url);
    //getting data
    const data = await response.json();

    const components = data.results[0].address_components;

    let locality, district, state;
    components.forEach((loc) => {
      if (loc.types.includes("administrative_area_level_1"))
        state = loc.long_name;
      if (loc.types.includes("administrative_area_level_3"))
        district = loc.long_name;
      if (loc.types.includes("locality")) locality = loc.long_name;
    });

    return res.json({ state, district, locality });
  } catch (error) {
    console.error("Error in fetching location details:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const getAddAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    return res.render("user/addAddress", {
      title: "Add Address",
      hideHeader: false,
      hideFooter: false,
      adminHeader: true,
      userId,
    });
  } catch (error) {
    console.error("Error in rendering add address:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

module.exports = {
  loadmyAddress,
  addAddress,
  loadEditAddress,
  editAddress,
  deleteAddress,
  getLocationDetails,
  getAddAddress,
};
