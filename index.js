import express from "express";
import { pool } from "./db.js";

const app = express();
const port = 3000;

app.get("/test/tenant-a", async (req, res) => {
  let client;
  try {
    client = await pool.connect();

    await client.query("SET search_path = 'tenant_a', 'public'");

    const result = await client.query("SELECT * FROM products");

    res.json({
      source: "Tenant A",
      data: result.rows,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    if (client) {
      client.release();
    }
  }
});

app.get("/test/tenant-b", async (req, res) => {
  let client;
  try {
    // 1. Pegar um cliente
    client = await pool.connect();

    // 2. A MÁGICA: Apontar para o outro schema
    await client.query("SET search_path = 'tenant_b', 'public'");

    // 3. A MESMA query de antes
    const result = await client.query("SELECT * FROM products");

    res.json({
      source: "Tenant B",
      data: result.rows,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    if (client) {
      client.release();
    }
  }
});

app.listen(port, () => {
  console.log(`Servidor de teste rodando em http://localhost:${port}`);
});
