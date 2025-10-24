import { pool } from "../db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from 'crypto';

// --- FUNÇÃO GENERATE TOKEN  ---
const generateToken = (userId, tenantId, schemaName, role, sessionId) => {
  const secret = process.env.JWT_SECRET || "apenas-um-teste-por-enquanto";

  return jwt.sign(
    {
      userId,
      tenantId,
      schema: schemaName,
      role: role,
      sessionId: sessionId // <-- A CHAVE PARA O LOGOUT
    },
    secret,
    { expiresIn: "8h" }
  );
};

// --- FUNÇÃO LOGIN ---
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email e senha são obrigatórios" });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("SET search_path = 'public'");
    await client.query('BEGIN');

    // 1. MODIFICAR A QUERY: Buscar 't.license_limit'
    const result = await client.query(
      `SELECT 
      u.id AS user_id, u.email, u.password_hash, u.role,
      t.id AS tenant_id, t.schema_name, t.status,
      t.license_limit -- <-- ADICIONADO
      FROM users u
      JOIN tenants t ON u.tenant_id = t.id
      WHERE u.email = $1`,
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }

    if (user.status === 'pending') {
      return res.status(401).json({ message: 'Sua conta ainda está aguardando aprovação.' });
    }

    // --- LÓGICA DE SESSÃO ---

    // 1. Checar limite de sessões
    const sessions = await client.query(
      "SELECT id FROM sessions WHERE tenant_id = $1",
      [user.tenant_id] // <-- MUDANÇA DE 'user.user_id' PARA 'user.tenant_id'
    );
    if (sessions.rows.length >= user.license_limit) {
      await client.query('ROLLBACK');
      // Mensagem de erro mais clara
      return res.status(403).json({
        message: `Limite de ${user.license_limit} sessões simultâneas atingido para sua empresa.`
      });
    }

    // 2. Criar a nova sessão no banco PRIMEIRO
    const sessionResult = await client.query(
      `INSERT INTO sessions (user_id, tenant_id, ip_address, user_agent) 
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [user.user_id, user.tenant_id, req.ip, req.headers['user-agent']]
    );
    const newSessionId = sessionResult.rows[0].id;

    // 3. Atualizar contador de login
    await client.query(
      'UPDATE public.users SET login_count = login_count + 1 WHERE id = $1',
      [user.user_id]
    );

    // 4. Gerar o token, agora incluindo o newSessionId
    const token = generateToken(
      user.user_id,
      user.tenant_id,
      user.schema_name,
      user.role,
      newSessionId
    );

    await client.query('COMMIT');

    res.status(200).json({
      message: "Login bem-sucedido!",
      token,
      user: { id: user.user_id, email: user.email, schema: user.schema_name, role: user.role },
    });

  } catch (error) {
    if (client) await client.query('ROLLBACK'); // Rollback em caso de erro
    console.error("ERRO CATASTRÓFICO no login:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  } finally {
    if (client) client.release();
  }
};

// --- FUNÇÃO REGISTER ---
export const register = async (req, res) => {
  const { tenantName, email, password } = req.body;
  if (!tenantName || !email || !password) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
  }

  // Usamos o pool principal, pois estamos escrevendo em 'public'
  const client = await pool.connect();

  try {
    await client.query('BEGIN'); // Iniciar transação

    // 1. Gerar um nome de schema único e seguro
    const schemaName = 'tenant_' + crypto.randomUUID().replace(/-/g, '_');
    // (ex: tenant_f8c3_4a0e_...)

    // 2. Criptografar a senha
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 3. Inserir o Tenant com status 'pending'
    const tenantResult = await client.query(
      `INSERT INTO public.tenants (name, subdomain, schema_name, status) 
       VALUES ($1, $2, $3, 'pending') 
       RETURNING id`,
      [tenantName, tenantName.toLowerCase().replace(/\s+/g, '-'), schemaName]
    );
    const newTenantId = tenantResult.rows[0].id;

    // 4. Inserir o Usuário
    await client.query(
      `INSERT INTO public.users (email, password_hash, tenant_id) 
       VALUES ($1, $2, $3)`,
      [email, passwordHash, newTenantId]
    );

    await client.query('COMMIT'); // Finalizar transação

    // AVISO: APROVAÇÃO PENDENTE
    // Aqui você pode adicionar a lógica para te enviar um email/notificação
    console.log(`NOVO REGISTRO PENDENTE: ${tenantName} (Schema: ${schemaName})`);

    res.status(201).json({
      message: 'Cadastro realizado com sucesso! Sua conta será ativada após aprovação.'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro no registro:', error);
    if (error.code === '23505') { // Email duplicado
      return res.status(409).json({ message: 'Este email já está em uso' });
    }
    res.status(500).json({ message: 'Erro interno no servidor' });
  } finally {
    if (client) client.release();
  }
};


// --- FUNÇÃO LOGOUT ---
export const logout = async (req, res) => {
  // 'protectSession' nos deu o 'req.user'
  
  // DEBUG 1: O que o middleware 'protectSession' nos enviou?
  console.log('--- TENTATIVA DE LOGOUT ---');
  console.log('Payload do token (req.user):', req.user);
  
  const sessionId = req.user.sessionId;

  if (!sessionId) {
    console.log('FALHA: O token não continha um "sessionId"');
    return res.status(400).json({ message: 'Token inválido sem ID de sessão' });
  }

  console.log(`Tentando deletar sessão com ID: ${sessionId}`);

  let client;
  try {
    client = await pool.connect(); 
    await client.query("SET search_path = public"); 
    
    console.log('Conectado ao DB e search_path = public. Executando DELETE...');

    // A MUDANÇA: Adicionamos 'RETURNING *'
    // Isso nos diz o que foi deletado.
    const result = await client.query(
      "DELETE FROM sessions WHERE id = $1 RETURNING *", 
      [sessionId]
    );

    // DEBUG 2: O DELETE funcionou?
    if (result.rowCount > 0) {
      console.log('SUCESSO: Sessão deletada do banco:', result.rows[0]);
      res.status(200).json({ message: 'Logout bem-sucedido' });
    } else {
      console.log('AVISO: Nenhuma sessão foi encontrada no banco com esse ID.');
      // Enviamos 200 OK de qualquer forma, pois o usuário está "deslogado"
      res.status(200).json({ message: 'Sessão não encontrada, mas deslogado localmente.' });
    }
  
  } catch (error) {
    console.error('ERRO CATASTRÓFICO no logout:', error);
    res.status(500).json({ message: 'Erro interno no servidor' });
  
  } finally {
    if (client) client.release(); 
    console.log('Cliente de logout liberado.');
  }
};