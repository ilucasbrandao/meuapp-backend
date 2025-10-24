import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

// Função de proteção genérica que verifica token E sessão
export const protectSession = (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Não autorizado, token não encontrado' });
  }

  try {
    // 1. Verificar o token (não mexe no banco)
    const secret = process.env.JWT_SECRET || 'apenas-um-teste-por-enquanto';
    const decoded = jwt.verify(token, secret);

    // 2. Anexar dados ao 'req'
    req.user = decoded; // Contém { userId, role, schema, sessionId }
    next();

  } catch (error) {
    // Ex: 'invalid signature' ou 'jwt expired'
    return res.status(401).json({ message: 'Não autorizado, token inválido' });
  }
};


// Este middleware libera o cliente que o *controller* usou
export const releaseClient = (req, res, next) => {
  if (req.dbClient) {
    req.dbClient.release();
  }
  next();
};