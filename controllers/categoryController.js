const categorySchema = require("../models/categorySchema");

const categoryInfo = async (req, res) => {
  if (req.session.admin) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 3;
      const skip = (page - 1) * limit;

      const successMessage = req.session.successMessage;
      delete req.session.successMessage;

      const categoryData = await categorySchema
        .find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const totalCategory = await categorySchema.countDocuments();
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

      res.render("admin/category", {
        categories: categoryData,
        currentPage: page,
        totalPages,
        totalCategory,
        hasPrevPage,
        prevPage,
        hasNextPage,
        nextPage,
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
  } else {
    res.redirect("/admin/login");
  }
};


const addCategory = async (req, res) => {
  if (req.session.admin) {
    const { name, description } = req.body;
    try {
      const existingCategory = await categorySchema.findOne({ name });
      if (existingCategory) {
        return res.status(400).json({ error: "Category already exists" });
      }

      const newCategory = new categorySchema({ name, description });
      await newCategory.save();

      return res.status(200).json({ message: "Category added successfully" });
    } catch (error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  } else {
    res.redirect("/admin/login");
  }
};

const listCategory = async (req, res) => {
  if (req.session.admin) {
    try {
      const id = req.params.id;
      await categorySchema.updateOne({ _id: id }, { $set: { isListed: true } });
      req.session.successMessage = "Category listed successfully!";
      res.redirect("/admin/category");
    } catch (error) {
      console.error("list error:", error);
      res.status(500).send("Internal server error");
    }
  } else {
    res.redirect("/admin/login");
  }
};

const unlistCategory = async (req, res) => {
  if (req.session.admin) {
    try {
      const id = req.params.id;
      await categorySchema.updateOne(
        { _id: id },
        { $set: { isListed: false } }
      );
      req.session.successMessage = "Category unlisted successfully!";
      res.redirect("/admin/category");
    } catch (error) {
      console.error("unlist error:", error);
      res.status(500).send("Internal server error");
    }
  } else {
    res.redirect("/admin/login");
  }
};


const editCategory = async (req, res) => {
  if (req.session.admin) {
    try {
      
      console.log("Request received at editCategory");
      console.log("Params:", req.params);
      console.log("Body:", req.body);
      const id = req.params.id;
      const { name, description } = req.body;


      await categorySchema.findByIdAndUpdate(id, { $set: { name, description } });

      res.status(200).json({ success: true, message: "Category updated successfully!" });
    } catch (error) {
      console.error("Edit error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  } else {
    res.status(401).json({ success: false, message: "Unauthorized" });
  }
};


const deleteCategory = async (req, res) => {
  if (req.session.admin) {
    try {
      const id = req.params.id;
      console.log("Deleting Category ID:", id);

      await categorySchema.findByIdAndDelete(id);

      res.status(200).json({ success: true, message: "Category deleted successfully!" });
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  } else {
    res.status(401).json({ success: false, message: "Unauthorized" });
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
