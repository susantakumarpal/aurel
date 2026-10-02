export interface Product {
  id: number;
  name: string;
  description: string;
  price: string | number;
  image_url: string;
  stock: number;
  category: string;
}

export interface Customer {
  id: number;
  email: string;
}

export interface Order {
  id: number;
  total_amount: string | number;
  status: string;
  created_at: string;
}
