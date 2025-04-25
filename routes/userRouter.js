const express=require('express')
const router=express.Router()
const userController=require('../controllers/userController')
const userAuth=require('../middleware/userAuth')
const passport = require('passport')


router.post('/signup',userController.signup)
router.post('/login',userController.login)
router.post("/verifyOtp", userController.veryfySignupOtp)
router.post("/resendOtp", userController.resendSignupOtp)



router.get('/',userAuth.checkSession,userController.loadHomepage)
router.get('/login',userAuth.isLoggin,userController.loadLogin)
router.get('/signup',userAuth.isLoggin,userController.loadSignup)
router.get('/veryfyOtp',userAuth.isLoggin,userController.veryfyOtp)
router.get('/pageNotFound',userController.pageNotFound)


router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}))
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    res,redirect('/')
})

module.exports=router