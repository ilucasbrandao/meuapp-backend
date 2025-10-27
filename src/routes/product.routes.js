import { Router } from "express";
import {
  getProducts,
  createProduct,
  getProductById,
  updateProduct,
  deleteProduct,
} from "../controllers/product.controller.js";
import { protectSession } from "../middlewares/auth.middleware.js";
import { setTenantPath } from "../middlewares/tenant.middleware.js";

const router = Router();

// Aplica os middlewares a TODAS as rotas de produtos
router.use(protectSession, setTenantPath);
router.route("/").get(getProducts).post(createProduct);

router
  .route("/:id")
  .get(getProductById)
  .put(updateProduct)
  .delete(deleteProduct);

export default router;
