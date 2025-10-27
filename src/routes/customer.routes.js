import { Router } from 'express';
import { 
    getCustomers, 
    createCustomer, 
    getCustomerById,  // <-- Importar
    updateCustomer,   // <-- Importar
    deleteCustomer    // <-- Importar
} from '../controllers/customer.controller.js';

import { protectSession } from '../middlewares/auth.middleware.js';
import { setTenantPath } from '../middlewares/tenant.middleware.js';

const router = Router();

// Middlewares: 
const tenantMiddlewareChain = [protectSession, setTenantPath];

// Rota 1: / (Listar e Criar)
router.route('/')
    .get(tenantMiddlewareChain, getCustomers)
    .post(tenantMiddlewareChain, createCustomer);

// Rota 2: /:id (Visualizar 1, Atualizar e Excluir)
router.route('/:id') // <-- ESTE É O BLOCO QUE FALTAVA
    .get(tenantMiddlewareChain, getCustomerById)    // GET /customers/123-xyz
    .put(tenantMiddlewareChain, updateCustomer)    // PUT /customers/123-xyz
    .delete(tenantMiddlewareChain, deleteCustomer); // DELETE /customers/123-xyz


export default router;