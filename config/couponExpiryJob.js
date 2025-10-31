const Coupon = require("../models/couponSchema");
const cron = require("node-cron");

// * * * * -for every minute
cron.schedule("0 0 * * *", async () => {
  try {
    const now = new Date();
    const result = await Coupon.updateMany(
      { expiryDate: { $lt: now }, isActive: true },
      { $set: { isActive: false } }
    );

    if (result.modifiedCount > 0) {
      console.log(`[CRON] ${result.modifiedCount} expired coupons were deactivated.`);
    } else {
      console.log("[CRON] No expired coupons found today.");
    }

  } catch (error) {
     console.error("[CRON ERROR] Failed to deactivate expired coupons:", error);
  }
});

console.log("[CRON] Coupon expiry checker scheduled successfully");

