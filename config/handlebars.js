const exphbs = require("express-handlebars");
const path = require("path");

const hbs = exphbs.create({
  extname: "hbs",
  defaultLayout: "layout",
  layoutsDir: path.join(__dirname, "../views"),
  partialsDir: path.join(__dirname, "../views/partials"),
  helpers: {
    increment(value, step = 1) {
      return Number(value || 0) + Number(step || 1);
    },
    decrement(value, step = 1) {
      return Number(value || 0) - Number(step || 1);
    },
    multiply(a, b) {
      return (Number(a) || 0) * (Number(b) || 0);
    },
    ifCond(v1, operator, v2, options) {
      switch (operator) {
        case "===": return v1 === v2 ? options.fn(this) : options.inverse(this);
        case ">": return v1 > v2 ? options.fn(this) : options.inverse(this);
        case "<": return v1 < v2 ? options.fn(this) : options.inverse(this);
        case ">=": return v1 >= v2 ? options.fn(this) : options.inverse(this);
        case "<=": return v1 <= v2 ? options.fn(this) : options.inverse(this);
        default: return options.inverse(this);
      }
    },
    range(start, end) {
      const s = Number(start), e = Number(end);
      return Array.from({ length: e - s + 1 }, (_, i) => s + i);
    },
    eq: (a, b) => a === b,
    ne: (a, b) => a !== b,
    gt: (a, b) => a > b,
    lt: (a, b) => a < b,
    gte: (a, b) => a >= b,
    lte: (a, b) => a <= b,
    and: (...args) => args.slice(0, -1).every(Boolean),
    or: (...args) => args.slice(0, -1).some(Boolean),
    formatDate: (date) => date ? new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "",
    includes: (array, value) => array?.map(String).includes(String(value)) || false,
  },
});

module.exports = hbs;
