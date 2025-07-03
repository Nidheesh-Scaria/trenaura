const Product = require("../models/productSchema");
const Category = require("../models/categorySchema");
const Brand = require("../models/brandSchema");
const fs = require("fs");
const path = require("path");
const userSchema = require("../models/userSchema");
const sharp = require("sharp");

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
      productImages: product.productImages || [],
      firstImage: product.productImages?.[0] || null,
      serialNumber: (page - 1) * limit + index + 1, //for serial number
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
    res.status(500).send("Internal Server Error");
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
    res.status(500).send("Internal Server Error");
  }
};

const getEditProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId)
      .populate("category", "name _id")
      .lean();

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.json({
      success: true,
      product: {
        _id: product._id,
        productName: product.productName,
        regularPrice: product.regularPrice,
        salePrice: product.salePrice,
        category: product.category?._id,
        categoryName: product.category?.name,
        productImages: product.productImages || []
      }
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const addProducts = async (req, res) => {
  try {
    const productData = req.body;
    console.log("Received form:", req.body);
    console.log("Received files:", req.files);

    if (
      !productData.productName ||
      !productData.description ||
      !productData.category
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    const productExists = await Product.findOne({
      productName: productData.productName,
    });

    if (productExists) {
      return res.status(400).render("admin/product-add", {
        error: "Product already exists, please try another name",
        productData,
      });
    }
    //new image add code

    const images = [];
    if (req.files && req.files.length >= 3) {
      const bucket = req.app.locals.bucket;
      for (const file of req.files) {
        const filename = `product-${Date.now()}-${file.originalname}}`;
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
        } catch (error) {
          console.log(`error uploading ${filename}:`, error);
        }
      }
    } else {
      return res.status(400).render("admin/product-add", {
        error: "Please upload atleast 3 images",
        productData,
      });
    }

  
    // Find category
    const category = await Category.findOne({ name: productData.category });
    if (!category) {
      return res.status(400).render("admin/product-add", {
        error: "Invalid category",
        productData,
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

    // Redirect with success message
    req.flash("success", "Product added successfully");
    // return res.status(200).json({ success: true });

    return res.redirect("/admin/products");
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

    req.flash("error", "Failed to add product");
    console.log(error);
    return res.redirect("/admin/addProducts");
  }
};

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
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Deleting selected images
    for (const filename of deleteImages) {
      const file = await bucket.find({ filename }).toArray();
      if (file.length > 0) {
        await bucket.delete(file[0]._id);
      }
      product.productImages = product.productImages.filter(img => img !== filename);
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

    res.status(200).json({ success: true, message: "Product updated successfully!" });
  } catch (error) {
    console.error("Edit error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};



//delete products
const deleteProducts = async (req, res) => {
  try {
    const id = req.params.id;
    await Product.findByIdAndUpdate(id, { $set: { isDeleted: true } });
    res
      .status(200)
      .json({ success: true, message: "Product deleted successfully!" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
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
