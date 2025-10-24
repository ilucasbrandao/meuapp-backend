import { Router } from 'express';
import { getAllTenants, approveTenant, setTenantStatus, getActiveSessions } from '../controllers/admin.controller.js';
import { protectAdmin } from '../middlewares/admin.middleware.js';
import {  protectSession } from '../middlewares/auth.middleware.js'; // Vamos reusar o 'releaseClient'

const router = Router();

// Todas as rotas aqui são protegidas pelo 'protectAdmin'
router.use(protectSession, protectAdmin);
router.get('/tenants', getAllTenants);
router.post('/tenants/:tenantId/approve', approveTenant); // Libera o client após 'approve'
router.put('/tenants/:tenantId/status', setTenantStatus);
router.get('/sessions/active', getActiveSessions);

export default router;