const Brand = require("../models/brandSchema");

const getBrandPage = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 3;

    const query = {
      brandName: { $regex: search, $options: "i" },
    };

    const brandData = await Brand.find(query)
      .select("brandName isBlocked createdAt")
      .limit(limit)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .lean();

    const brands = brandData.map((brand, index) => ({
      _id: brand._id,
      brandName: brand.brandName,
      status: brand.isBlocked,
      createdAt: brand.createdAt.toISOString().split("T")[0],
      serialNumber: (page - 1) * limit + index + 1, //
    }));

    const count = await Brand.countDocuments(query);

    res.render("admin/brand", {
      hideHeader: true,
      hideFooter: true,
      brands,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      search,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};

const addBrandPage = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: "Name and description are required",
      });
    }

    const trimmedName = name.trim();

    const isExists = await Brand.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
    });
    if (isExists) {
      return res.status(400).json({
        success: false,
        error: "Category already exists",
      });
    }

    const newBrand = new Brand({
      brandName: trimmedName,
      isBlocked: false,
      createdAt: new Date(),
    });

    await newBrand.save();
    return res.status(201).json({
      success: true,
      message: "Brand added successfully",
      brand: {
        id: newBrand._id,
        name: newBrand.name,
      },
    });
  } catch (error) {
    console.error("Error adding brand:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const editBrand = async (req, res) => {
  try {
    const id = req.params.id;
    const { brandName } = req.body;

    await Brand.findByIdAndUpdate(id, { $set: { brandName } });
    res
      .status(200)
      .json({ success: true, message: "Brand updated successfully" });
  } catch (error) {
    console.error("Edit error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const deleteBrand = async (req, res) => {
  try {
    const id = req.params.id;
    console.log("Deleting Category ID:", id);

    await Brand.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "Brand deleted" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const unblockBrand = async (req, res) => {
  try {
    const id = req.params.id;
    console.log("block Category ID:", id);
    await Brand.findByIdAndUpdate({ _id: id }, { $set: { isBlocked: false } });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const blockBrand = async (req, res) => {
  try {
    const id = req.params.id;
    await Brand.findByIdAndUpdate({ _id: id }, { $set: { isBlocked: true } });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};


module.exports = {
  getBrandPage,
  addBrandPage,
  editBrand,
  deleteBrand,
  unblockBrand,
  blockBrand,
};
