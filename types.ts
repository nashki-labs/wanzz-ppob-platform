
export interface Product {
  status: string;
  available: boolean;
  category: string;
  provider: string;
  name: string;
  type: string;
  original_price: string;
  price: number;
  formatted_price: string;
  profit: string;
  code: string;
  note: string;
}

export interface DepositMethod {
  metode: string;
  type: string;
  name: string;
  minimum: string;
  maximum: string;
  fee: string;
  percentage_fee: string;
  status: string;
  logo_image_url: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'admin' | 'system';
  text: string;
  timestamp: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'user' | 'admin';
  balance: number;
  photoURL?: string;
  apiKey: string;
  password?: string; // Hanya digunakan internal/mock
  created_at: string;
}

export interface Deposit {
  id: string;
  reff_id: string;
  nominal: number;
  fee: number;
  total_payment?: number;
  get_balance: number;
  qr_image_url?: string;
  payment_number?: string;
  status: 'pending' | 'success' | 'canceled';
  created_at: string;
  expired_at?: string;
  method?: string;
  gateway_response?: string;
}

export interface PanelPackage {
  id: string;
  label: string;
  memory: number;
  cpu: number;
  disk: number;
  price: number;
}

export interface PterodactylPanel {
  id: string;
  package_id: string;
  panel_username: string;
  panel_email: string;
  panel_password: string;
  server_name: string;
  memory: number;
  disk: number;
  cpu: number;
  price: number;
  status: 'pending' | 'success' | 'failed';
  domain: string;
  created_at: string;
}

export interface PterodactylEgg {
  id: number;
  name: string;
  description: string;
  docker_image: string;
}

export interface PterodactylNest {
  id: number;
  name: string;
  description: string;
  eggs: PterodactylEgg[];
}

