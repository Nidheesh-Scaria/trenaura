const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const adminAuth = require("../middleware/userAuth");
const customerController = require("../controllers/customerController");
const categoryController = require("../controllers/categoryController");
const multer = require("multer");
// const storage = require("../helpers/multer");
// const uploads = multer({ storage: storage }); 
const upload = require("../helpers/multer");
const productController = require("../controllers/productController");
const brandController = require("../controllers/brandController");



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


router.get("/products", adminAuth.adminAuth, productController.getProductPage);
router.get("/addProducts",adminAuth.adminAuth,productController.getAddProducts);
router.post("/addProducts",adminAuth.adminAuth,upload.array("images", 4),productController.addProducts);

router.get("/editProducts/:id", adminAuth.adminAuth, productController.getEditProduct);
router.post("/editProducts/:id",upload.array('images'),adminAuth.adminAuth,productController.editProducts );
router.delete("/deleteProducts/:id", adminAuth.adminAuth, productController.deleteProducts);


router.get("/brand", adminAuth.adminAuth,brandController.getBrandPage);
router.post("/addBrand", adminAuth.adminAuth,brandController.addBrandPage);
router.put("/editBrand/:id",adminAuth.adminAuth,brandController.editBrand );
router.delete("/deleteBrand/:id",adminAuth.adminAuth,brandController.deleteBrand );
router.post("/unblockBrand/:id", adminAuth.adminAuth,brandController.unblockBrand);
router.post("/blockBrand/:id", adminAuth.adminAuth,brandController.blockBrand);












module.exports = router;






  