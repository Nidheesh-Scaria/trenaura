const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
// const { route } = require('./userRouter');
const adminAuth = require("../middleware/userAuth");
const customerController=require('../controllers/customerController')


router.post("/login", adminController.login);


router.get("/logout", adminController.logout);
router.get("/login", adminController.loadLogin);
router.get("/dashboard", adminAuth.adminAuth, adminController.loadDashboard);
router.get('/users',adminAuth.adminAuth,customerController.customerInfo)
router.patch('/customerBlock/:id',adminAuth.adminAuth,customerController.customerBlocked)
router.patch('/customerUnblock/:id',adminAuth.adminAuth,customerController.customerUnBlocked)



module.exports = router;
