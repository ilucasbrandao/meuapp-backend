// GET /products (Listar produtos com paginação, busca e ordenação)
export const getProducts = async (req, res) => {
  const client = req.dbClient;

  try {
    const {
      q = "",
      page = 1,
      limit = 10,
      sortBy = "name",
      order = "asc",
    } = req.query;

    // Adiciona TODOS os campos relevantes para ordenação
    const validSortFieldsMap = {
      // Usando um map para segurança
      name: "name",
      sku: "sku",
      category: "category",
      unit_of_measure: "unit_of_measure",
      price_cents: "price_cents",
      cost_price_cents: "cost_price_cents",
      stock_quantity: "stock_quantity",
      status: "status",
      created_at: "created_at",
    };
    const validOrder = ["asc", "desc"];
    const sortColumn = validSortFieldsMap[sortBy] || "name"; // Padrão 'name'
    const sortOrder = validOrder.includes(order.toLowerCase())
      ? order.toUpperCase()
      : "ASC";

    const offset = (Number(page) - 1) * Number(limit);
    const searchTerm = `%${q}%`;

    // Busca por Nome OU SKU OU Categoria
    const whereClause = `WHERE (name ILIKE $1 OR sku ILIKE $1 OR category ILIKE $1)`;

    const dataQuery = ` SELECT * FROM products ${whereClause} ORDER BY ${sortColumn} ${sortOrder} LIMIT $2 OFFSET $3 `;
    const countQuery = ` SELECT COUNT(*) FROM products ${whereClause} `;

    const [dataResult, countResult] = await Promise.all([
      client.query(dataQuery, [searchTerm, Number(limit), offset]),
      client.query(countQuery, [searchTerm]),
    ]);

    return res.json({
      data: dataResult.rows,
      total: Number(countResult.rows[0].count),
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    console.error("Erro ao buscar produtos:", error);
    return res
      .status(500)
      .json({ message: "Erro interno no servidor ao buscar produtos" });
  } finally {
    if (client) client.release();
  }
};

// POST /products (Criar novo produto - COM TODOS OS CAMPOS)
export const createProduct = async (req, res) => {
  const client = req.dbClient;
  const {
    name,
    sku,
    category,
    unit_of_measure,
    price_cents,
    cost_price_cents,
    stock_quantity,
    status,
    description,
  } = req.body;

  // --- Validações ---
  if (!name || typeof name !== "string" || name.trim().length < 3) {
    return res
      .status(400)
      .json({ message: "Nome é obrigatório (mínimo 3 caracteres)" });
  }
  if (
    price_cents === undefined ||
    typeof price_cents !== "number" ||
    price_cents < 0 ||
    !Number.isInteger(price_cents)
  ) {
    return res
      .status(400)
      .json({ message: "Preço de Venda inválido (centavos não-negativos)" });
  }
  if (
    cost_price_cents === undefined ||
    typeof cost_price_cents !== "number" ||
    cost_price_cents < 0 ||
    !Number.isInteger(cost_price_cents)
  ) {
    return res
      .status(400)
      .json({ message: "Preço de Custo inválido (centavos não-negativos)" });
  }
  if (
    stock_quantity === undefined ||
    typeof stock_quantity !== "number" ||
    stock_quantity < 0 ||
    !Number.isInteger(stock_quantity)
  ) {
    return res
      .status(400)
      .json({ message: "Estoque inválido (inteiro não-negativo)" });
  }
  if (!unit_of_measure) {
    return res
      .status(400)
      .json({ message: "Unidade de Medida é obrigatória." });
  } // Tornando obrigatório
  if (status && !["active", "inactive"].includes(status)) {
    return res
      .status(400)
      .json({ message: 'Status inválido. Use "active" ou "inactive".' });
  }

  try {
    const result = await client.query(
      `INSERT INTO products (
                name, sku, category, unit_of_measure, price_cents,
                cost_price_cents, stock_quantity, status, description
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        name.trim(),
        sku || null,
        category || null,
        unit_of_measure,
        price_cents,
        cost_price_cents,
        stock_quantity,
        status || "active",
        description || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505" && error.constraint?.includes("sku")) {
      return res
        .status(409)
        .json({ message: `O SKU "${sku}" já está em uso.` });
    }
    console.error("Erro ao criar produto:", error);
    res
      .status(500)
      .json({ message: "Erro interno no servidor ao criar produto" });
  } finally {
    if (client) client.release();
  }
};

// GET /products/:id (Buscar produto por ID - Valida ID numérico)
export const getProductById = async (req, res) => {
  const client = req.dbClient;
  const { id } = req.params;

  if (!id || typeof id !== "string" || !/^\d+$/.test(id)) {
    return res
      .status(400)
      .json({ message: "ID do produto inválido (deve ser numérico)" });
  }

  try {
    const result = await client.query("SELECT * FROM products WHERE id = $1", [
      id,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Produto não encontrado" });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Erro ao buscar produto ${id}:`, error);
    res.status(500).json({ message: "Erro interno ao buscar produto" });
  } finally {
    if (client) client.release();
  }
};

// PUT /products/:id (Atualizar produto existente - COM TODOS OS CAMPOS e Valida ID numérico)
export const updateProduct = async (req, res) => {
  const client = req.dbClient;
  const { id } = req.params;
  const {
    name,
    sku,
    category,
    unit_of_measure,
    price_cents,
    cost_price_cents,
    stock_quantity,
    status,
    description,
  } = req.body;

  // --- Validações ---
  if (!id || typeof id !== "string" || !/^\d+$/.test(id)) {
    return res.status(400).json({ message: "ID inválido" });
  }
  if (!name || typeof name !== "string" || name.trim().length < 3) {
    return res.status(400).json({ message: "Nome inválido" });
  }
  if (
    price_cents === undefined ||
    typeof price_cents !== "number" ||
    price_cents < 0 ||
    !Number.isInteger(price_cents)
  ) {
    return res.status(400).json({ message: "Preço de Venda inválido" });
  }
  if (
    cost_price_cents === undefined ||
    typeof cost_price_cents !== "number" ||
    cost_price_cents < 0 ||
    !Number.isInteger(cost_price_cents)
  ) {
    return res.status(400).json({ message: "Preço de Custo inválido" });
  }
  if (
    stock_quantity === undefined ||
    typeof stock_quantity !== "number" ||
    stock_quantity < 0 ||
    !Number.isInteger(stock_quantity)
  ) {
    return res.status(400).json({ message: "Estoque inválido" });
  }
  if (!unit_of_measure) {
    return res
      .status(400)
      .json({ message: "Unidade de Medida é obrigatória." });
  }
  if (status && !["active", "inactive"].includes(status)) {
    return res.status(400).json({ message: "Status inválido." });
  }

  try {
    const result = await client.query(
      `UPDATE products SET
                name = $1, sku = $2, category = $3, unit_of_measure = $4, price_cents = $5,
                cost_price_cents = $6, stock_quantity = $7, status = $8, description = $9
             WHERE id = $10 RETURNING *`,
      [
        name.trim(),
        sku || null,
        category || null,
        unit_of_measure,
        price_cents,
        cost_price_cents,
        stock_quantity,
        status || "active",
        description || null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Produto não encontrado para atualização" });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505" && error.constraint?.includes("sku")) {
      return res
        .status(409)
        .json({ message: `O SKU "${sku}" já está em uso por outro produto.` });
    }
    console.error(`Erro ao atualizar produto ${id}:`, error);
    res.status(500).json({ message: "Erro interno ao atualizar produto" });
  } finally {
    if (client) client.release();
  }
};

// DELETE /products/:id (Valida ID numérico)
export const deleteProduct = async (req, res) => {
  const client = req.dbClient;
  const { id } = req.params;

  if (!id || typeof id !== "string" || !/^\d+$/.test(id)) {
    return res.status(400).json({ message: "ID inválido" });
  }

  try {
    const result = await client.query(
      "DELETE FROM products WHERE id = $1 RETURNING id",
      [id]
    );
    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ message: "Produto não encontrado para exclusão" });
    }
    return res.status(204).send();
  } catch (error) {
    console.error(`Erro ao excluir produto ${id}:`, error);
    res.status(500).json({ message: "Erro interno ao excluir produto" });
  } finally {
    if (client) client.release();
  }
};
