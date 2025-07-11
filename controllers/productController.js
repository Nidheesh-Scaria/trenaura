const Product = require("../models/productSchema");
const Category = require("../models/categorySchema");
const Brand = require("../models/brandSchema");
const fs = require("fs");
const path = require("path");
const userSchema = require("../models/userSchema");
const sharp = require("sharp");
const httpStatus = require('../util/statusCodes')
const {MESSAGES} = require('../util/constants')




const getProductPage = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 3;

    const query = {
      isBlocked: false,
      isDeleted: false,
      productName: { $regex: search, $options: "i" },
    };

    const productData = await Product.find(query)
      .select(
        "productName regularPrice salePrice category status isBlocked isDeleted productImages"
      )
      .populate("category", "name")
      .limit(limit)
      .sort({ createdOn: -1 })
      .skip((page - 1) * limit)
      .lean();

    const products = productData.map((product, index) => ({
      _id: product._id,
      productName: product.productName,
      salePrice: product.salePrice,
      regularPrice: product.regularPrice,
      category: product.category?.name || "Unknown",
      categoryId: product.category?._id || "",
      status: product.status,
      isBlocked: product.isBlocked,
      productImages: product.productImages || [], //image is passing
      firstImage: product.productImages?.[0] || null,
      serialNumber: (page - 1) * limit + index + 1, //to get serial number
    }));

    const count = await Product.countDocuments(query);
    const categories = await Category.find({ isListed: true })
      .select("_id name")
      .lean();

    res.render("admin/product", {
      hideHeader: true,
      hideFooter: true,
      products,
      categories,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      search,
    });
  } catch (error) {
    console.error(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send(MESSAGES.INTERNAL_SERVER_ERROR || "Internal Server Error");
  }
};

const getAddProducts = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true })
      .select("_id name")
      .lean();

    res.render("admin/product-add", {
      category,
      hideHeader: true,
      hideFooter: true,
    });
  } catch (error) {
    console.error(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send(MESSAGES.INTERNAL_SERVER_ERROR || "Internal Server Error");
  }
};

const getEditProduct = async (req, res) => {
  try {
    
    
    const productId = req.params.id;
    const product = await Product.findById(productId)
      .populate("category", "name _id")
      .lean();

    

    if (!product) {
      console.log("Product not found");
      return res
        .status(404)
        .json({ success: false, message: MESSAGES.PRODUCT_NOT_FOUND ||"PRODUCT NOT FOUND"});
    }

    const responseData = {
      success: true,
      product: {
        _id: product._id,
        productName: product.productName,
        regularPrice: product.regularPrice,
        salePrice: product.salePrice,
        category: product.category?._id,
        categoryName: product.category?.name,
        productImages: product.productImages || [],
      },
    };

    console.log("Sending response:", responseData);
    res.json(responseData);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: MESSAGES.INTERNAL_SERVER_ERROR || "internal server error"});
  }
};

