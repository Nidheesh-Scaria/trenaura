const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const userAuth = require("../middleware/userAuth");
const passport = require("passport");
const cartController=require("../controllers/user/cartController")
const wishlistController=require("../controllers/user/wishlistController")
const orderController=require("../controllers/user/orderController")
const walletController=require("../controllers/user/walletController")
const addressController=require("../controllers/user/addressController")
const couponController=require("../controllers/user/couponController")



router.post("/signup", userController.signup);
router.post("/login", userController.login);
router.post("/verifyOtp", userController.verifySignupOtp);
router.post("/resendOtp", userController.resendSignupOtp);
router.post("/logout", userController.logout);


router.get("/",userAuth.userBlocked,userController.loadHomepage);
router.get("/login", userAuth.isLoggedIn, userController.loadLogin);
router.get("/signup", userAuth.isLoggedIn, userController.loadSignup);
router.get("/verifyOtp", userAuth.isLoggedIn, userController.verifyOtp);
router.get("/pageNotFound", userController.pageNotFound);
router.get("/logout", userAuth.isLoggedIn, userController.loadLogout);




//profile info
router.get("/myAccount",userAuth.userBlocked,userAuth.checkSession, userController.loadmyAccount);
router.put('/profileInfo/:id',userAuth.checkSession,userController.editProfileInfo)


router.get('/forgotPassword',userAuth.isLoggedIn,userController.forgotPassword);
router.post("/forgotPasswordVerifyOtp", userAuth.isLoggedIn, userController.forgotPasswordOtp);
router.post('/verifyForgotPasswordOtp',userController.verifyForgotPasswordOtp)
router.get('/change-password',userAuth.isLoggedIn,userController.loadForgotPassword)
router.post('/changePassword',userController.changePassword)
router.post('/resendPswrdOtp',userController.resendPswrdOtp)

//product
router.get('/shop',userAuth.userBlocked,userController.loadShop)
router.get('/mensCategory',userAuth.userBlocked,userController.mensCategory);
router.get('/womensCategory',userAuth.userBlocked,userController.womensCategory);
router.get('/beautyCategory',userAuth.userBlocked,userController.beautyCategory);
//router.get('/filter',userAuth.userBlocked,userController.filter);
router.get('/productDetails',userAuth.userBlocked,userAuth.checkSession, userController.productDetails)


// adreess mangement
router.get('/manageAddress',userAuth.userBlocked,userAuth.checkSession, addressController.loadmyAddress)
router.post('/addAddress/:id',userAuth.userBlocked,userAuth.checkSession,addressController.addAddress)
router.get('/editAddress/:id',userAuth.userBlocked,userAuth.checkSession, addressController.loadEditAddress)
router.put('/submitEditAddress/:id',userAuth.userBlocked,userAuth.checkSession, addressController.editAddress)
router.delete('/deleteAddress/:id',userAuth.userBlocked,userAuth.checkSession, addressController.deleteAddress)


//changePassword
router.get('/changePassword',userAuth.userBlocked,userAuth.checkSession, userController.loadChangePassword)
router.post('/handleChangePassword',userAuth.userBlocked,userAuth.checkSession, userController.handleChangePassword)
router.get('/forgotPassword-changePswrd',userAuth.userBlocked,userAuth.checkSession, userController.renderForgotPasswordPage )
router.post('/renderForgotPasswordOtpPage',userAuth.userBlocked,userAuth.checkSession, userController.handleForgotPasswordOtpRequest )
router.post('/changePasswordVerifyOTP',userAuth.userBlocked,userAuth.checkSession,userController.changePasswordVerifyOTP)
router.get('/renderChange-password',userAuth.userBlocked,userAuth.checkSession, userController.renderChangePassword)
router.post('/submitChangedPassword',userAuth.userBlocked,userAuth.checkSession,userController.submitChangedPassword)
router.get('/verify-otp-page',userAuth.userBlocked,userAuth.checkSession,userController.renderVerifyOtpPage)


// add to cart
router.post('/addToCart/:id',userAuth.userBlocked,userAuth.checkSession, cartController.addToCart)
router.post('/addToCarts/:id',userAuth.userBlocked,userAuth.checkSession, cartController.addToCart)
router.get('/loadcartPage',userAuth.userBlocked,userAuth.checkSession, cartController.loadmyCart)
router.get('/renderMyCart',userAuth.userBlocked,userAuth.checkSession, cartController.renderMyCart)
router.patch('/increaseQuantity/:id',userAuth.userBlocked,userAuth.checkSession, cartController.increaseQuantity)
router.patch('/decreaseQuantity/:id',userAuth.userBlocked,userAuth.checkSession, cartController.decreaseQuantity)
router.delete("/removefromCart/:id",userAuth.userBlocked,userAuth.checkSession, cartController.removefromCart)
router.get('/cartOrderSummary',userAuth.userBlocked,userAuth.checkSession, cartController.cartOrderSummary)


