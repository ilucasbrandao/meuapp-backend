-- Este é nosso template. Note que não usamos o nome do schema.
-- Vamos usar SET search_path para que funcione em qualquer schema.
CREATE TABLE products (
  id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY, -- Ou UUID se você mudou
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) UNIQUE,
  category VARCHAR(255),
  unit_of_measure VARCHAR(20) DEFAULT 'un' NOT NULL,
  price_cents INT DEFAULT 0 NOT NULL CHECK (price_cents >= 0),
  cost_price_cents INT DEFAULT 0 NOT NULL CHECK (cost_price_cents >= 0),
  stock_quantity INT DEFAULT 0 NOT NULL CHECK (stock_quantity >= 0),
  status VARCHAR(20) DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
  -- Adicione updated_at se desejar
);
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
 -----------------------------------------------------------------------------------------------------------------------------
-- Novas alterações adicionadas em 28/10/2025


-- Garante que a extensão UUID está habilitada (necessário se ainda não estiver)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --- Tabela 1: Pedidos de Venda ---
CREATE TABLE sales_orders (
    -- ID da Venda (UUID como padrão, mude para SERIAL se seus produtos/clientes usam ID numérico)
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Chave Estrangeira para a tabela 'customers' (mesmo tipo do ID do cliente)
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL, -- Se excluir cliente, a venda fica sem cliente (ou ON DELETE RESTRICT)

    -- Data da Venda
    order_date TIMESTAMPTZ DEFAULT NOW(),

    -- Valor Total (em centavos, obrigatório, não negativo)
    total_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_amount_cents >= 0),

    -- Forma de Pagamento Original (registrada no pedido)
    payment_method VARCHAR(50) CHECK (payment_method IN ('avista_dinheiro', 'avista_pix', 'avista_cartao', 'crediario', 'outro')), -- Lista de opções

    -- Status Geral da Venda
    status VARCHAR(50) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'partially_paid', 'paid', 'cancelled')),

    -- Observações
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW() -- (Opcional: Adicionar trigger para atualizar)
);
-- Índice para buscar vendas de um cliente rapidamente
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer_id ON sales_orders (customer_id);
-- Índice para buscar vendas por status
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders (status);


-- Adiciona a restrição de Chave Primária na coluna 'id' da tabela 'products'
-- (Substitua 'tenant_a' pelo nome correto do schema)
ALTER TABLE tenant_a.products
ADD CONSTRAINT products_pkey PRIMARY KEY (id);

-- Repita para tenant_b e outros schemas existentes
-- ALTER TABLE tenant_b.products ADD CONSTRAINT products_pkey PRIMARY KEY (id);



-- --- Tabela 2: Itens da Venda ---
-- --- Tabela 2: Itens da Venda (CORRIGIDA) ---
CREATE TABLE sales_order_items (
    -- ID do Item (UUID ou SERIAL - escolha um consistente com as outras novas tabelas)
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Mantendo UUID aqui, mas poderia ser SERIAL

    -- Chave Estrangeira para a venda principal (deve ser UUID se sales_orders.id for UUID)
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,

    -- Chave Estrangeira para o produto (CORRIGIDO PARA INTEGER)
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,

    -- Detalhes do Item
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
    total_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_price_cents >= 0),

    -- Unicidade (Opcional)
    UNIQUE (sales_order_id, product_id)
);
-- Índices (sem mudança)
CREATE INDEX IF NOT EXISTS idx_sales_order_items_sales_order_id ON sales_order_items (sales_order_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_product_id ON sales_order_items (product_id);

-- --- Tabela 3: Pagamentos / Parcelas ---
CREATE TABLE payments (
    -- ID do Pagamento/Parcela (UUID ou SERIAL)
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Chave Estrangeira para a venda (obrigatório, deleta pagamentos se a venda for deletada)
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,

    -- Número da Parcela (1 para avista, 1, 2, 3... para crediário)
    installment_number INTEGER NOT NULL DEFAULT 1 CHECK (installment_number > 0),

    -- Valor do Pagamento/Parcela (em centavos)
    amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),

    -- Datas
    due_date DATE NOT NULL, -- Data de Vencimento (Apenas Dia, Mês, Ano)
    payment_date DATE, -- Data de Pagamento (NULL se pendente)

    -- Status do Pagamento/Parcela
    status VARCHAR(50) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),

    -- Forma como foi efetivamente pago (pode ser diferente do pedido original)
    payment_method_received VARCHAR(50) CHECK (payment_method_received IN ('dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'transferencia', 'boleto', 'outro')),

    -- Observações sobre o pagamento
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW() -- (Opcional: Adicionar trigger)
);
-- Índice para buscar pagamentos de uma venda
CREATE INDEX IF NOT EXISTS idx_payments_sales_order_id ON payments (sales_order_id);
-- Índice para buscar pagamentos por status (pendente, atrasado)
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status);
-- Índice para buscar pagamentos por data de vencimento
CREATE INDEX IF NOT EXISTS idx_payments_due_date ON payments (due_date);

