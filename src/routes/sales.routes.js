import { Router } from "express";
import { createSaleOrder } from "../controllers/sales.controller.js";
import { protectSession } from "../middlewares/auth.middleware.js";
import { setTenantPath } from "../middlewares/tenant.middleware.js";

const router = Router();

// Aplica middlewares para todas as rotas de vendas
router.use(protectSession, setTenantPath);

// Rota para criar uma nova venda
router.post("/", createSaleOrder);

export default router;
