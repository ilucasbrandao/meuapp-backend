import { Router } from "express";
import {
  getProducts,
  createProduct,
} from "../controllers/product.controller.js";
import {
  protectAndSetTenant,
  releaseClient,
} from "../middlewares/auth.middleware.js";

const router = Router();

// Sequência de execução:
// 1. 'protectAndSetTenant' (verifica token, SETA O SEARCH_PATH)
// 2. 'getProducts' (executa a query genérica)
// 3. 'releaseClient' (libera a conexão)
router
  .route("/")
  .get(protectAndSetTenant, getProducts, releaseClient)
  .post(protectAndSetTenant, createProduct, releaseClient);

export default router;
