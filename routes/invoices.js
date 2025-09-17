const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');

async function validateAndReserveStock(items, session) {
  const productUpdates = [];
  const products = [];

  for (const item of items) {
    const product = await Product.findById(item.product).session(session);
    if (!product) {
      throw new Error(`Producto no encontrado: ${item.productName || item.productSku || item.product}`);
    }
    
    if (!product.hasEnoughStock(item.size, item.quantity)) {
      const sizeInfo = product.sizes.find(s => s.size === item.size);
      throw new Error({
        message: `Stock insuficiente para ${product.name}, talle ${item.size}.`,
        productId: product._id,
        productName: product.name,
        size: item.size,
        available: sizeInfo ? sizeInfo.quantity : 0,
        requested: item.quantity,
        error: 'INSUFFICIENT_STOCK'
      });
    }
    
    products.push({ product, item });
  }

  for (const { product, item } of products) {
    await Product.updateStock(
      product._id, 
      item.size, 
      -item.quantity, 
      session
    );
  }
  
  return products.map(({ product, item }) => ({
    ...item,
    product: product._id,
    productName: product.name,
    price: item.price || (product.price * (1 - (product.discount || 0) / 100))
  }));
}

async function generateInvoiceNumber() {
  const lastInvoice = await Invoice.findOne().sort({ createdAt: -1 });
  if (lastInvoice) {
    const lastNumber = parseInt(lastInvoice.invoiceNumber.split('-')[1]);
    return `FAC-${lastNumber + 1}`;
  }
  return 'FAC-1001';
}

router.get('/test-route', (req, res) => {
  console.log('Test route hit');
  res.status(200).json({ message: 'Test route is working' });
});

router.get('/test-delete', (req, res) => {
  console.log('Test DELETE endpoint hit');
  res.status(200).json({ message: 'Test DELETE endpoint working' });
});

router.options('/', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).send();
});

