import { pool } from "../db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// ... (função generateToken fica igual) ...
const generateToken = (userId, tenantId, schemaName) => {
  const secret = process.env.JWT_SECRET || "apenas-um-teste-por-enquanto";

  return jwt.sign(
    {
      userId,
      tenantId,
      schema: schemaName,
    },
    secret,
    { expiresIn: "8h" }
  );
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  // --- DEBUG 1: O QUE A API REALMENTE RECEBEU? ---
  console.log("\n--- NOVA TENTATIVA DE LOGIN ---");
  console.log(`Email recebido: [${email}]`);
  console.log(`Senha recebida: [${password}]`);
  // (Os colchetes [] nos ajudam a ver espaços em branco)
  // ------------------------------------------------

  if (!email || !password) {
    return res.status(400).json({ message: "Email e senha são obrigatórios" });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("SET search_path = 'public'");

    const result = await client.query(
      `SELECT 
         u.id AS user_id, 
         u.email, 
         u.password_hash, 
         t.id AS tenant_id, 
         t.schema_name
       FROM users u
       JOIN tenants t ON u.tenant_id = t.id
       WHERE u.email = $1`,
      [email] // O email recebido é usado aqui
    );

    const user = result.rows[0];

    // --- DEBUG 2: O USUÁRIO FOI ENCONTRADO? ---
    console.log("Usuário encontrado no BD:", user); // Deve mostrar o objeto do usuário, não 'undefined'
    // ------------------------------------------------

    if (!user) {
      console.log("FALHA: Usuário não encontrado no banco com esse email.");
      return res.status(401).json({ message: "Credenciais inválidas" });
    }

    // --- DEBUG 3: COMPARAÇÃO DA SENHA ---
    console.log("Hash do BD para comparar:", user.password_hash);
    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password_hash
    );

    console.log("A senha está correta (bcrypt.compare):", isPasswordCorrect); // Deve ser 'true'
    // ------------------------------------------------

    if (!isPasswordCorrect) {
      console.log("FALHA: A senha (bcrypt.compare) não bateu com o hash.");
      return res.status(401).json({ message: "Credenciais inválidas" });
    }

    // Se chegou aqui, funcionou!
    console.log("SUCESSO: Login validado.");
    const token = generateToken(user.user_id, user.tenant_id, user.schema_name);

    res.status(200).json({
      message: "Login bem-sucedido!",
      token,
      user: { id: user.user_id, email: user.email, schema: user.schema_name },
    });
  } catch (error) {
    console.error("ERRO CATASTRÓFICO no try/catch:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  } finally {
    if (client) client.release();
  }
};
