const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const adminAuth = require("../middleware/userAuth");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const multer = require("multer");
// const storage = require("../helpers/multer");
// const uploads = multer({ storage: storage }); 
const upload = require("../helpers/multer");
const productController = require("../controllers/admin/productController");
const brandController = require("../controllers/admin/brandController");
const orderController=require('../controllers/admin/orderController')
const couponController=require("../controllers/admin/couponController")
const salesReportController=require("../controllers/admin/salesReportController")



router.post("/login", adminController.login);
router.get("/logout", adminController.logout);
router.get("/login", adminController.loadLogin);
router.get("/dashboard", adminAuth.adminAuth, adminController.loadDashboard);

//category
router.post("/addCategory",adminAuth.adminAuth,categoryController.addCategory);
router.post("/listCategory/:id",adminAuth.adminAuth,categoryController.listCategory);
router.post("/unlistCategory/:id",adminAuth.adminAuth,categoryController.unlistCategory);
router.put("/editCategory/:id",adminAuth.adminAuth,categoryController.editCategory);
router.delete("/deleteCategory/:id",adminAuth.adminAuth,categoryController.deleteCategory);
router.get("/category", adminAuth.adminAuth, categoryController.categoryInfo);

//customer
router.get("/users", adminAuth.adminAuth, customerController.customerInfo);
router.patch("/customerBlock/:id",adminAuth.adminAuth,customerController.customerBlocked);
router.patch("/customerUnblock/:id",adminAuth.adminAuth,customerController.customerUnBlocked);

//products
router.get("/products", adminAuth.adminAuth, productController.getProductPage);
router.get("/addProducts",adminAuth.adminAuth,productController.getAddProducts);
router.post("/addProducts",adminAuth.adminAuth,upload.array("images", 4),productController.addProducts);
router.get("/editProducts/:id", adminAuth.adminAuth, productController.getEditProduct);
router.post("/editProducts/:id",upload.array('images'),adminAuth.adminAuth,productController.editProducts );
router.delete("/deleteProducts/:id", adminAuth.adminAuth, productController.deleteProducts);

//brand
router.get("/brand", adminAuth.adminAuth,brandController.getBrandPage);
router.post("/addBrand", adminAuth.adminAuth,brandController.addBrandPage);
router.put("/editBrand/:id",adminAuth.adminAuth,brandController.editBrand );
router.delete("/deleteBrand/:id",adminAuth.adminAuth,brandController.deleteBrand );
router.post("/unblockBrand/:id", adminAuth.adminAuth,brandController.unblockBrand);
router.post("/blockBrand/:id", adminAuth.adminAuth,brandController.blockBrand);




//order management

router.get('/order',adminAuth.adminAuth,orderController.loadOrder)
router.get('/orderMangement/:id',adminAuth.adminAuth,orderController.orderMangement) 
router.post('/changeOrderStatus/:id',adminAuth.adminAuth,orderController.changeOrderStatus)
router.post('/changePyamentStatus/:id',adminAuth.adminAuth,orderController.changePyamentStatus)
router.get("/reviewReturn/:id",adminAuth.adminAuth,orderController.loadReviewReturn)
router.post("/changeReturnStatus/:id",adminAuth.adminAuth,orderController.changeReturnStatus)
router.get("/return-or-refund",adminAuth.adminAuth,orderController.loadReturnOrRefund)
router.post("/initiateRefund/:id",adminAuth.adminAuth,orderController.initiateRefund)


// coupon manangement
router.get('/coupon',adminAuth.adminAuth,couponController.loadCoupon)
router.post("/createCoupon",adminAuth.adminAuth,couponController.createCoupon)
router.put("/editCoupon/:id",adminAuth.adminAuth,couponController.editCoupon)
router.delete("/deleteCoupon/:id",adminAuth.adminAuth,couponController.deleteCoupon)

//sales report
router.get("/salesReport",adminAuth.adminAuth,salesReportController.loadSalesReport)
router.post("/sales-report/download",adminAuth.adminAuth,salesReportController.salesReportDownload)












module.exports = router;






  