const mongoose = require("mongoose");

const SizeSchema = new mongoose.Schema({
  size: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0, default: 0 },
}, { _id: false });

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  sku: { type: String, required: true, unique: true, index: true },
  price: { type: Number, required: true, index: true },
  stock: { type: Number, required: true, default: 0, index: true },
  talle: { type: [String], default: [], index: true },
  sizes: { type: [SizeSchema], default: [] },
  category: { type: String, required: true, index: true },
  image: { type: String, default: '' },
  discount: { type: Number, default: 0, index: true },
  description: { type: String, default: '' },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

function parseSizeValue(size) {
  if (typeof size !== 'string') return Infinity;
  const n = Number(size.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? Infinity : n;
}

ProductSchema.methods.updateSizeStock = function(size, quantityChange) {
  if (typeof quantityChange !== 'number') {
    throw new Error('Quantity change must be a number');
  }

  const sizeIndex = this.sizes.findIndex(s => s.size === size);
  
  if (sizeIndex === -1) {
    if (quantityChange < 0) {
      throw new Error(`Cannot reduce stock for non-existent size: ${size}`);
    }
    this.sizes.push({ size, quantity: quantityChange });
  } else {
    const newQuantity = this.sizes[sizeIndex].quantity + quantityChange;
    if (newQuantity < 0) {
      throw new Error(`Insufficient stock for size ${size}. Available: ${this.sizes[sizeIndex].quantity}, Requested: ${-quantityChange}`);
    }
    this.sizes[sizeIndex].quantity = newQuantity;
  }

  this.stock = this.sizes.reduce((total, s) => total + (Number(s.quantity) || 0), 0);
  this.talle = [...new Set([...this.talle, size])];
  
  return this;
};

ProductSchema.methods.hasEnoughStock = function(size, quantity) {
  const sizeInfo = this.sizes.find(s => s.size === size);
  if (!sizeInfo) return false;
  return sizeInfo.quantity >= quantity;
};

ProductSchema.pre("save", function (next) {
  if (this.isModified('sizes') && this.sizes && this.sizes.length > 0) {
    const sizeMap = new Map();
    this.sizes.forEach(size => {
      const qty = Number(size.quantity) || 0;
      if (size.size && qty > 0) {
        sizeMap.set(String(size.size), qty);
      }
    });
    this.sizes = Array.from(sizeMap.entries()).map(([size, quantity]) => ({
      size,
      quantity: Number(quantity) || 0
    }));

    this.sizes.sort((a, b) =>
      parseSizeValue(a.size) - parseSizeValue(b.size) ||
      String(a.size).localeCompare(String(b.size))
    );

    this.stock = this.sizes.reduce((acc, s) => acc + (Number(s.quantity) || 0), 0);
    this.talle = this.sizes.map(s => s.size);
  } else if (this.isModified('talle') && this.talle && this.talle.length > 0) {
    this.talle = [...new Set(this.talle.filter(Boolean))];
    this.talle.sort((a, b) =>
      parseSizeValue(a) - parseSizeValue(b) ||
      String(a).localeCompare(String(b))
    );
  } else {
    if (Array.isArray(this.sizes) && this.sizes.length > 0) {
      this.sizes = this.sizes.filter(s => Number(s.quantity) > 0);
      this.stock = this.sizes.reduce((acc, s) => acc + (Number(s.quantity) || 0), 0);
      this.talle = this.sizes.map(s => s.size);
    } else if (Array.isArray(this.talle) && this.talle.length > 0) {
      this.talle = [...new Set(this.talle.filter(Boolean))];
    }
  }

  next();
});

ProductSchema.statics.updateStock = async function(productId, size, quantityChange, session = null) {
  const product = await this.findById(productId).session(session);
  if (!product) {
    throw new Error('Product not found');
  }
  
  product.updateSizeStock(size, quantityChange);
  return product.save({ session });
};

module.exports = mongoose.model("Product", ProductSchema);