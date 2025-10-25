

// const exphbs = require("express-handlebars");
// const path = require("path");

// const hbs = exphbs.create({
//   extname: "hbs",
//   defaultLayout: "layout",
//   layoutsDir: path.join(__dirname, "../views"),
//   partialsDir: path.join(__dirname, "../views/partials"),
//   helpers: {
//     // Basic Math
//     increment(value, step = 1) {
//       return Number(value || 0) + Number(step || 1);
//     },
//     decrement(value, step = 1) {
//       return Number(value || 0) - Number(step || 1);
//     },
//     multiply(a, b) {
//       return (Number(a) || 0) * (Number(b) || 0);
//     },

//     // Conditional Helper
//     ifCond(v1, operator, v2, options) {
//       switch (operator) {
//         case "===":
//           return v1 === v2 ? options.fn(this) : options.inverse(this);
//         case "!==":
//           return v1 !== v2 ? options.fn(this) : options.inverse(this);
//         case ">":
//           return v1 > v2 ? options.fn(this) : options.inverse(this);
//         case "<":
//           return v1 < v2 ? options.fn(this) : options.inverse(this);
//         case ">=":
//           return v1 >= v2 ? options.fn(this) : options.inverse(this);
//         case "<=":
//           return v1 <= v2 ? options.fn(this) : options.inverse(this);
//         default:
//           return options.inverse(this);
//       }
//     },

//     // Range for loops
//     range(start, end) {
//       const s = Number(start),
//         e = Number(end);
//       return Array.from({ length: e - s + 1 }, (_, i) => s + i);
//     },

//     // Comparisons
//     eq: (a, b) => a === b,
//     ne: (a, b) => a !== b,
//     gt: (a, b) => a > b,
//     lt: (a, b) => a < b,
//     gte: (a, b) => a >= b,
//     lte: (a, b) => a <= b,
//     and: (...args) => args.slice(0, -1).every(Boolean),
//     or: (...args) => args.slice(0, -1).some(Boolean),

//     // Date Formatting
//     formatDate: (date) =>
//       date
//         ? new Date(date).toLocaleDateString("en-GB", {
//             day: "2-digit",
//             month: "short",
//             year: "numeric",
//           })
//         : "",

//     // Array Includes
//     includes: (array, value) =>
//       array?.map(String).includes(String(value)) || false,

//     // --- HELPERS FOR CHARTS ---
//     // Convert JS array/object into safe JSON string for Chart.js
//     toJSON: (context) => JSON.stringify(context),

//     // Format number with commas
//     numberFormat: (value) => {
//       if (!value) return 0;
//       return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
//     },

//     // Uppercase labels (useful in charts for categories/brands)
//     uppercase: (str) => (str || "").toUpperCase(),

//     //helper to print objects clearly in HBS
//     json: function (context) {
//       return JSON.stringify(context, null, 2);
//     },

//   },
// });

// module.exports = hbs;

const exphbs = require("express-handlebars");
const path = require("path");

const hbs = exphbs.create({
  extname: "hbs",
  defaultLayout: "layout",
  layoutsDir: path.join(__dirname, "../views"),
  partialsDir: path.join(__dirname, "../views/partials"),
  helpers: {
    // ---------- Basic Math ----------
    increment(value, step = 1) {
      return Number(value || 0) + Number(step || 1);
    },
    decrement(value, step = 1) {
      return Number(value || 0) - Number(step || 1);
    },
    multiply(a, b) {
      return (Number(a) || 0) * (Number(b) || 0);
    },

    // ---------- Conditional Helper ----------
    ifCond(v1, operator, v2, options) {
      switch (operator) {
        case "===":
          return v1 === v2 ? options.fn(this) : options.inverse(this);
        case "!==":
          return v1 !== v2 ? options.fn(this) : options.inverse(this);
        case ">":
          return v1 > v2 ? options.fn(this) : options.inverse(this);
        case "<":
          return v1 < v2 ? options.fn(this) : options.inverse(this);
        case ">=":
          return v1 >= v2 ? options.fn(this) : options.inverse(this);
        case "<=":
          return v1 <= v2 ? options.fn(this) : options.inverse(this);
        default:
          return options.inverse(this);
      }
    },

    // ---------- Range for Loops ----------
    range(start, end) {
      const s = Number(start),
        e = Number(end);
      return Array.from({ length: e - s + 1 }, (_, i) => s + i);
    },

    // ---------- Comparisons ----------
    eq: (a, b) => a === b,
    ne: (a, b) => a !== b,
    gt: (a, b) => a > b,
    lt: (a, b) => a < b,
    gte: (a, b) => a >= b,
    lte: (a, b) => a <= b,
    and: (...args) => args.slice(0, -1).every(Boolean),
    or: (...args) => args.slice(0, -1).some(Boolean),

    // ---------- Date Formatting ----------
    formatDate: (date) =>
      date
        ? new Date(date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "",

    // ---------- Array Includes ----------
    includes: (array, value) =>
      array?.map(String).includes(String(value)) || false,

    // ---------- Chart Helpers ----------
    toJSON: (context) => JSON.stringify(context),

    // ---------- Number Formatting ----------
    numberFormat: (value) => {
      if (!value) return 0;
      return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    },

    // ---------- String Helpers ----------
    uppercase: (str) => (str || "").toUpperCase(),

    // ---------- Debugging ----------
    json: function (context) {
      return JSON.stringify(context, null, 2);
    },

    // ============================================================
    // 📄 PAGINATION HELPERS
    // ============================================================

    // Merge two objects (for building query params)
    merge: (a, b) => Object.assign({}, a, b),

    // Build query string from object (keeps arrays, skips empty fields)
    queryString: (obj) => {
      const params = new URLSearchParams();
      for (const key in obj) {
        if (Array.isArray(obj[key])) {
          obj[key].forEach((v) => params.append(key, v));
        } else if (obj[key] !== undefined && obj[key] !== "") {
          params.append(key, obj[key]);
        }
      }
      return params.toString();
    },

    // ✅ Added buildQuery (used by your pagination links)
    buildQuery: (query, page) => {
      const updated = { ...query, page };
      const params = new URLSearchParams();
      for (const key in updated) {
        if (updated[key] !== undefined && updated[key] !== "") {
          params.append(key, updated[key]);
        }
      }
      return `?${params.toString()}`;
    },

    // Pagination range: show previous, current, next
    paginationRange: (currentPage, totalPages) => {
      currentPage = Number(currentPage);
      totalPages = Number(totalPages);
      const range = [];
      if (currentPage > 1) range.push(currentPage - 1);
      range.push(currentPage);
      if (currentPage < totalPages) range.push(currentPage + 1);
      return range;
    },

    // Build pagination query object
    paginationQuery: (page) => ({ page }),
  },
});

module.exports = hbs;
