export const getProducts = async (req, res) => {
  try {
    const result = await req.dbClient.query("SELECT * FROM products");

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar produtos:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const createProduct = async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: "O nome é obrigatório" });
  }

  try {
    const result = await req.dbClient.query(
      "INSERT INTO products (name) VALUES ($1) RETURNING *",
      [name]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao criar produto:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};
