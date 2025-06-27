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

const addProducts = async (req, res) => {
  try {
    const productData = req.body;

    // Validate required fields
    if (
      !productData.productName ||
      !productData.description ||
      !productData.category
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: product name, description, and category are required",
      });
    }

    // Check if product already exists
    const productExists = await Product.findOne({
      productName: productData.productName,
    });

    if (productExists) {
      return res.status(400).json({
        success: false,
        message: "Product already exists, please try another name",
      });
    }

    // Validate and upload images
    const images = [];
    if (req.files && req.files.length >= 3) {
      const bucket = req.app.locals.bucket;

      if (!bucket) {
        return res.status(500).json({
          success: false,
          message: "Image storage system not initialized. Please try again.",
        });
      }

      for (const file of req.files) {
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
        } catch (error) {
          console.log(`Error uploading ${filename}:`, error);
          return res.status(500).json({
            success: false,
            message: `Failed to upload image: ${file.originalname}. Please try again.`,
          });
        }
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "Please upload at least 3 images",
      });
    }

    // Find category
    const category = await Category.findOne({ name: productData.category });
    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Invalid category selected",
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

    // Return success response
    return res.status(200).json({
      success: true,
      message: "Product added successfully",
    });
  } catch (error) {
    console.error("Error saving product:", error);

    return res.status(500).json({
      success: false,
      message:
        "An unexpected error occurred. Please check your connection and try again.",
    });
  }
};

const editProducts = async (req, res) => {
  try {
    const id = req.params.id;
    const { productName, regularPrice, salePrice, category } = req.body;

    await Product.findByIdAndUpdate(id, {
      $set: {
        productName,
        regularPrice,
        salePrice,
        category,
      },
    });

    res
      .status(200)
      .json({ success: true, message: "Product updated successfully!" });
  } catch (error) {
    console.error("Edit error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

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
  addProducts,
  editProducts,
  deleteProducts,
};
