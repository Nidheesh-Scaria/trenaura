if (category === "Beauty") {
  if (isNaN(quantity) || !quantity || quantity <= 0) {
    $("#editQuantity-error").text("Quantity must be a greater than zero");
    isValid = false;
  } else {
    if (
      sizeS < 0 ||
      sizeXs < 0 ||
      sizeM < 0 ||
      sizeL < 0 ||
      sizeXl < 0 ||
      sizeXxl < 0
    ) {
      $("#editSize-error").text("Quantity must be a greater than zero");
      isValid = false;
    }
  }
}
