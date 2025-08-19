const mongoose = require("mongoose");

const SizeSchema = new mongoose.Schema({
  size: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0, default: 0 },
}, { _id: false });

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sku: { type: String, required: true, unique: true },
  price: { type: Number, required: true },
  stock: { type: Number, required: true },
  talle: [String],
  sizes: [SizeSchema],
  category: { type: String, required: true },
  image: { type: String },
  discount: { type: Number, default: 0 },
  description: { type: String },
});

function parseSizeValue(size) {
  const n = Number(size.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? Infinity : n;
}
ProductSchema.pre("save", function (next) {
  if (this.sizes && this.sizes.length > 0) {
    this.sizes.sort((a, b) => parseSizeValue(a.size) - parseSizeValue(b.size) || String(a.size).localeCompare(String(b.size)));
    const total = this.sizes.reduce((acc, s) => acc + (Number(s.quantity) || 0), 0);
    this.stock = total;
    this.talle = this.sizes.map(s => s.size);
  } else if (this.talle && this.talle.length > 0) {
    this.talle.sort((a, b) => parseSizeValue(a) - parseSizeValue(b) || String(a).localeCompare(String(b)));
  }
  next();
});

module.exports = mongoose.model("Product", ProductSchema);