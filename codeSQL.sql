-- Para usar UUIDs (opcional, mas boa prática)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- A tabela que define quem são nossos clientes/tenants
CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    name TEXT NOT NULL, -- Ex: "Empresa A"
    subdomain TEXT NOT NULL UNIQUE, -- Ex: "empresa-a"
    schema_name TEXT NOT NULL UNIQUE, -- Ex: "tenant_empresa_a"
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Um índice para buscas rápidas
CREATE INDEX idx_tenants_subdomain ON public.tenants (subdomain);

-- SEGUNDA PARTE DO COMANDO --

-- 1. Inserir os tenants na tabela 'public' (AGORA VAI FUNCIONAR)
INSERT INTO
    public.tenants (name, subdomain, schema_name)
VALUES (
        'Empresa A',
        'empresa-a',
        'tenant_a'
    ),
    (
        'Empresa B',
        'empresa-b',
        'tenant_b'
    );

-- 2. Criar os schemas separados
CREATE SCHEMA tenant_a;

CREATE SCHEMA tenant_b;

-- 3. Criar tabelas idênticas em cada schema
CREATE TABLE tenant_a.products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE tenant_b.products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

-- 4. Inserir dados de teste em cada schema
INSERT INTO tenant_a.products (name) VALUES ('Produto da Empresa A');

INSERT INTO tenant_b.products (name) VALUES ('Produto da Empresa B');

------------------------------------------------------------------------ 23/10/2025 -----------------------------------------------------------------------------------
-- 1. Tabela "Global" de Usuários
-- Ela fica em 'public' e aponta para 'public.tenants'
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,

-- Chave estrangeira (FK) para saber de qual empresa o usuário é


tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Inserir Usuários de Teste (para o login)
-- A senha para ambos é 'senha123'
-- O hash (bcrypt) é: $2a$10$f/8.k.bE4kG86wYp1lRz9.gJ3h.0t0p3E/K0k.g3n6c6b8c8d8e8
-- (Pode gerar o seu, mas este funciona para o teste)

INSERT INTO
    public.users (
        email,
        password_hash,
        tenant_id
    )
VALUES (
        'user@empresa-a.com',
        '$2a$10$f/8.k.bE4kG86wYp1lRz9.gJ3h.0t0p3E/K0k.g3n6c6b8c8d8e8',
        -- Pega o ID do tenant 'tenant_a' dinamicamente
        (
            SELECT id
            FROM public.tenants
            WHERE
                schema_name = 'tenant_a'
        )
    ),
    (
        'user@empresa-b.com',
        '$2a$10$f/8.k.bE4kG86wYp1lRz9.gJ3h.0t0p3E/K0k.g3n6c6b8c8d8e8',
        -- Pega o ID do tenant 'tenant_b' dinamicamente
        (
            SELECT id
            FROM public.tenants
            WHERE
                schema_name = 'tenant_b'
        )
    );

-- Hash correto para a senha 'senha123'
UPDATE public.users
SET
    password_hash = '$2b$10$T8GKPwAHGSsy0UmgD2S5Ou.lfswfua4Yl2FZR1T/aqXnjXNpn.DA6'
WHERE
    email = 'user@empresa-a.com';

UPDATE public.users
SET
    password_hash = '$2b$10$T8GKPwAHGSsy0UmgD2S5Ou.lfswfua4Yl2FZR1T/aqXnjXNpn.DA6'
WHERE
    email = 'user@empresa-b.com';

-- Criar a tabela de clientes para o Tenant A
CREATE TABLE tenant_a.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar a tabela de clientes para o Tenant B
CREATE TABLE tenant_b.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir dados de teste (para vermos no frontend)
INSERT INTO
    tenant_a.customers (name, email)
VALUES (
        'Cliente Fiel da Empresa A',
        'clientefiel@empresaA.com'
    );

INSERT INTO
    tenant_b.customers (name, email)
VALUES (
        'Novo Cliente da Empresa B',
        'novocliente@empresaB.com'
    );

------------------------------------------------------------------------ 24/10/2025 -----------------------------------------------------------------------------------

-- Adiciona a coluna de status
ALTER TABLE public.tenants
ADD COLUMN status VARCHAR(20) DEFAULT 'pending' NOT NULL;

-- Atualiza seus tenants de demo para 'active'
UPDATE public.tenants
SET
    status = 'active'
WHERE
    schema_name IN ('tenant_a', 'tenant_b');

-- Ponto 1: Garante que a coluna 'status' existe na tabela de tenants
-- (O 'IF NOT EXISTS' evita erro se você já a criou)
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending' NOT NULL;
-- (Isso confirma seu ponto: o default é 'pending')

-- Ponto 2: Precisamos saber quem é admin. Vamos adicionar um 'role' nos usuários.
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user' NOT NULL;

-- Ponto 3: O contador de acessos que você pediu.
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS login_count INT DEFAULT 0 NOT NULL;

-- Ponto 4: Promover um admin com um usuario existente
UPDATE public.users
SET role = 'admin'
WHERE
    email = 'user@empresa-a.com';

CREATE TABLE public.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    -- Guardamos o token (ou parte dele) para invalidar
    token_signature VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW()
);
-- Índice para buscas rápidas
CREATE INDEX idx_sessions_user_id ON public.sessions (user_id);

-- 1. Remove a coluna antiga que não precisamos mais
ALTER TABLE public.sessions DROP COLUMN IF EXISTS token_signature;

-- 2. Garante que a coluna 'id' é a chave primária
-- (Seu script original já deve ter feito isso, mas só para garantir)
ALTER TABLE public.sessions ADD PRIMARY KEY IF NOT EXISTS (id);

-- 3. (Opcional, mas recomendado) Adicionar um índice no user_id para performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions (user_id);

-- 1. Adiciona a coluna para guardar o limite de licenças, com um padrão de 3
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS license_limit INT DEFAULT 3 NOT NULL;

-- 2. (Opcional) Vamos definir limites diferentes para seus tenants de teste
UPDATE public.tenants
SET
    license_limit = 3
WHERE
    schema_name = 'tenant_a';

UPDATE public.tenants
SET
    license_limit = 5 -- A Empresa B comprou 5 licenças
WHERE
    schema_name = 'tenant_b';

---------------------------------------------------
-- Adiciona as novas colunas à tabela 'customers'
ALTER TABLE customers

-- 1. Identificação (CPF/CNPJ)
ADD COLUMN document_type VARCHAR(2) CHECK (document_type IN ('PF', 'PJ')),
ADD COLUMN document_number VARCHAR(18),

-- 2. Endereço Completo
ADD COLUMN address_zip_code VARCHAR(9),
ADD COLUMN address_street TEXT,
ADD COLUMN address_number VARCHAR(20),
ADD COLUMN address_complement TEXT,
ADD COLUMN address_neighborhood TEXT,
ADD COLUMN address_city TEXT,
ADD COLUMN address_state VARCHAR(2),

-- 3. Organização e Marketing
ADD COLUMN status VARCHAR(20) DEFAULT 'ativo' NOT NULL, -- 'ativo' como padrão
ADD COLUMN birth_date DATE,
ADD COLUMN notes TEXT;

-- (Opcional, mas RECOMENDADO)
-- Cria um índice único para o documento.
-- Isso impede que o empreendedor cadastre o mesmo cliente (mesmo CPF/CNPJ) duas vezes.
-- Usamos COALESCE para permitir múltiplos clientes com documento 'NULL' (não preenchido).
CREATE UNIQUE INDEX idx_customers_unique_document ON customers (
    document_number,
    COALESCE(document_type, '')
);