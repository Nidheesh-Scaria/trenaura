const express=require('express')
const router=express.Router()
const userController=require('../controllers/userController')


router.get('/',userController.loadHomepage)
router.get('/login',userController.loadLogin)
router.get('/pageNotFound',userController.pageNotFound)


module.exports=router