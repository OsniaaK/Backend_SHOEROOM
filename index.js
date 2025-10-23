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
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} from origin: ${req.headers.origin}`);
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
  if (err.message === 'Not allowed by CORS') {
    console.error('CORS Error:', err.message);
    return res.status(403).json({ message: 'Forbidden: CORS policy does not allow access from this origin.' });
  }
  
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