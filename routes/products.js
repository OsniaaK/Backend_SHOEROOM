const express = require("express");
const router = express.Router();
const Product = require("../models/Product");

function parseSizeValue(size) {
  const n = Number(String(size).replace(/[^0-9.]/g, ""));
  return isNaN(n) ? Infinity : n;
}

function normalizePayload(payload) {
  const data = { ...payload };
  if (data.sizes && Array.isArray(data.sizes)) {
    data.sizes = data.sizes
      .map(s => ({ size: String(s.size), quantity: Number(s.quantity) || 0 }))
      .sort((a, b) => parseSizeValue(a.size) - parseSizeValue(b.size) || a.size.localeCompare(b.size));
    const total = data.sizes.reduce((acc, s) => acc + (Number(s.quantity) || 0), 0);
    data.stock = total;
    data.talle = data.sizes.map(s => s.size);
  } else if (data.talle && Array.isArray(data.talle)) {
    data.talle = data.talle.map(String).sort((a, b) => parseSizeValue(a) - parseSizeValue(b) || a.localeCompare(b));
  }
  return data;
}

function getBrandCode(category) {
  const map = {
    Adidas: "ADI",
    Nike: "NK",
    Vans: "VNS",
    LV: "LV",
    "Luis Vuitton": "LV",
  };
  return map[category] || (String(category || "").toUpperCase().slice(0, 3));
}

function getModelCode(name = "", category = "") {
  let model = String(name);
  const brand = String(category);
  if (model.toLowerCase().startsWith(brand.toLowerCase())) {
    model = model.slice(brand.length).trim();
  }
  const tokens = model.split(/\s+/).filter(Boolean);
  const letters = tokens.filter(t => /[A-Za-z]/.test(t)).map(t => t[0].toUpperCase());
  const digits = tokens.map(t => (t.match(/\d+/) || [""])[0]).find(d => d !== "");
  let code = (letters[0] || "");
  if (letters.length > 1) code += letters[1];
  if (digits) code += digits;
  code = code.slice(0, 3) || (tokens[0] ? tokens[0].slice(0, 3).toUpperCase() : "MDL");
  return code;
}

async function generateSku(category, name) {
  const brandCode = getBrandCode(category);
  const modelCode = getModelCode(name, category);
  const count = await Product.countDocuments({ category });
  const seq = String(count + 1).padStart(3, "0");
  return `${brandCode}-${modelCode}-${seq}`;
}
router.get("/", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener productos" });
  }
});
router.get("/:sku", async (req, res) => {
  try {
    const product = await Product.findOne({ sku: req.params.sku });
    if (!product) return res.status(404).json({ error: "Producto no encontrado" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener producto" });
  }
});
router.post("/", async (req, res) => {
  try {
    const payload = normalizePayload(req.body);
    if (!payload.sku || !String(payload.sku).trim()) {
      payload.sku = await generateSku(payload.category, payload.name);
    }
    const newProduct = new Product(payload);
    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(400).json({ error: "Error al crear producto" });
  }
});
router.put("/:sku", async (req, res) => {
  try {
    const payload = normalizePayload(req.body);
    const updated = await Product.findOneAndUpdate(
      { sku: req.params.sku },
      payload,
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Producto no encontrado" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: "Error al actualizar producto" });
  }
});
router.delete("/:sku", async (req, res) => {
  try {
    const deleted = await Product.findOneAndDelete({ sku: req.params.sku });
    if (!deleted) return res.status(404).json({ error: "Producto no encontrado" });
    res.json({ message: "Producto eliminado" });
  } catch (err) {
    res.status(400).json({ error: "Error al eliminar producto" });
  }
});

module.exports = router;