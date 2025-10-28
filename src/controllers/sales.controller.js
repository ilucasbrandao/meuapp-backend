export const createSaleOrder = async (req, res) => {
  const client = req.dbClient;
  const { customer_id, items, payment_method, notes, number_of_installments } =
    req.body;

  // --- Checagem do client (middleware deveria garantir isso) ---
  if (!client) {
    console.error("createSaleOrder: req.dbClient não fornecido");
    return res
      .status(500)
      .json({ message: "Erro interno: conexão com o banco não encontrada." });
  }

  // --- Validações iniciais ---
  if (!customer_id) {
    return res.status(400).json({ message: "ID do Cliente é obrigatório." });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res
      .status(400)
      .json({ message: "É necessário adicionar pelo menos um item à venda." });
  }
  if (
    !payment_method ||
    !["avista_dinheiro", "avista_pix", "avista_cartao", "crediario"].includes(
      payment_method
    )
  ) {
    return res.status(400).json({ message: "Forma de pagamento inválida." });
  }
  if (
    payment_method === "crediario" &&
    (!number_of_installments || number_of_installments < 1)
  ) {
    return res
      .status(400)
      .json({ message: "Número de parcelas é obrigatório para crediário." });
  }
  // Validação simples do array de itens
  for (const it of items) {
    if (!it.product_id || !it.quantity || it.quantity <= 0) {
      return res
        .status(400)
        .json({ message: "Dados inválidos em um dos itens da venda." });
    }
  }

  try {
    // --- Begin transaction ---
    await client.query("BEGIN");

    // --- Checar cliente existe ---
    const customerCheck = await client.query(
      "SELECT id FROM customers WHERE id = $1",
      [customer_id]
    );
    if (customerCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({ message: `Cliente com ID ${customer_id} não encontrado.` });
    }

    // --- Processar items: validar produto, travar linha e obter preço oficial ---
    let totalOrderAmountCents = 0;
    const processedItems = [];

    // NOTE: vamos travar a linha do produto para evitar race conditions.
    // Também usamos o preço vindo do DB (unit_price_cents_db) — não confiar no frontend.
    for (const item of items) {
      // Seleciona e trava a linha do produto
      const productRes = await client.query(
        `SELECT id, name, stock_quantity, unit_price_cents
         FROM products
         WHERE id = $1
         FOR UPDATE`, // trava a linha até commit/rollback
        [item.product_id]
      );

      if (productRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          message: `Produto com ID ${item.product_id} não encontrado.`,
        });
      }

      const product = productRes.rows[0];

      // Validar estoque
      if (product.stock_quantity < item.quantity) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: `Estoque insuficiente para "${product.name}". Disponível: ${product.stock_quantity}.`,
        });
      }

      // Preço oficial do produto (não confiar em unit_price vindo do cliente)
      const unitPriceCentsDb = product.unit_price_cents;
      if (unitPriceCentsDb == null) {
        await client.query("ROLLBACK");
        return res.status(500).json({
          message: `Produto ${product.name} não tem preço cadastrado.`,
        });
      }

      const itemTotalCents = item.quantity * unitPriceCentsDb;
      totalOrderAmountCents += itemTotalCents;

      processedItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price_cents: unitPriceCentsDb,
        total_price_cents: itemTotalCents,
      });
    }

    // --- Inserir pedido principal ---
    const orderStatus = payment_method === "crediario" ? "pending" : "paid";
    const orderResult = await client.query(
      `INSERT INTO sales_orders (customer_id, total_amount_cents, payment_method, status, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [
        customer_id,
        totalOrderAmountCents,
        payment_method,
        orderStatus,
        notes || null,
      ]
    );
    const newOrderId = orderResult.rows[0].id;
    const orderCreatedAt = orderResult.rows[0].created_at;

    // --- Inserir itens do pedido (batch) ---
    // Para simplicidade uso inserts sequenciais via Promise.all, mas já travei as linhas acima.
    await Promise.all(
      processedItems.map((it) =>
        client.query(
          `INSERT INTO sales_order_items (sales_order_id, product_id, product_name, quantity, unit_price_cents, total_price_cents)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            newOrderId,
            it.product_id,
            it.product_name,
            it.quantity,
            it.unit_price_cents,
            it.total_price_cents,
          ]
        )
      )
    );

    // --- Inserir pagamentos/parcelas ---
    const paymentsInserted = [];
    if (payment_method === "crediario") {
      // Distribuir valor por parcelas — colocar resto na última parcela (comentar isso no contrato)
      const installmentAmountCents = Math.floor(
        totalOrderAmountCents / number_of_installments
      );
      let remaining = totalOrderAmountCents;

      for (let i = 1; i <= number_of_installments; i++) {
        const amount =
          i === number_of_installments ? remaining : installmentAmountCents;
        remaining -= amount;

        const dueDate = new Date(orderCreatedAt);
        dueDate.setDate(dueDate.getDate() + 30 * i);
        const dueDateString = dueDate.toISOString().split("T")[0];

        const payRes = await client.query(
          `INSERT INTO payments (sales_order_id, installment_number, amount_cents, due_date, status)
           VALUES ($1, $2, $3, $4, 'pending')
           RETURNING id, installment_number, amount_cents, due_date, status`,
          [newOrderId, i, amount, dueDateString]
        );
        paymentsInserted.push(payRes.rows[0]);
      }
    } else {
      const todayString = new Date().toISOString().split("T")[0];
      const payRes = await client.query(
        `INSERT INTO payments (sales_order_id, installment_number, amount_cents, due_date, payment_date, status, payment_method_received)
         VALUES ($1, 1, $2, $3, $4, 'paid', $5)
         RETURNING id, installment_number, amount_cents, due_date, payment_date, status, payment_method_received`,
        [
          newOrderId,
          totalOrderAmountCents,
          todayString,
          todayString,
          payment_method.replace("avista_", ""),
        ]
      );
      paymentsInserted.push(payRes.rows[0]);
    }

    // --- Atualizar estoque (já travado com FOR UPDATE, então safe) ---
    await Promise.all(
      processedItems.map((it) =>
        client.query(
          `UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2`,
          [it.quantity, it.product_id]
        )
      )
    );

    // --- Commit ---
    await client.query("COMMIT");

    // --- Buscar dados finais para retorno (opcional) ---
    const orderFullRes = {
      id: newOrderId,
      created_at: orderCreatedAt,
      total_amount_cents: totalOrderAmountCents,
      payment_method,
      status: orderStatus,
      notes: notes || null,
      items: processedItems,
      payments: paymentsInserted,
    };

    return res.status(201).json({
      message: "Venda registrada com sucesso!",
      order: orderFullRes,
    });
  } catch (error) {
    // Garante rollback em caso de erro
    try {
      await client.query("ROLLBACK");
    } catch (rbErr) {
      console.error("Erro ao dar rollback:", rbErr);
    }

    console.error("Erro ao criar venda:", error);
    if (error.code === "23503") {
      return res.status(400).json({ message: "Cliente ou Produto inválido." });
    }
    if (error.code === "23505") {
      return res.status(400).json({ message: "Item duplicado na venda." });
    }
    return res
      .status(500)
      .json({ message: "Erro interno no servidor ao registrar a venda." });
  } finally {
    // Libera sempre o client (middleware forneceu)
    try {
      if (client) client.release();
    } catch (relErr) {
      console.error("Erro ao liberar client:", relErr);
    }
  }
};
