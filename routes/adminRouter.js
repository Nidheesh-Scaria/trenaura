const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const adminAuth = require("../middleware/userAuth");
const customerController = require("../controllers/customerController");
const categoryController = require("../controllers/categoryController");
const multer = require("multer");
const storage = require("../helpers/multer");
const uploads = multer({ storage: storage });
const productController = require("../controllers/productController");



router.post("/login", adminController.login);
router.get("/logout", adminController.logout);
router.get("/login", adminController.loadLogin);
router.get("/dashboard", adminAuth.adminAuth, adminController.loadDashboard);

//category
router.post(
  "/addCategory",
  adminAuth.adminAuth,
  categoryController.addCategory
);
router.post(
  "/listCategory/:id",
  adminAuth.adminAuth,
  categoryController.listCategory
);
router.post(
  "/unlistCategory/:id",
  adminAuth.adminAuth,
  categoryController.unlistCategory
);
router.put(
  "/editCategory/:id",
  adminAuth.adminAuth,
  categoryController.editCategory
);
router.put(
  "/deleteCategory/:id",
  adminAuth.adminAuth,
  categoryController.deleteCategory
);
router.get("/category", adminAuth.adminAuth, categoryController.categoryInfo);

//customer
router.get("/users", adminAuth.adminAuth, customerController.customerInfo);

router.patch(
  "/customerBlock/:id",
  adminAuth.adminAuth,
  customerController.customerBlocked
);
router.patch(
  "/customerUnblock/:id",
  adminAuth.adminAuth,
  customerController.customerUnBlocked
);

//products management
// router.get('/products',adminAuth.adminAuth,productController.getProductAddPage)
// router.get('/addProducts',adminAuth.adminAuth,productController.getAddProducts)
// router.post('/addProducts',adminAuth.adminAuth,uploads.array("images",4),productController.addProducts)

router.get("/products", adminAuth.adminAuth, productController.getProductPage);
router.get("/addProducts",adminAuth.adminAuth,productController.getAddProducts);
router.post("/addProducts",adminAuth.adminAuth,storage.array("images", 4),productController.addProducts);
router.put("/editProducts/:id",adminAuth.adminAuth,productController.editProducts );
router.delete("/deleteProducts/:id", adminAuth.adminAuth, productController.deleteProducts);














module.exports = router;






  