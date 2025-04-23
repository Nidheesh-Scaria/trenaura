const express=require('express')
const router=express.Router()
const userController=require('../controllers/userController')
const userAuth=require('../middleware/userAuth')


router.post('/signup',userController.signup)

router.post('/login',userController.login)



router.get('/',userAuth.checkSession,userController.loadHomepage)
router.get('/login',userAuth.isLoggin,userController.loadLogin)
router.get('/signup',userAuth.isLoggin,userController.loadSignup)
router.get('/pageNotFound',userController.pageNotFound)



module.exports=router