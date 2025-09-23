const Cart = require("../models/cartSchema");

module.exports = async (req, res, next) => {
  res.locals.JSONstringify = (obj) =>
    JSON.stringify(obj).replace(/<\/script/g, "<\\/script").replace(/<!--/g, "<\\!--");

  res.locals.isLoggedIn = req.session.isLoggedIn || false;
  res.locals.user = req.session.user || null;

  if (req.session.user) {
    const cart = await Cart.findOne({ userId: req.session.user }).lean();
    res.locals.cartLength = cart?.items?.length || 0;
  } else {
    res.locals.cartLength = 0;
  }

  next();
};
