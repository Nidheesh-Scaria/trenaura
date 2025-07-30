const MESSAGES = {
  INTERNAL_SERVER_ERROR: "Something went wrong. Please try again later.",
  USER_NOT_FOUND:"User not found",
  PRODUCT_ADDED_SUCCESS: "Product added successfully",
  PRODUCT_EXISTS: "Product already exists, please try another name",
  MISSING_FIELDS: "Missing required fields",
  INVALID_CATEGORY: "Invalid category",
  UPLOAD_AT_LEAST_3_IMAGES: "Please upload at least 3 images",
  PRODUCT_ADD_FAILED: "Failed to add product",
  PRODUCT_NOT_FOUND: "Product not found",
  PRODUCT_UPDATED_SUCCESS: "Product updated successfully!",
  PRODUCT_DELETED: "Product deleted successfully!",

  ALREADY_EXISTS:"Email or phone number already in use. Please use a different one.",
  INVALID_OTP: "Invalid OTP, please try again",
  EXPIRED_SESSION: "Session expired. Please login again.",

  USERINFO: {
    EDIT_WITH_NEW_VALUE: "Please update with new values.",
    EDIT_SUCCESS: "Updated successfully",

  },
  ADD_ADDRESS:{
    SUCCESS:"Address added successfully",
    MISSING_FIELDS: "Missing required fields",
  },
  EDIT_ADDRESS:{
    SUCCESS:"Address edited successfully",
    MISSING_FIELDS: "Missing required fields",
    DELETE_ADDRESS:"Deleted Successfully",
  },
  CHANGE_PASSWORD:{
    MISMATCH:"New password and confirm password do not match",
    INVALID_CURRENT_PASSWORD: "Current password is incorrect",
    SUCCESS: "Password changed successfully",
    SAME_PASSWORD: "New password cannot be the same as current password",
    
  },
};

module.exports = { MESSAGES };
