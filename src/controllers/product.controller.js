export const getProducts = async (req, res) => {
  const client = req.dbClient; // Pega o cliente do middleware
  try {
    const result = await client.query('SELECT * FROM products');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({ message: 'Erro interno no servidor' });
  } finally {
    if (client) client.release(); // <-- Garante a liberação
  }
};

export const createProduct = async (req, res) => {
  const client = req.dbClient; // Pega o cliente
  const { name } = req.body;

  if (!name) {
    if (client) client.release(); // <-- Libera mesmo se falhar na validação
    return res.status(400).json({ message: 'O nome é obrigatório' });
  }

  try {
    const result = await client.query(
      'INSERT INTO products (name) VALUES ($1) RETURNING *',
      [name]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    res.status(500).json({ message: 'Erro interno no servidor' });
  } finally {
    if (client) client.release(); // <-- Garante a liberação
  }
};
