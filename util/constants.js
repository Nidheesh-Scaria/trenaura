const MESSAGES = {
  INTERNAL_SERVER_ERROR: "Something went wrong. Please try again later.",
  USER_NOT_FOUND:"User not found",
  PRODUCT_ADDED_SUCCESS: "Product added successfully",
  PRODUCT_EXISTS: "Product already exists, please try another name",
  MISSING_FIELDS: "Missing required fields",
  INVALID_CATEGORY: "Invalid category",
  INVALID_BRAND: "Invalid brand",
  UPLOAD_AT_LEAST_3_IMAGES: "Please upload at least 3 images",
  PRODUCT_ADD_FAILED: "Failed to add product",
  PRODUCT_NOT_FOUND: "Product not found",
  PRODUCT_UPDATED_SUCCESS: "Product updated successfully!",
  PRODUCT_DELETED: "Product deleted successfully!",

  ALREADY_EXISTS:"Email or phone number already in use. Please use a different one.",
  NO_REFERRAL_CODE:"No referral code found try valid one",
  INVALID_OTP: "Invalid OTP, please try again",
  EXPIRED_SESSION: "Session expired. Please login again.",

  USERINFO: {
    EDIT_WITH_NEW_VALUE: "Please update with new values.",
    EDIT_SUCCESS: "Updated successfully",

  },
  ADD_ADDRESS:{
    SUCCESS:"Address added successfully",
    MISSING_FIELDS: "Missing required fields",
    ADDRESS_NOT_FOUND:"No address found, please add address",
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
    INVALID_EMAIL: "Invalid email for the current user",
    EMAIL_REQUIRED: "Email is required"
  },
  CART:{
    CART_EMPTY:"Cart is empty",
    QUANTITY_INCREASE:"Quantity incresed by one",
    QUANTITY_DECREASE:"Quantity decresed by one",
    ITEM_DELETED:"Item removed from your shopping bag",
    IREM_NOT_FOUND:"Item not found in cart",
    CART_NOT_FOUND:"Cart not found"
  },
  WISHLIST:{
    WISHLIST_EMPTY:"Wishlist is empty",
    ITEM_DELETED:"Item removed from your wishlist",
    WISHLISTED:"Product added to wishlist"
  },
  PAYMENT:{
    PAYMENT_METHOD_INVALID:"Invalid payment method",

  },

};

module.exports = { MESSAGES };
