const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const userAuth = require("../middleware/userAuth");
const passport = require("passport");




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
router.get('/productDetails',userAuth.userBlocked, userController.productDetails)

//profile info
router.get("/myAccount",userAuth.userBlocked,userAuth.checkSession, userController.loadmyAccount);
router.put('/profileInfo/:id',userAuth.checkSession,userController.editProfileInfo)


router.get('/forgotPassword',userAuth.isLoggedIn,userController.forgotPassword);
router.post("/forgotPasswordVerifyOtp", userAuth.isLoggedIn, userController.forgotPasswordOtp);
router.post('/verifyForgotPasswordOtp',userController.verifyForgotPasswordOtp)
router.get('/change-password',userAuth.isLoggedIn,userController.loadForgotPassword)
router.post('/changePassword',userController.changePassword)
router.post('/resendPswrdOtp',userController.resendPswrdOtp)


router.get('/mensCategory',userAuth.userBlocked,userController.mensCategory);
router.get('/womensCategory',userAuth.userBlocked,userController.womensCategory);
router.get('/beautyCategory',userAuth.userBlocked,userController.beautyCategory);
router.get('/filter',userAuth.userBlocked,userController.filter);


// adreess mangement
router.get('/manageAddress',userAuth.userBlocked,userAuth.checkSession, userController.loadmyAddress)
router.post('/addAddress/:id',userAuth.checkSession,userController.addAddress)
router.get('/editAddress/:id',userAuth.userBlocked,userAuth.checkSession, userController.loadEditAddress)
router.put('/submitEditAddress/:id',userAuth.userBlocked,userAuth.checkSession, userController.editAddress)
router.delete('/deleteAddress/:id',userAuth.userBlocked,userAuth.checkSession, userController.deleteAddress)


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
router.post('/addToCart/:id',userAuth.userBlocked,userAuth.checkSession, userController.addToCart)
router.post('/addToCarts/:id',userAuth.userBlocked,userAuth.checkSession, userController.addToCart)
router.get('/loadcartPage',userAuth.userBlocked,userAuth.checkSession, userController.loadmyCart)
router.patch('/increaseQuantity/:id',userAuth.userBlocked,userAuth.checkSession, userController.increaseQuantity)
router.patch('/decreaseQuantity/:id',userAuth.userBlocked,userAuth.checkSession, userController.decreaseQuantity)
router.delete("/removefromCart/:id",userAuth.userBlocked,userAuth.checkSession, userController.removefromCart)

//wishlist management

router.get('/loadWishlist',userAuth.userBlocked,userAuth.checkSession, userController.loadWishlist)













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
