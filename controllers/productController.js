const Product = require("../models/productSchema");
const Category = require("../models/categorySchema");
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
      .select("productName regularPrice salePrice category status isBlocked isDeleted")
      .populate('category', 'name')
      .limit(limit)
      .sort({ createdOn: -1 })
      .skip((page - 1) * limit)
      .lean();

    const products = productData.map((product) => ({
      _id: product._id,
      productName: product.productName,
      salePrice: product.salePrice,
      regularPrice: product.regularPrice,
      category: product.category?.name || "Unknown", 
      categoryId: product.category?._id || "",
      status: product.status,
      isBlocked: product.isBlocked,
    }));

    
    const count = await Product.countDocuments(query);
    const categories = await Category.find({isListed:true}).select("_id name").lean();
    

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
    
    const category = await Category.find({isListed: true,isDeleted: false}).lean();
    res.render("admin/product-add", {
      categories: category,
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

    
    if (
      !productData.productName ||
      !productData.description ||
      !productData.category
    ) {
      return res.status(400).json({ error: "Missing required fields" });
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

    // Process images
    const images = [];
    if (req.files && req.files.length > 0) {
      
      if (req.files.length < 3) {
        return res.status(400).render("admin/product-add", {
          error: "Please upload at least 3 images",
          productData,
        });
      }

     
      for (const file of req.files) {
        try {
          const originalPath = file.path;
          const filename = path.parse(file.originalname).name; 
          const ext = path.extname(file.originalname);
          const newFilename = `resized-${filename}-${Date.now()}${ext}`;
          const resizedImagePath = path.join(
            "public",
            "uploads",
            "product-images",
            newFilename
          );

          // Resize and save image using Sharp
          await sharp(originalPath)
            .resize({ width: 800, height: 800, fit: "cover" })
            .toFormat("jpeg")
            .jpeg({ quality: 90 })
            .toFile(resizedImagePath);

          images.push(newFilename); // Store the new filename

          // Remove original file after processing
          await fs.promises.unlink(originalPath);
        } catch (fileError) {
          console.error(
            `Error processing file ${file.originalname}:`,
            fileError
          );
          // Continue processing other files even if one fails
        }
      }
    } else {
      return res.status(400).render("admin/add-product", {
        error: "Please upload product images",
        productData,
      });
    }

    // Find category
    const category = await Category.findOne({ name: productData.category });
    if (!category) {
      return res.status(400).render("admin/add-product", {
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
    return res.redirect("/admin/addProducts");
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
        category 
      }
    });

    res.status(200).json({ success: true, message: "Product updated successfully!" });
  } catch (error) {
    console.error("Edit error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Delete Product Controller
const deleteProducts = async (req, res) => {
  
    try {
      const id = req.params.id;
      await Product.findByIdAndUpdate(id,{$set:{isDeleted:true}})
      res.status(200).json({ success: true, message: "Product deleted successfully!" });
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
