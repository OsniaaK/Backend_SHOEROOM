const mongoose = require("mongoose");

const SizeSchema = new mongoose.Schema({
  size: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0, default: 0 },
}, { _id: false });

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sku: { type: String, required: true, unique: true },
  price: { type: Number, required: true },
  stock: { type: Number, required: true, default: 0 },
  talle: { type: [String], default: [] },
  sizes: { type: [SizeSchema], default: [] },
  category: { type: String, required: true },
  image: { type: String, default: '' },
  discount: { type: Number, default: 0 },
  description: { type: String, default: '' },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Helper function to parse size values for sorting
function parseSizeValue(size) {
  if (typeof size !== 'string') return Infinity;
  const n = Number(size.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? Infinity : n;
}

// Method to update stock for a specific size
ProductSchema.methods.updateSizeStock = function(size, quantityChange) {
  if (typeof quantityChange !== 'number') {
    throw new Error('Quantity change must be a number');
  }

  const sizeIndex = this.sizes.findIndex(s => s.size === size);
  
  if (sizeIndex === -1) {
    // If size doesn't exist, add it with the specified quantity
    if (quantityChange < 0) {
      throw new Error(`Cannot reduce stock for non-existent size: ${size}`);
    }
    this.sizes.push({ size, quantity: quantityChange });
  } else {
    // Update existing size
    const newQuantity = this.sizes[sizeIndex].quantity + quantityChange;
    if (newQuantity < 0) {
      throw new Error(`Insufficient stock for size ${size}. Available: ${this.sizes[sizeIndex].quantity}, Requested: ${-quantityChange}`);
    }
    this.sizes[sizeIndex].quantity = newQuantity;
  }

  // Update total stock and sizes array
  this.stock = this.sizes.reduce((total, s) => total + (Number(s.quantity) || 0), 0);
  this.talle = [...new Set([...this.talle, size])]; // Ensure size is in talle array
  
  return this;
};

// Method to check if there's enough stock
ProductSchema.methods.hasEnoughStock = function(size, quantity) {
  const sizeInfo = this.sizes.find(s => s.size === size);
  if (!sizeInfo) return false;
  return sizeInfo.quantity >= quantity;
};

// Pre-save hook to ensure data consistency
ProductSchema.pre("save", function (next) {
  // Ensure sizes are properly sorted
  if (this.isModified('sizes') && this.sizes && this.sizes.length > 0) {
    // Remove any duplicate sizes (keep the last one)
    const sizeMap = new Map();
    this.sizes.forEach(size => {
      sizeMap.set(size.size, size.quantity);
    });
    
    // Rebuild sizes array from the map
    this.sizes = Array.from(sizeMap.entries()).map(([size, quantity]) => ({
      size,
      quantity: Number(quantity) || 0
    }));
    
    // Sort sizes
    this.sizes.sort((a, b) => 
      parseSizeValue(a.size) - parseSizeValue(b.size) || 
      String(a.size).localeCompare(String(b.size))
    );
    
    // Update stock and talle
    this.stock = this.sizes.reduce((acc, s) => acc + (Number(s.quantity) || 0), 0);
    this.talle = this.sizes.map(s => s.size);
  } else if (this.isModified('talle') && this.talle && this.talle.length > 0) {
    // If only talle is modified, ensure it's sorted
    this.talle = [...new Set(this.talle)]; // Remove duplicates
    this.talle.sort((a, b) => 
      parseSizeValue(a) - parseSizeValue(b) || 
      String(a).localeCompare(String(b))
    );
  }
  
  next();
});

// Static method to safely update stock
ProductSchema.statics.updateStock = async function(productId, size, quantityChange, session = null) {
  const product = await this.findById(productId).session(session);
  if (!product) {
    throw new Error('Product not found');
  }
  
  product.updateSizeStock(size, quantityChange);
  return product.save({ session });
};

module.exports = mongoose.model("Product", ProductSchema);