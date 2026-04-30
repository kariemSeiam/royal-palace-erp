import { apiFetch } from "../../lib/api/client";

export type B2BAccountRow = {
  id: number;
  company_name?: string | null;
  business_type?: string | null;
  tax_number?: string | null;
  commercial_registration?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address_text?: string | null;
  partner_category?: string | null;
  payment_terms?: string | null;
  credit_limit?: number | string | null;
  factory_id?: number | null;
  factory_name?: string | null;
  is_active?: boolean;
};

export async function getB2BAccounts(): Promise<B2BAccountRow[]> {
  return apiFetch("/admin/b2b/accounts");
}
