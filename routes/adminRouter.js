
const express = require('express');
const router = express.Router();
const adminController=require('../controllers/adminController');
const { route } = require('./userRouter');


router.post('/login',adminController.login)


router.get('/login',adminController.loadLogin)
router.get('/dashboard',adminController.loadDashboard)




module.exports=router


