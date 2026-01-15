export type InvoiceStatus = 'processing' | 'completed' | 'error';

export interface RecentUpload {
  id: string;
  filename: string;
  date: string;
  status: InvoiceStatus;
  size: string;
}

export enum DocumentType {
  ORDINARY = 'Factura Ordinaria',
  TICKET = 'Ticket / Simplificada',
  RECTIFICATION = 'Factura Rectificativa'
}

export enum Deductibility {
  FULL = '100% Deducible',
  NONE = 'No Deducible'
}