import { Router } from 'express';
import { getCustomers, createCustomer } from '../controllers/customer.controller.js';
import { protectAndSetTenant, releaseClient } from '../middlewares/auth.middleware.js';

const router = Router();

// Exatamente o mesmo padrão de "products"
router.route('/')
  .get(protectAndSetTenant, getCustomers, releaseClient)
  .post(protectAndSetTenant, createCustomer, releaseClient);

export default router;