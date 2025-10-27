-- Este é nosso template. Note que não usamos o nome do schema.
-- Vamos usar SET search_path para que funcione em qualquer schema.
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  price_cents INT NOT NULL DEFAULT 0,
  -- NOVAS COLUNAS --
  sku VARCHAR(100) UNIQUE,
  stock_quantity INTEGER DEFAULT 0 NOT NULL CHECK (stock_quantity >= 0),
  status VARCHAR(20) DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive')),
  -- FIM NOVAS COLUNAS --
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicione qualquer outra tabela que um novo tenant precise