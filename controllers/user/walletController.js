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

//wallet management

const getMyWallet = async (req, res) => {
  try {
    const userId = req.session.user;

    const wallet = await Wallet.findOne({ userId }).lean();

    return res.render("user/myWallet", {
      title: "Trenaura wallet",
      adminHeader: true,
      wallet,
    });
  } catch (error) {
    console.error("Error in cancelOrder :", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

const walletTransactionHistory = async (req, res) => {
  try {
    console.log("reached walletTransactionHistory");
    const userId = req.session.user;
    let emptyWallet=false;

    const wallet = await Wallet.findOne({ userId }).lean();

    if(!wallet){
      return res.render("user/walletTranscations", {
      title: "Trenaura wallet-transactions",
      adminHeader: true,
      wallet,
      emptyWallet:true,
    });
    }

    const transactions = wallet.transactions;

    const sortedTransactionHistory = transactions.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    const transactionHistory = sortedTransactionHistory.map((transaction) => ({
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      transactionId: transaction.transactionId,
      date: new Date(transaction.createdAt).toLocaleString(),
    }));

    console.log("sorted wallet Transaction History", sortedTransactionHistory);

    return res.render("user/walletTranscations", {
      title: "Trenaura wallet-transactions",
      adminHeader: true,
      wallet,
      transactionHistory,
      emptyWallet
    });
  } catch (error) {
    console.error("Error in walletTransactionHistory :", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        MESSAGES.INTERNAL_SERVER_ERROR ||
        "An error occurred. Please try again later.",
    });
  }
};

const createRazorpayOrderWallet = async (req, res) => {
  try {
    console.log("createRazorpayOrder reached");
    const userId = req.session.user;
    const { amount } = req.body;

    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: crypto.randomUUID(),
    };

    const razorpayOrder = await razorpayInstance.orders.create(options);

    const razorpayOrderId = razorpayOrder.id;

    const razorOrder = new WalletTopupOrder({
      userId,
      razorpayOrderId,
      amount,
      status: "created",
    });

    await razorOrder.save();

    res.json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      orderId: razorpayOrderId,
      amount,
      currency: "INR",
    });
  } catch (error) {
    console.error("Error creating Razorpay order-wallet:", error);
    res.status(httpStatus.OK).json({
      success: false,
      message: MESSAGES.INTERNAL_SERVER_ERROR || "Something went wrong ",
    });
  }
};

const verifyPaymentForWallet = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    let updatedWallet;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ success: false, message: "Invalid payment signature" });
    }

    const topupOrder = await WalletTopupOrder.findOne({
      razorpayOrderId: razorpay_order_id,
    });

    if (!topupOrder) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ success: false, message: "No topup order found" });
    }
    if (topupOrder.status === "paid") {
      return res
        .status(httpStatus.OK)
        .json({ success: true, message: "Payment already verified" });
    }

    const { amount, userId } = topupOrder;

    const wallet = await Wallet.findOne({ userId });

    if (wallet) {
      updatedWallet = await Wallet.findOneAndUpdate(
        { userId },
        {
          $inc: { balance: amount },
          $push: {
            transactions: {
              orderId: topupOrder._id,
              type: "credit",
              amount,
              description: "Wallet top-up via Razorpay",
            },
          },
        },
        { new: true }
      );
    } else {
      updatedWallet = new Wallet({
        userId,
        balance: amount,
        transactions: [
          {
            orderId: topupOrder._id,
            type: "credit",
            amount,
            description: "Wallet created with Razorpay credit",
          },
        ],
      });
      await updatedWallet.save();
    }

    topupOrder.status = "paid";
    await topupOrder.save();

    const balance = updatedWallet.balance;

    return res.status(httpStatus.OK).json({
      success: true,
      message: "Amount added to wallet ",
      balance,
    });
  } catch (error) {
    console.error("Error verifying Razorpay payment-wallet:", error);
    res.status(httpStatus.OK).json({
      success: false,
      message: MESSAGES.INTERNAL_SERVER_ERROR || "Something went wrong ",
    });
  }
};

module.exports = {
  getMyWallet,
  createRazorpayOrderWallet,
  verifyPaymentForWallet,
  walletTransactionHistory,
};
