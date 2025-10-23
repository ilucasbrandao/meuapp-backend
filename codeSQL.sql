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