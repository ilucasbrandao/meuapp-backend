import {createCustomerSchema} from '../validations/customerSchema.js'

export const getCustomers = async (req, res) => {
  const client = req.dbClient; // Pega o cliente do middleware
  try {
    const result = await client.query('SELECT * FROM customers ORDER BY name ASC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({ message: 'Erro interno no servidor' });
  } finally {
    if (client) client.release(); // <-- A MUDANÇA IMPORTANTE
  }
};

export const createCustomer = async (req, res) => {
  // Apenas usa o cliente que o middleware já configurou e anexou
  const client = req.dbClient; 

  try {
    // 1. VALIDAR e obter os dados (usando o schema de validação que definimos antes)
    const validatedData = createCustomerSchema.parse(req.body);

    // 2. Desestruturar todos os campos
    const {
        name, email, phone, document_type, document_number, birth_date, 
        status, address_zip_code, address_street, address_number, 
        address_complement, address_neighborhood, address_city, address_state, notes
    } = validatedData;

    // 3. Array de valores (convertendo strings vazias para NULL)
    const values = [
        name, email || null, phone || null, document_type || null, 
        document_number || null, birth_date || null, status, 
        address_zip_code || null, address_street || null, address_number || null, 
        address_complement || null, address_neighborhood || null, address_city || null, 
        address_state || null, notes || null
    ];
    
    // 4. Query SQL completa com 15 parâmetros
    const queryText = `
      INSERT INTO customers (
        name, email, phone, document_type, document_number, birth_date, status,
        address_zip_code, address_street, address_number, address_complement,
        address_neighborhood, address_city, address_state, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      )
      RETURNING *; 
    `;

    const result = await client.query(queryText, values);

    res.status(201).json(result.rows[0]);

  } catch (error) {
    
    // Tratamento de erro do Zod (se a validação falhar)
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Dados inválidos', details: error.flatten() });
    }

    // Tratamento de erro do banco (ex: violação de unique constraint 23505)
    if (error.code === '23505') {
        return res.status(409).json({ message: 'Este documento (CPF/CNPJ) já foi cadastrado.' });
    }

    console.error('Erro ao criar cliente:', error);
    // Não libere o cliente aqui, deixe o middleware 'finish' fazer isso
    res.status(500).json({ message: 'Erro interno no servidor' });
  }
};

export const getCustomerById = async (req, res) => {
  const client = req.dbClient; 
  const { id } = req.params; // Pega o ID do cliente da URL

  try {
    const result = await client.query('SELECT * FROM customers WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      // Se não encontrar o cliente (ou se o ID pertencer a outro tenant)
      return res.status(404).json({ message: 'Cliente não encontrado.' });
    }
    
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Erro ao buscar cliente ID ${id}:`, error);
    res.status(500).json({ message: 'Erro interno no servidor' });
  }
};

export const updateCustomer = async (req, res) => {
  const client = req.dbClient; 
  const { id } = req.params; // ID do cliente a ser atualizado

  try {
    // 1. VALIDAR e obter os dados
    const validatedData = createCustomerSchema.partial().parse(req.body);
        
    // 2. Filtrar apenas os campos que vieram no body e converter '' para NULL
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    // Mapeamento de campos do body para colunas SQL
    const dataToUpdate = validatedData;
    
    for (const key in dataToUpdate) {
        if (Object.prototype.hasOwnProperty.call(dataToUpdate, key)) {
            let value = dataToUpdate[key];
            
            // Converte string vazia para NULL (essencial)
            if (value === '') {
                value = null;
            }
            
            // Ignorar campos que não precisam ser atualizados se forem null/undefined,
            // a menos que o valor venha explicitamente como '' (já convertido para null).
            if (value !== undefined) {
                fields.push(`${key} = $${paramIndex}`);
                values.push(value);
                paramIndex++;
            }
        }
    }

    // Se não houver campos para atualizar (corpo vazio ou inválido)
    if (fields.length === 0) {
      return res.status(400).json({ message: 'Nenhum campo válido para atualização fornecido.' });
    }
    
    // 3. Adicionar o ID do cliente para a cláusula WHERE
    values.push(id); 
    const idIndex = paramIndex;

    // 4. Construir a query
    const queryText = `
      UPDATE customers 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${idIndex} 
      RETURNING *;
    `;
    
    const result = await client.query(queryText, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Cliente não encontrado para atualização.' });
    }

    res.status(200).json(result.rows[0]);

  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Dados inválidos na atualização', details: error.flatten() });
    }
    // Tratamento de erro de violação de unique constraint (documento duplicado)
    if (error.code === '23505') { 
        return res.status(409).json({ message: 'Outro cliente já possui este CPF/CNPJ.' });
    }
    
    console.error(`Erro ao atualizar cliente ID ${id}:`, error);
    res.status(500).json({ message: 'Erro interno no servidor' });
  }
};

export const deleteCustomer = async (req, res) => {
  const client = req.dbClient; 
  const { id } = req.params;
  
  try {
    const result = await client.query('DELETE FROM customers WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      // Se não encontrou para deletar, ou ele não pertence ao tenant
      return res.status(404).json({ message: 'Cliente não encontrado para exclusão.' });
    }
    
    // Resposta 204 indica sucesso, mas sem conteúdo no corpo
    res.status(204).send(); 
  } catch (error) {
    console.error(`Erro ao excluir cliente ID ${id}:`, error);
    // Caso de erro de Chave Estrangeira (o cliente tem pedidos, por exemplo)
    if (error.code === '23503') { 
        return res.status(409).json({ message: 'Não é possível excluir: o cliente possui dados vinculados (ex: pedidos).' });
    }
    res.status(500).json({ message: 'Erro interno no servidor' });
  }
};