router.delete('/', async (req, res) => {
  console.log('DELETE /api/invoices/ endpoint hit');
  console.log('Request URL:', req.originalUrl);
  console.log('Request method:', req.method);
  console.log('Request headers:', req.headers);
  
  try {
    console.log('Attempting to delete all invoices...');
    
    if (mongoose.connection.readyState !== 1) {
      console.error('Database not connected');
      return res.status(503).json({
        success: false,
        message: 'Database not connected',
        error: 'DATABASE_ERROR'
      });
    }
    
    const result = await Invoice.deleteMany({});
    console.log('Delete result:', result);
    
    if (result.deletedCount === 0) {
      console.log('No invoices found to delete');
      return res.status(200).json({ 
        success: true,
        message: 'No invoices found to delete', 
        count: 0 
      });
    }
    
    console.log(`Successfully deleted ${result.deletedCount} invoices`);
    return res.status(200).json({ 
      success: true,
      message: 'All invoices deleted successfully', 
      count: result.deletedCount 
    });
    
  } catch (error) {
    console.error('Error deleting invoices:', error);
    
    if (res.headersSent) {
      console.error('Headers already sent, cannot send error response');
      return;
    }
    
    if (error.name === 'MongoError') {
      return res.status(503).json({
        success: false,
        message: 'Database error',
        error: error.message,
        code: error.code
      });
    }
    
    return res.status(500).json({ 
      success: false,
      message: 'Error al eliminar las facturas',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

router.delete('/test', (req, res) => {
  console.log('Test DELETE endpoint hit');
  res.status(200).json({ message: 'Test DELETE endpoint works' });
});

router.post('/', async (req, res) => {
  try {
    const { items, totalAmount } = req.body;
    if (!items || items.length === 0 || !totalAmount) {
      return res.status(400).json({ message: 'Invoice items and total amount are required.' });
    }
    const processedItems = [];
    let session;
    
    try {
      if (process.env.NODE_ENV !== 'test') {
        session = await mongoose.startSession();
        session.startTransaction();
      }
      for (const item of items) {
        console.log('Processing item:', JSON.stringify(item, null, 2)); // Debug log with pretty print
        let product;
        
        if (item.product) {
          console.log('Searching by ID:', item.product);
          product = await Product.findById(item.product);
          if (product) console.log('Found product by ID:', product.name);
        }
        
        if (!product && item.productSku) {
          console.log('Product not found by ID, trying by SKU:', item.productSku);
          product = await Product.findOne({ sku: item.productSku });
          if (product) console.log('Found product by SKU:', product.name);
        }
        
        if (!product && item.productName) {
          console.log('Product not found by SKU, trying by name:', item.productName);
          product = await Product.findOne({ name: item.productName });
          if (product) console.log('Found product by name');
        }
        
        if (!product) {
          if (session) {
            await session.abortTransaction();
            session.endSession();
          }
          
          const allProducts = await Product.find({});
          console.log('Available products:', allProducts.map(p => ({
            _id: p._id,
            sku: p.sku,
            name: p.name,
            sizes: p.sizes
          })));
          
          return res.status(404).json({ 
            message: `Producto no encontrado. SKU: ${item.productSku || 'N/A'}, ID: ${item.product || 'N/A'}`,
            productId: item.product,
            sku: item.productSku || 'N/A',
            error: 'PRODUCT_NOT_FOUND',
            searchedBy: {
              sku: item.productSku,
              id: item.product,
              name: item.productName
            }
          });
        }

        console.log('Processing stock update using ProductForm approach');
        
        const sizeIndex = product.sizes.findIndex(s => s.size === item.size);
        
        if (sizeIndex === -1) {
          const availableSizes = product.sizes.map(s => s.size);
          console.error(`Size not found. Available sizes: ${availableSizes.join(', ')}`);
          
          if (session) {
            await session.abortTransaction();
            session.endSession();
          }
          return res.status(400).json({ 
            message: `Tamaño no disponible para ${product.name}. Tamaño solicitado: ${item.size}`,
            productId: product._id,
            productName: product.name,
            size: item.size,
            availableSizes: availableSizes,
            error: 'SIZE_NOT_AVAILABLE'
          });
        }
        
        const currentQty = product.sizes[sizeIndex].quantity;
        const requestedQty = item.quantity;
        
        console.log('Stock validation (ProductForm style):', {
          product: product.name,
          size: item.size,
          currentStock: currentQty,
          requested: requestedQty,
          hasEnoughStock: currentQty >= requestedQty
        });
        
        if (currentQty < requestedQty) {
          if (session) {
            await session.abortTransaction();
            session.endSession();
          }
          return res.status(400).json({ 
            message: `Stock insuficiente para ${product.name}, talle ${item.size}.`,
            productId: product._id,
            productName: product.name,
            size: item.size,
            available: currentQty,
            requested: requestedQty,
            error: 'INSUFFICIENT_STOCK',
            details: {
              productId: product._id,
              sku: product.sku,
              size: item.size,
              availableQuantity: currentQty,
              requestedQuantity: requestedQty,
              timestamp: new Date().toISOString()
            }
          });
        }
        
        try {
          const updatedSizes = [...product.sizes];
          
          updatedSizes[sizeIndex] = {
            ...updatedSizes[sizeIndex],
            quantity: updatedSizes[sizeIndex].quantity - requestedQty
          };
          
          const newStock = updatedSizes.reduce((total, s) => total + (Number(s.quantity) || 0), 0);
          
          product.sizes = updatedSizes;
          product.stock = newStock;
          
          await product.save({ session });
          
          console.log('Stock updated successfully:', {
            product: product.name,
            size: item.size,
            oldQuantity: currentQty,
            newQuantity: updatedSizes[sizeIndex].quantity,
            totalStock: newStock
          });
          
        } catch (error) {
          console.error('Error updating stock:', error);
          if (session) {
            await session.abortTransaction();
            session.endSession();
          }
          return res.status(500).json({ 
            message: `Error al actualizar el stock: ${error.message}`,
            error: 'STOCK_UPDATE_ERROR'
          });
        }

        processedItems.push({
          ...item,
          product: product._id,
          productName: product.name,
          price: item.price || (product.price * (1 - (product.discount || 0) / 100))
        });
      }

      const newInvoice = new Invoice({
        invoiceNumber: await generateInvoiceNumber(),
        items: processedItems,
        totalAmount,
      });

      const savedInvoice = await newInvoice.save(session ? { session } : undefined);
      
      if (session) {
        await session.commitTransaction();
        session.endSession();
      }
      
      res.status(201).json(savedInvoice);
    } catch (error) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      throw error;
    }
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ 
      message: 'Server error while creating invoice.',
      error: error.message 
    });
  }
});
router.get('/', async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .sort({ createdAt: -1 })
      .populate('items.product', 'name sku');
    res.status(200).json(invoices);
  } catch (error) {
    res.status(500).json({ message: 'Server error while fetching invoices.' });
  }
});

module.exports = router;
