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