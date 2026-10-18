/** Invoice types (`Invoices_API.md`). */
import type { PaymentMethod } from './payment';

export type InvoiceStatus = 'AWAITING_FULFILLMENT' | 'ON_HOLD' | 'AWAITING_SHIPMENT' | 'SHIPPED' | 'COMPLETED';

/** The state of an invoice's PDF job; `NOT_INITIATED` comes with a 400 when no job exists for the number. */
export type DownloadStatus = 'NOT_INITIATED' | 'INITIATED' | 'IN_PROGRESS' | 'COMPLETED';

/** Body of `POST /invoices`. */
export interface CreateInvoiceRequest {
  payment_method: PaymentMethod;
  /** The key must be present; its fields depend on the method (`{}` for cash on delivery). */
  payment_details: Record<string, unknown>;
  billing_street: string;
  billing_city: string;
  billing_state?: string;
  billing_country: string;
  billing_postal_code?: string;
  invoice_date?: string;
  cart_id: string;
}

/** Body of `POST /invoices/guest`: the fields of `POST /invoices` plus the guest's identity (used for the email only). */
export interface CreateGuestInvoiceRequest extends CreateInvoiceRequest {
  guest_email: string;
  guest_first_name: string;
  guest_last_name: string;
}

/** The `201` body of `POST /invoices` and `POST /invoices/guest`: the invoice without relations. */
export interface InvoiceCreated {
  id: string;
  user_id: string | null;
  invoice_number: string;
  total: number;
  invoice_date?: string;
  billing_street?: string;
  billing_city?: string;
  billing_state?: string;
  billing_country?: string;
  billing_postal_code?: string;
  subtotal?: number;
  additional_discount_percentage?: number;
  additional_discount_amount?: number;
  eco_discount_percentage?: number;
  eco_discount_amount?: number;
  created_at?: string;
  [key: string]: unknown;
}

/** The product inside a line of `GET /invoices/{invoiceId}`. */
export interface InvoiceLineProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  co2_rating: string;
  is_rental: boolean;
  in_stock: boolean | null;
  is_eco_friendly: boolean;
  product_image: Record<string, unknown> | null;
  category: Record<string, unknown> | null;
  brand: Record<string, unknown> | null;
}

/** A line of `GET /invoices/{invoiceId}`. `discounted_price` may come back as a string (`Invoices_API.md`, Notes). */
export interface InvoiceLine {
  id: string;
  invoice_id: string;
  product_id: string;
  unit_price: number;
  quantity: number;
  discount_percentage: number | null;
  discounted_price: number | string | null;
  product: InvoiceLineProduct;
}

/** The payment of an invoice: the method and the stored details (with their own `id`). */
export interface InvoicePayment {
  payment_method: PaymentMethod;
  payment_details: Record<string, unknown> | null;
}

/** `GET /invoices/{invoiceId}` (200). */
export interface Invoice {
  id: string;
  user_id: string | null;
  invoice_number: string;
  invoice_date: string;
  billing_street: string;
  billing_city: string;
  billing_state: string | null;
  billing_country: string;
  billing_postal_code: string | null;
  additional_discount_percentage: number | null;
  additional_discount_amount: number | null;
  eco_discount_percentage: number | null;
  eco_discount_amount: number | null;
  subtotal: number | null;
  total: number | null;
  status: InvoiceStatus;
  status_message: string | null;
  created_at: string;
  invoicelines: InvoiceLine[];
  payment: InvoicePayment | null;
}

/** An item of `data[]` in `GET /invoices` and the search endpoints (lines with a slim product, the payment method only). */
export interface InvoiceSummary {
  id: string;
  user_id: string | null;
  invoice_number: string;
  invoice_date: string;
  status: InvoiceStatus;
  subtotal: number | null;
  total: number | null;
  billing_street: string;
  billing_city: string;
  billing_state: string | null;
  billing_country: string;
  billing_postal_code: string | null;
  additional_discount_percentage: number | null;
  additional_discount_amount: number | null;
  invoicelines: Record<string, unknown>[];
  payment: { payment_method: PaymentMethod } | null;
}

/** `GET /invoices/{invoice_number}/download-pdf-status`: 200 with the job's status, or 400 with NOT_INITIATED. */
export interface PdfStatusResponse {
  status: DownloadStatus;
}

/** Body of `PUT /invoices/{invoiceId}/status`. */
export interface UpdateInvoiceStatusRequest {
  status?: InvoiceStatus;
  status_message?: string | null;
}

/** The `200` body of `PUT /invoices/{invoiceId}/status`. */
export interface UpdateInvoiceStatusResponse {
  success: boolean;
}

/** Body of `PUT /invoices/{invoiceId}`: validated like `POST /invoices` (payment and cart fields required, not stored). */
export type UpdateInvoiceRequest = CreateInvoiceRequest;

/** Body of `PATCH /invoices/{invoiceId}`: every field optional; `cart_id` is validated and ignored. */
export interface PatchInvoiceRequest {
  billing_street?: string;
  billing_city?: string;
  billing_state?: string;
  billing_country?: string;
  billing_postal_code?: string;
  invoice_date?: string;
  cart_id?: string;
}

/** Body of `QUERY /invoices/search`: the criteria of `GET /invoices/search`. */
export interface InvoiceSearchQueryBody {
  q?: string;
  page?: string;
}
