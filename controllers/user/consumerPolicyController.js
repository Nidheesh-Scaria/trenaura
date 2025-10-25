const privacyAndPolicy = async (req, res) => {
  try {
    return res.render("user/privacy-policy", {
      title: "Trenaura's privacy and policy",
      adminHeader: true,
    });
  } catch (error) {
    console.error("Error in loadMyCoupon:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const shoppingPolicy = async (req, res) => {
  try {
    return res.render("user/shipping-policy", {
      title: "Trenaura's shopping policy",
      adminHeader: true,
    });
  } catch (error) {
    console.error("Error in shoppingPolicy:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const termsAndConditions = async (req, res) => {
  try {
    return res.render("user/termsAndConditions", {
      title: "Trenaura's Terms and conditions",
      adminHeader: true,
    });
  } catch (error) {
    console.error("Error in termsAndConditions:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

const aboutUs = async (req, res) => {
  try {
    return res.render("user/aboutUs", {
      title: "Trenaura-The aura of trend",
      hideHeader: true,
      hideFooter: true,
      adminHeader: true,
    });
  } catch (error) {
    console.error("Error in aboutUs:", error);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(MESSAGES.INTERNAL_SERVER_ERROR || "Server error");
  }
};

module.exports = {
  privacyAndPolicy,
  shoppingPolicy,
  termsAndConditions,
  aboutUs,
};
