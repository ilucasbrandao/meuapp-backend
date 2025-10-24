import { Router } from "express";
import { login, register, logout } from "../controllers/auth.controller.js";
import { protectSession, releaseClient } from '../middlewares/auth.middleware.js'

const router = Router();

router.post("/login", login);
router.post('/register', register);
router.post('/logout', protectSession, logout);

export default router;
