const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const productsRoutes = require("./routes/products");
const invoicesRoutes = require("./routes/invoices");

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = [
  'https://shoeroomstore.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  console.log(`Incoming ${req.method} request to ${req.path} from origin:`, origin);

  if (process.env.NODE_ENV === 'development' || allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
    if (req.method === 'OPTIONS') {
      console.log('Handling OPTIONS preflight request for path:', req.path);
      res.header('Access-Control-Max-Age', '86400');
      return res.status(204).end();
    }
  } else {
    console.warn('Blocked request from unauthorized origin:', origin);
  }
  next();
});
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.log('Headers:', req.headers);
  next();
});

const handleRoute = (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  if (req.path.endsWith('/') && req.path.length > 1) {
    const query = req.url.slice(req.path.length);
    const newPath = req.path.slice(0, -1) + query;
    return res.redirect(301, newPath);
  }
  next();
};

app.use(handleRoute);

app.use("/api/products", productsRoutes);
app.use("/api/invoices", invoicesRoutes);

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