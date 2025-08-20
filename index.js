const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const productsRoutes = require("./routes/products");
const invoicesRoutes = require("./routes/invoices");

const app = express();
const PORT = process.env.PORT || 4000;

// Configuración CORS
const allowedOrigins = [
  'https://shoeroomstore.vercel.app',
  'http://localhost:5173'
];

// Middleware CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Si el origen está en la lista blanca, lo permitimos
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
    
    // Manejar preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
  }
  
  next();
});
app.use(express.json());
app.use("/api/products", productsRoutes);
app.use("/api/invoices", invoicesRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ An unexpected error occurred:', err);
  res.status(500).json({ message: 'An internal server error occurred.' });
});

mongoose.connect(process.env.MONGO_URI ||"mongodb://localhost:27017/shoeroom")
.then(() => {
  console.log("✅ Conectado a MongoDB exitosamente");
  app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
})
.catch((err) => {
  console.error("❌ Error de conexión a MongoDB:", err);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});