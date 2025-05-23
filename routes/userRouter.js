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



router.get("/",userController.loadHomepage);
router.get("/login", userAuth.isLoggedIn, userController.loadLogin);
router.get("/signup", userAuth.isLoggedIn, userController.loadSignup);
router.get("/verifyOtp", userAuth.isLoggedIn, userController.verifyOtp);
router.get("/pageNotFound", userController.pageNotFound);
router.get("/myAccount",userAuth.checkSession, userController.loadmyAccount);
router.get("/logout", userAuth.isLoggedIn, userController.loadLogout);
router.get('/productDetails', userController.productDetails)



router.get('/forgotPassword',userAuth.isLoggedIn,userController.forgotPassword);
router.post("/forgotPasswordVerifyOtp", userAuth.isLoggedIn, userController.forgotPasswordOtp);
router.post('/verifyForgotPasswordOtp',userController.verifyForgotPasswordOtp)
router.get('/change-password',userAuth.isLoggedIn,userController.loadForgotPassword)
router.post('/changePassword',userController.changePassword)
router.post('/resendPswrdOtp',userController.resendPswrdOtp)


router.get('/mensCategory',userController.mensCategory);
router.get('/womensCategory',userController.womensCategory);
router.get('/beautyCategory',userController.beautyCategory);
router.get('/filter',userController.filter);





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
    res.redirect("/");
  }
);



module.exports = router;
