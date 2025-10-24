import { Router } from 'express';
import { getCustomers, createCustomer } from '../controllers/customer.controller.js';

// Importe os middlewares separados
import { protectSession } from '../middlewares/auth.middleware.js';
import { setTenantPath } from '../middlewares/tenant.middleware.js';

const router = Router();

// A Nova Cadeia de Middlewares:
// 1. protectSession: Valida o token E a sessão (lê de 'public')
// 2. setTenantPath: Aluga um novo cliente e define o 'search_path' (lê do schema 'tenant_x')
// 3. getCustomers / createCustomer: Executa a lógica de negócios
// 4. releaseClient: Libera o cliente que o 'setTenantPath' alugou

router.route('/')
  .get(protectSession, setTenantPath, getCustomers)
  .post(protectSession, setTenantPath, createCustomer);

export default router;