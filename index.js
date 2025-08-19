const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const productsRoutes = require("./routes/products");

const app = express();
const PORT = process.env.PORT || 4000;
app.use(cors());
app.use(express.json());
app.use("/api/products", productsRoutes);
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