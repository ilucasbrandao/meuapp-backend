import jwt from "jsonwebtoken";
import { pool } from "../db.js";

export const protectAndSetTenant = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res
      .status(401)
      .json({ message: "Não autorizado, token não encontrado" });
  }

  let client;

  try {
    // 1. Verificar o token
    const secret = process.env.JWT_SECRET || "apenas-um-teste-por-enquanto";
    const decoded = jwt.verify(token, secret);

    // 2. Extrair o 'schema' do payload do token
    const schemaName = decoded.schema;
    if (!schemaName) {
      return res
        .status(401)
        .json({ message: "Token inválido, schema não encontrado" });
    }

    // 3. FAZER EXATAMENTE O QUE VOCÊ FEZ NO TESTE:
    // Alugar uma conexão do pool
    client = await pool.connect();

    await client.query(
      `SET search_path = ${client.escapeIdentifier(schemaName)}, public`
    );

    req.dbClient = client;

    req.user = {
      id: decoded.userId,
      tenantId: decoded.tenantId,
      schema: decoded.schema,
    };

    next();
  } catch (error) {
    console.error("Erro no middleware de auth:", error);

    if (client) client.release();
    return res.status(401).json({ message: "Não autorizado, token inválido" });
  }
};

export const releaseClient = (req, res, next) => {
  if (req.dbClient) {
    req.dbClient.release();
    console.log(`Cliente do schema ${req.user?.schema} liberado.`);
  }
  next();
};
