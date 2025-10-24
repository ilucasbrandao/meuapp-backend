import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

export const protectAdmin = async (req, res, next) => {
  // req.user foi nos dado pelo 'protectSession'
  const { role, sessionId } = req.user; 
  let client;

  if (role !== 'admin') {
    return res.status(403).json({ message: 'Acesso negado. Rota de administrador.' });
  }
  if (!sessionId) {
     return res.status(401).json({ message: 'Token inválido (sem ID de sessão)' });
  }

  try {
    // 1. Alugar o ÚNICO cliente
    client = await pool.connect();
    
    // 2. Apontar para 'public' (e validar a sessão)
    await client.query("SET search_path = public");
    const sessionResult = await client.query("SELECT id FROM sessions WHERE id = $1", [sessionId]);
    
    if (sessionResult.rows.length === 0) {
      if (client) client.release();
      return res.status(401).json({ message: 'Sessão expirada ou inválida' });
    }

    // 3. Atualizar "visto por último"
    client.query("UPDATE sessions SET last_seen = NOW() WHERE id = $1", [sessionId]);
    
    // 4. Passar o cliente PRONTO (já está em 'public')
    req.dbClient = client;

    next(); // Passa para o controller (ex: getAllTenants)

  } catch (error) {
    console.error('Erro ao configurar admin:', error);
    if (client) client.release();
    return res.status(500).json({ message: 'Erro interno ao configurar o admin' });
  }
};