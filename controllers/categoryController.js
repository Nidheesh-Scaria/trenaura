const categorySchema = require("../models/categorySchema");
const productSchema = require("../models/productSchema");
const httpStatus = require("../util/statusCodes");
const { MESSAGES } = require("../util/constants");

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
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send(MESSAGES.INTERNAL_SERVER_ERROR||"Internal server error");
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
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send(MESSAGES.INTERNAL_SERVER_ERROR||"Internal server error");
  }
};

const editCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const { name, description } = req.body;

    const sameName = await categorySchema.find({ name, _id: { $ne: id } });
    
    if (sameName.length>0) {
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
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error" });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const id = req.params.id;
    console.log("Deleting Category ID:", id);

    await categorySchema.findByIdAndDelete(id);
    res
      .status(httpStatus.OK)
      .json({ success: true, message: "Category deleted successfully!" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: MESSAGES.INTERNAL_SERVER_ERROR ||"Internal server error" });
  }
};

module.exports = {
  addCategory,
  categoryInfo,
  listCategory,
  unlistCategory,
  editCategory,
  deleteCategory,
};