const addProducts = async (req, res) => {

  try {
    const productData = req.body;
    
    if (
      !productData.productName ||
      !productData.description ||
      !productData.category
    ) {
      const missingFields = [];
      if (!productData.productName) missingFields.push("Product Name");
      if (!productData.description) missingFields.push("Description");
      if (!productData.category) missingFields.push("Category");
      
      
      return res
        .status(400)
        .json({ 
          success: false, 
          message: `${MESSAGES.MISSING_FIELDS}: ${missingFields.join(", ")}` || "missing fields"
        });
    }

    const productExists = await Product.findOne({
      productName: productData.productName,
    });

    if (productExists) {
      return res.status(400).json({
        success: false,
        message: MESSAGES.PRODUCT_EXISTS,
      });
    }

    //new image add code
   
    const images = [];
    if (req.files && req.files.length >= 3) {
      const bucket = req.app.locals.bucket;
      
      for (const file of req.files) {
        // console.log("File details:", {
        //   originalname: file.originalname,
        //   mimetype: file.mimetype,
        //   size: file.size,
        //   buffer: file.buffer ? 'Buffer present' : 'No buffer'
        // });
        
        const filename = `product-${Date.now()}-${file.originalname}`;
        
        const uploadStream = bucket.openUploadStream(filename, {
          contentType: "image/jpg",
        });
        try {
          await new Promise((resolve, reject) => {
            sharp(file.buffer)
              .resize({ width: 800, height: 800, fit: "cover" })
              .jpeg({ quality: 90 })
              .pipe(uploadStream)
              .on("error", reject)
              .on("finish", resolve);
          });
          images.push(filename);
          // console.log("Successfully uploaded:", filename);
        } catch (error) {
          console.log(`error uploading ${filename}:`, error);
        }
      }
    } else {
      
      return res.status(400).json({
        success: false,
        message: MESSAGES.UPLOAD_AT_LEAST_3_IMAGES || "Please upload at least 3 images",
      });
    }

    // Find category
    
    const category = await Category.findOne({ name: productData.category });
    console.log("Found category:", category);
    
    if (!category) {
      return res.status(400).json({
        success: false,
        message: MESSAGES.INVALID_CATEGORY || "Invalid category",
      });
    }

    // Create new product
    
    const newProduct = await Product.create({
      productName: productData.productName,
      description: productData.description,
      brand: productData.brand || undefined,
      category: category._id,
      regularPrice: productData.regularPrice,
      salePrice: productData.salePrice,
      quantity: productData.quantity,
      size: productData.size,
      color: productData.color,
      status: "Available",
      productImages: images,
    });
    
    console.log("Product created successfully:", newProduct._id);

    
    return res.status(200).json({
      success: true,
      message: MESSAGES.PRODUCT_ADDED_SUCCESS|| "Product added successfully"
    });
  } catch (error) {
    console.error("Error saving product:", error);

    // Clean up any uploaded files if error occurred
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          console.error("Error deleting uploaded file:", err);
        }
      });
    }

    console.log(error);
    return res.status(500).json({
      success: false,
      message: MESSAGES.PRODUCT_ADD_FAILED + error.message || "Failed to add product: "
    });
  }
};
//PRODUCT EDIT 
const editProducts = async (req, res) => {
  try {
    const id = req.params.id;
    const bucket = req.app.locals.bucket;

    const { productName, regularPrice, salePrice, category } = req.body;
    const deleteImages = Array.isArray(req.body.deleteImages)
      ? req.body.deleteImages
      : req.body.deleteImages
      ? [req.body.deleteImages]
      : [];

    const product = await Product.findById(id);
    if (!product) {
      return res
        .status(httpStatus.NOT_FOUND)
        .json({ success: false, message:MESSAGES.PRODUCT_NOT_FOUND ||"Product not found" });
    }

    // Deleting selected images
    for (const filename of deleteImages) {
      const file = await bucket.find({ filename }).toArray();
      if (file.length > 0) {
        await bucket.delete(file[0]._id);
      }
      product.productImages = product.productImages.filter(
        (img) => img !== filename
      );
    }

    // Uploading new image
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const filename = `product-${Date.now()}-${file.originalname}`;

        await new Promise((resolve, reject) => {
          const uploadStream = bucket.openUploadStream(filename, {
            contentType: file.mimetype,
          });

          sharp(file.buffer)
            .resize({ width: 800, height: 800 })
            .jpeg({ quality: 90 })
            .pipe(uploadStream)
            .on("error", reject)
            .on("finish", resolve);
        });

        product.productImages.push(filename);
      }
    }

    // Updateing other product fields
    product.productName = productName;
    product.regularPrice = regularPrice;
    product.salePrice = salePrice;
    product.category = category;

    await product.save();

    res
      .status(200)
      .json({ success: true, message:MESSAGES.PRODUCT_UPDATED_SUCCESS || "Product updated successfully!" });
  } catch (error) {
    console.error("Edit error:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message:MESSAGES.INTERNAL_SERVER_ERROR ||"Internal server error" });
  }
};

//delete products
const deleteProducts = async (req, res) => {
  try {
    const id = req.params.id;
    await Product.findByIdAndUpdate(id, { $set: { isDeleted: true } });
    res
      .status(200)
      .json({ success: true, message:MESSAGES.PRODUCT_DELETED || "Product deleted successfully!" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message:MESSAGES.INTERNAL_SERVER_ERROR || "Internal server error" });
  }
};

module.exports = {
  getProductPage,
  getAddProducts,
  getEditProduct,
  addProducts,
  editProducts,
  deleteProducts,
};
