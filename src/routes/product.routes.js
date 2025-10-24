import { Router } from 'express';
import { getProducts, createProduct } from '../controllers/product.controller.js';
import { protectSession } from '../middlewares/auth.middleware.js';
import { setTenantPath } from '../middlewares/tenant.middleware.js';

const router = Router();

router.route('/')
  .get(protectSession, setTenantPath, getProducts)
  .post(protectSession, setTenantPath, createProduct);

export default router;