const categorySchema = require("../../models/categorySchema");
const ProductSchema = require("../../models/productSchema");
const httpStatus = require("../../util/statusCodes");
const { MESSAGES } = require("../../util/constants");
const Category = require("../../models/categorySchema");
const productSchema = require("../../models/productSchema");

const categoryInfo = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;

    const query = {
      name: { $regex: search, $options: "i" },
    };

    const successMessage = req.session.successMessage;
    delete req.session.successMessage;

    const rawCategoryData = await categorySchema
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalCategory = await categorySchema.countDocuments(query);
    const totalPages = Math.ceil(totalCategory / limit);
    const hasPrevPage = page > 1;
    const hasNextPage = page < totalPages;
    const prevPage = page - 1;
    const nextPage = page + 1;

    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push({
        number: i,
        active: i === page,
      });
    }

    //For serial number
    const categoryData = rawCategoryData.map((category, index) => ({
      ...category,
      serialNumber: skip + index + 1,
    }));

    res.render("admin/categories", {
      categories: categoryData,
      currentPage: page,
      totalPages,
      totalCategory,
      hasPrevPage,
      prevPage,
      hasNextPage,
      nextPage,
      search,
      pages,
      successMessage,
      hideHeader: true,
      hideFooter: true,
      title: "Category Management",
    });
  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
};

const addCategory = async (req, res) => {
  const { name, description } = req.body;

  if (!name || !description) {
    return res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      error: "Name and description are required",
    });
  }

  const trimmedName = name.trim();
  const trimmedDescription = description.trim();

  try {
    const existingCategory = await categorySchema.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
    });

    if (existingCategory) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        error: "Category already exists",
      });
    }

    const newCategory = new categorySchema({
      name: trimmedName,
      description: trimmedDescription,
      isListed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await newCategory.save();

    return res.status(httpStatus.OK).json({
      success: true,
      message: "Category added successfully",
      category: {
        id: newCategory._id,
        name: newCategory.name,
      },
    });
  } catch (error) {
    console.error("Error adding category:", error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Internal server error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const listCategory = async (req, res) => {
  try {
    const id = req.params.id;
    await categorySchema.updateOne({ _id: id }, { $set: { isListed: true } });
    req.session.successMessage = "Category listed successfully!";
    res.redirect("/admin/category");
  } catch (error) {
    console.error("list error:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Internal server error");
  }
};

const unlistCategory = async (req, res) => {
  try {
    const id = req.params.id;
    await categorySchema.updateOne({ _id: id }, { $set: { isListed: false } });
    req.session.successMessage = "Category unlisted successfully!";
    res.redirect("/admin/category");
  } catch (error) {
    console.error("unlist error:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Internal server error");
  }
};

const editCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const { name, description } = req.body;

    const sameName = await categorySchema.find({ name, _id: { $ne: id } });

    if (sameName.length > 0) {
      res
        .status(httpStatus.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: "Category already exists" });
    }

    await categorySchema.findByIdAndUpdate(id, { $set: { name, description } });

    res
      .status(200)
      .json({ success: true, message: "Category updated successfully!" });
  } catch (error) {
    console.error("Edit error:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Internal server error" });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const id = req.params.id;

    //soft delete
    await categorySchema.findByIdAndUpdate(id, {
      $set: { isDeleted: true, isListed: false },
    });

    await ProductSchema.updateMany(
      { category: id },
      { $set: { isActive: false } }
    );

    res
      .status(httpStatus.OK)
      .json({ success: true, message: "Category deleted successfully!" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.INTERNAL_SERVER_ERROR || "Internal server error",
    });
  }
};

const undoDeleteCategory = async (req, res) => {
  try {
    const id = req.params.id;

    //soft delete
    await categorySchema.findByIdAndUpdate(id, {
      $set: { isDeleted: false, isListed: true },
    });

    await ProductSchema.updateMany(
      { category: id },
      { $set: { isActive: true } }
    );

    res
      .status(httpStatus.OK)
      .json({ success: true, message: "Category recovered successfully!" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.INTERNAL_SERVER_ERROR || "Internal server error",
    });
  }
};

const addCategoryOffer = async (req, res) => {
  try {
    let { id, percentage } = req.body;

    if (!id || !percentage) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ success: false, message: "Percentage is mandatory" });
    }

    percentage = Number(percentage);

    if (isNaN(percentage) || percentage < 1 || percentage > 100) {
      return res.json({
        success: false,
        message: "Percentage must be a valid number between 1 and 100 ",
      });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ success: false, message: "Category not found" });
    }

    await Category.findByIdAndUpdate(id, {
      $set: { categoryOffer: percentage },
    });

    const products = await ProductSchema.find({ category: id });

    for (let product of products) {
      const productOffer = product?.productOffer || 0;
      const finalOfferPercentage = Math.max(productOffer, percentage);
      const basePrice = product.regularPrice;
      const discountAmount = (basePrice * finalOfferPercentage) / 100;
      let finalSalePrice = basePrice - discountAmount;
      finalSalePrice = Math.round(finalSalePrice);

      await ProductSchema.findByIdAndUpdate(product._id, {
        $set: {
          appliedOffer: finalOfferPercentage,
          salePrice: finalSalePrice,
        },
      });
    }

    return res
      .status(httpStatus.OK)
      .json({ success: true, message: "Offer added successfully" });
  } catch (error) {
    console.error("addOffer error:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.INTERNAL_SERVER_ERROR || "Internal server error",
    });
  }
};

const removeCategoryOffer = async (req, res) => {
  try {
    const { id } = req.body;

    const category = await Category.findByIdAndUpdate(id, {
      $set: { categoryOffer: 0 },
    });

    const products = await ProductSchema.find({ category: id });

    for (let product of products) {
      const productOffer = product.productOffer || 0;
      const basePrice = product.regularPrice || product.salePrice;

      const discountAmount = (basePrice * productOffer) / 100;
      let finalSalePrice = basePrice - discountAmount;
      finalSalePrice = Math.round(finalSalePrice);

      await ProductSchema.findByIdAndUpdate(product._id, {
        $set: { salePrice: finalSalePrice, appliedOffer: productOffer },
      });
    }

    return res
      .status(httpStatus.OK)
      .json({ success: true, message: "Offer removed successfully" });
  } catch (error) {
    console.error("removeOffer error:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.INTERNAL_SERVER_ERROR || "Internal server error",
    });
  }
};

module.exports = {
  addCategory,
  categoryInfo,
  listCategory,
  unlistCategory,
  editCategory,
  deleteCategory,
  undoDeleteCategory,
  removeCategoryOffer,
  addCategoryOffer,
};
