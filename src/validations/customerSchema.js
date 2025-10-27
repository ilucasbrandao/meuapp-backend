import { z } from 'zod';

// .optional().or(z.literal('')) permite que o campo seja opcional
// ou venha como uma string vazia do formulário.
export const createCustomerSchema = z.object({
  name: z.string({ required_error: 'Nome é obrigatório' }).min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  
  // Documentos
  document_type: z.enum(['PF', 'PJ']).optional().or(z.literal('')),
  document_number: z.string().optional().or(z.literal('')),
  birth_date: z.string().optional().or(z.literal('')), // O form envia como string
  status: z.string().default('ativo'),
  
  // Endereço
  address_zip_code: z.string().optional().or(z.literal('')),
  address_street: z.string().optional().or(z.literal('')),
  address_number: z.string().optional().or(z.literal('')),
  address_complement: z.string().optional().or(z.literal('')),
  address_neighborhood: z.string().optional().or(z.literal('')),
  address_city: z.string().optional().or(z.literal('')),
  address_state: z.string().optional().or(z.literal('')),
  
  // Outros
  notes: z.string().optional().or(z.literal('')),
});