//wishlist management
router.get('/loadWishlist',userAuth.userBlocked,userAuth.checkSession, wishlistController.loadWishlist)
router.post('/addWishlist/:id',userAuth.userBlocked,userAuth.checkSession, wishlistController.addWishlist)
router.delete('/removeFromWishlist/:id',userAuth.userBlocked,userAuth.checkSession, wishlistController.removeFromWishlist)


//order management
router.get('/loadMyOrder',userAuth.userBlocked,userAuth.checkSession, orderController.loadMyOrder)
router.get('/loadAddressForOrder',userAuth.userBlocked,userAuth.checkSession, orderController.loadAddressForOrder)
router.get('/loadAddressForOrder/:id',userAuth.userBlocked,userAuth.checkSession, orderController.loadAddressForOrder)
router.post('/submit-address',userAuth.userBlocked,userAuth.checkSession, orderController.submitAddress)

router.get("/orderSummary",userAuth.userBlocked,userAuth.checkSession, orderController.loadOrderSummary)


router.get('/loadPaymentMode',userAuth.userBlocked,userAuth.checkSession, orderController.loadPaymentMethod)
router.post('/orderSuccess',userAuth.userBlocked,userAuth.checkSession, orderController.orderSuccess)
router.get('/order-placed',userAuth.userBlocked,userAuth.checkSession, orderController.orderPlaced)
router.post('/cancelOrder/:id',userAuth.userBlocked,userAuth.checkSession, orderController.cancelOrder);
router.get('/orderDetails/:id',userAuth.userBlocked,userAuth.checkSession,orderController.orderDetails)
router.get('/loadReturnOrder/:id',userAuth.userBlocked,userAuth.checkSession,orderController.loadReturnOrder)
router.post('/returnOrder/:id',userAuth.userBlocked,userAuth.checkSession,orderController.returnOrder)
router.get('/orderPlaced',userAuth.userBlocked,userAuth.checkSession,orderController.getOrderPlaced)
//wallet payment
router.get("/walletPayment",userAuth.userBlocked,userAuth.checkSession, orderController.walletPayment)
router.post("/confirmWalletPayment",userAuth.userBlocked,userAuth.checkSession, orderController.confirmWalletPayment)

//payment mangement
router.post('/create-razorpay-order',userAuth.userBlocked,userAuth.checkSession,orderController.createRazorpayOrder)
router.post("/verify-payment",userAuth.userBlocked,userAuth.checkSession,orderController.verifyPayment)
router.get("/payment-failed",userAuth.userBlocked,userAuth.checkSession,orderController.failedPayment)



//wallet management
router.get('/myWallet',userAuth.userBlocked,userAuth.checkSession,walletController.getMyWallet)
router.get("/walletTransactionHistory",userAuth.userBlocked,userAuth.checkSession,walletController.walletTransactionHistory)
router.get('/walletPaymentFailed',userAuth.userBlocked,userAuth.checkSession,walletController.paymemntFailed)
//adding money in wallet
router.post("/create-razorpay-order-wallet",userAuth.userBlocked,userAuth.checkSession,walletController.createRazorpayOrderWallet)
router.post("/verify-payment-wallet",userAuth.userBlocked,userAuth.checkSession,walletController.verifyPaymentForWallet)


//coupon management
router.post("/applyCoupon",userAuth.userBlocked,userAuth.checkSession, cartController.applyCoupon)
router.post("/removeCoupon",userAuth.userBlocked,userAuth.checkSession, cartController.removeCoupon)
router.get('/myCoupons',userAuth.userBlocked,userAuth.checkSession, couponController.loadMyCoupon)












router.get("/auth/google", (req, res, next) => {
  if (req.isAuthenticated()) {
    // If the user is already authenticated, redirect them to profile
    return res.redirect("/");
  }
  // If not, proceed with Google login
  passport.authenticate("google", { scope: ["profile", "email"] ,prompt: "consent" })(req, res, next);
});

router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/signup" }),
  (req, res) => {
    req.session.isLoggedIn = true;
    req.session.user = req.user._id;
    res.redirect("/");
  }
);


module.exports = router;
