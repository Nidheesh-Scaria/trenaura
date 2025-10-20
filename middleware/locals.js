// const Cart = require("../models/cartSchema");
// const Wishlist = require("../models/wishlistSchema");

// module.exports = async (req, res, next) => {
//   res.locals.JSONstringify = (obj) =>
//     JSON.stringify(obj)
//       .replace(/<\/script/g, "<\\/script")
//       .replace(/<!--/g, "<\\!--");

//   res.locals.isLoggedIn = req.session.isLoggedIn || false;
//   res.locals.user = req.session.user || null;

//   if (req.session.user) {
//     const userId = req.session.user;
//     const cart = await Cart.findOne({ userId }).lean();
//     const wishlist = await Wishlist.findOne({ userId }).lean();
//     res.locals.wishlistCount = wishlist?.products?.length || 0;
//     res.locals.cartLength = cart?.items?.length || 0;
//   } else {
//     console.error("Error in global middleware:");
//     res.locals.cartLength = 0;
//     res.locals.wishlistCount = 0;
//   }

//   next();
// };
const Cart = require("../models/cartSchema");
const Wishlist = require("../models/wishlistSchema");

module.exports = async (req, res, next) => {
  try {
    // Prevent XSS issues when embedding JSON
    res.locals.JSONstringify = (obj) =>
      JSON.stringify(obj)
        .replace(/<\/script/g, "<\\/script")
        .replace(/<!--/g, "<\\!--");

    // Common user info
    res.locals.isLoggedIn = req.session.isLoggedIn || false;
    res.locals.user = req.session.user || null;

    // Default values
    res.locals.cartLength = 0;
    res.locals.wishlistLength = 0;

    // Only fetch data if user is logged in
    if (req.session.user) {
      const userId = req.session.user._id || req.session.user; // support both cases

      // Fetch both cart & wishlist in parallel for speed
      const [cart, wishlist] = await Promise.all([
        Cart.findOne({ userId }).lean(),
        Wishlist.findOne({ userId }).lean(),
      ]);

      res.locals.cartLength = cart?.items?.length || 0;
      res.locals.wishlistCount = wishlist?.products?.length || 0;
    }
  } catch (error) {
    console.error("Error in global middleware:", error);
    res.locals.cartLength = 0;
    res.locals.wishlistCount = 0;
  }

  next();
};
