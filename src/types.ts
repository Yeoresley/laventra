export interface User {
  id: number;
  username: string;
  role: 'admin' | 'operator';
  branch_id?: number;
  name: string;
}

export interface Branch {
  id: number;
  name: string;
  location: string;
}

export interface Client {
  id: number;
  name: string;
  phone: string;
  email: string;
}

export interface Order {
  id: number;
  folio: string;
  client_id: number;
  client_name?: string;
  branch_id: number;
  branch_name?: string;
  description: string;
  weight: number;
  pieces: number;
  total_price: number;
  status: 'received' | 'processing' | 'ready' | 'delivered';
  payment_status: 'pending' | 'paid_at_reception' | 'paid_at_delivery';
  created_at: string;
  updated_at: string;
}
