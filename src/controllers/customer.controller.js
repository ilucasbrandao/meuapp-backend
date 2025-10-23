export const getCustomers = async (req, res) => {
  try {
    const result = await req.dbClient.query('SELECT * FROM customers ORDER BY name ASC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({ message: 'Erro interno no servidor' });
  }
};

export const createCustomer = async (req, res) => {
  const { name, email, phone } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'O nome é obrigatório' });
  }

  try {
    const result = await req.dbClient.query(
      'INSERT INTO customers (name, email, phone) VALUES ($1, $2, $3) RETURNING *',
      [name, email, phone]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    res.status(500).json({ message: 'Erro interno no servidor' });
  }
};