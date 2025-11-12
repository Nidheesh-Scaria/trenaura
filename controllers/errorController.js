const httpStatus = require("../util/statusCodes");

const adminPageNotFound = (req, res) => {
  res.status(httpStatus.BAD_REQUEST).render("admin/page-404", {
    hideHeader: true,
    hideFooter: true,
    adminHeader: true,
    title: "Page Not Found | Trenaura",
  });
};

const userPageNotFound = async (req, res) => {
  res.status(httpStatus.BAD_REQUEST).render("user/page-404", {
    hideHeader: true,
    hideFooter: true,
    adminHeader: true,
    title: "Page Not Found | Trenaura",
  });
};

module.exports = { userPageNotFound, adminPageNotFound };
