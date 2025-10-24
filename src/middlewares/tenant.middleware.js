import { pool } from '../db.js';

// Este middleware roda DEPOIS do 'protectSession'
export const setTenantPath = async (req, res, next) => {
  // req.user foi nos dado pelo 'protectSession'
  const { schema, sessionId } = req.user; 
  let client;

  if (!schema || !sessionId) {
    return res.status(401).json({ message: 'Token inválido (sem schema ou ID de sessão)' });
  }

  try {
    // 1. Alugar o ÚNICO cliente
    client = await pool.connect();
    
    // 2. Apontar para 'public' para validar a sessão
    await client.query("SET search_path = public");
    const sessionResult = await client.query("SELECT id FROM sessions WHERE id = $1", [sessionId]);
    
    if (sessionResult.rows.length === 0) {
      if (client) client.release(); // Sessão não existe, liberar cliente
      return res.status(401).json({ message: 'Sessão expirada ou inválida' });
    }

    // 3. Atualizar "visto por último" (em 'public')
    client.query("UPDATE sessions SET last_seen = NOW() WHERE id = $1", [sessionId]);

    // 4. A MÁGICA: Mudar o cliente para o schema do tenant
    await client.query(`SET search_path = ${client.escapeIdentifier(schema)}, public`);
    
    // 5. Passar o cliente PRONTO para o controller
    req.dbClient = client;

    next(); // Passa para o controller (ex: getCustomers)

  } catch (error) {
    console.error(`Erro ao definir search_path para ${schema}:`, error);
    if (client) client.release();
    return res.status(500).json({ message: 'Erro interno ao configurar o tenant' });
  }
};