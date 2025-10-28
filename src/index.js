import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Importação das rotas
import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import customerRoutes from "./routes/customer.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import salesRoutes from "./routes/sales.routes.js";

// Carrega o .env
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middlewares globais
// Configuração do CORS
const corsOptions = {
  origin: "http://localhost:5173",
};
app.use(cors(corsOptions));
app.use(express.json()); // Para ler JSON no body

// Rotas da API
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/products", productRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/sales", salesRoutes);

// Rotas de teste (pode remover ou manter)
app.get("/", (req, res) => {
  res.send("API Multi-Tenant (Schema-per-Tenant) rodando! 🚀");
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
