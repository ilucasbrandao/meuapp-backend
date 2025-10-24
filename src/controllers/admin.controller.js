// src/controllers/admin.controller.js
import fs from 'fs/promises';
import path from 'path';

// Listar todos os tenants (para a sua tela)
export const getAllTenants = async (req, res) => {
  const client = req.dbClient; // Pega o cliente do middleware
  try {
    const result = await client.query(
      `SELECT t.id, t.name, t.schema_name, t.status, 
              (SELECT email FROM users u WHERE u.tenant_id = t.id LIMIT 1) as admin_email,
              (SELECT login_count FROM users u WHERE u.tenant_id = t.id LIMIT 1) as login_count
       FROM tenants t
       ORDER BY t.created_at DESC`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar tenants:', error);
    res.status(500).json({ message: 'Erro interno no servidor' });
  } finally {
    if (client) client.release(); // <-- Garante a liberação
  }
};

// Aprovar um tenant (o que você pediu)
export const approveTenant = async (req, res) => {
  const client = req.dbClient; // Reusa o cliente do middleware
  const { tenantId } = req.params;
  
  try {
    await client.query('BEGIN');
    
    // 1. Achar o tenant
    const r = await client.query("SELECT schema_name, status FROM tenants WHERE id = $1", [tenantId]);
    const tenant = r.rows[0];
    if (!tenant) return res.status(404).json({ message: 'Tenant não encontrado' });
    if (tenant.status === 'active') return res.status(400).json({ message: 'Tenant já está ativo' });

    const { schema_name } = tenant;
    
    // 2. Criar o Schema
    await client.query(`CREATE SCHEMA ${client.escapeIdentifier(schema_name)}`);
    
    // 3. Apontar para o novo Schema para criar as tabelas
    await client.query(`SET search_path = ${client.escapeIdentifier(schema_name)}, public`);

    // 4. Ler e executar o template SQL
    const templatePath = path.join(process.cwd(), 'schema_template.sql');
    const templateSql = await fs.readFile(templatePath, 'utf-8');
    await client.query(templateSql);
    
    // 5. Ativar o Tenant
    await client.query("UPDATE tenants SET status = 'active' WHERE id = $1", [tenantId]);
    await client.query('COMMIT');

    res.status(200).json({ message: `Tenant ${schema_name} aprovado e ativado!` });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Falha ao aprovar tenant ${tenantId}:`, error);
    res.status(500).json({ message: 'Falha ao aprovar tenant', error: error.message });
  } finally {
    if (client) client.release(); // <-- Garante a liberação
  }
};

// Bloquear / Desativar (para não renovação)
export const setTenantStatus = async (req, res) => {
  const client = req.dbClient; // Pega o cliente
  const { tenantId } = req.params;
  const { status } = req.body; 

  if (!status) {
    if (client) client.release(); // <-- Libera se falhar na validação
    return res.status(400).json({ message: 'Status é obrigatório' });
  }

  try {
    await client.query(
      "UPDATE tenants SET status = $1 WHERE id = $2", 
      [status, tenantId]
    );
    res.status(200).json({ message: `Status do tenant atualizado para ${status}` });
  } catch (error) {
    console.error('Erro ao atualizar status do tenant:', error);
    res.status(500).json({ message: 'Erro interno no servidor' });
  } finally {
    if (client) client.release(); // <-- Garante a liberação
  }
};

// Buscar sessões ativas
export const getActiveSessions = async (req, res) => {
  const client = req.dbClient; // Pega o cliente
  try {
    const result = await client.query(
      `SELECT s.id, s.last_seen, u.email, t.name as tenant_name
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       JOIN tenants t ON s.tenant_id = t.id
       WHERE s.last_seen > (NOW() - INTERVAL '5 minutes')
       ORDER BY s.last_seen DESC`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar sessões ativas:', error);
    res.status(500).json({ message: 'Erro ao buscar sessões ativas' });
  } finally {
    if (client) client.release(); // <-- Garante a liberação
  }
};