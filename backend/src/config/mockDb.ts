// Mock in-memory database for development without PostgreSQL

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image_url: string;
  stock: number;
  category: string;
}

interface User {
  id: number;
  email: string;
  password_hash: string;
}

interface Order {
  id: number;
  customer_name: string;
  total_amount: number;
  user_id: number | null;
  payment_session_id: string | null;
  status: string;
  created_at: string;
}

let productId = 1;
let userId = 1;
let orderId = 1;

export const mockDb = {
  products: [] as Product[],
  users: [] as User[],
  orders: [] as Order[],
};

export const query = async (text: string, params?: any[]) => {
  // Mock query implementation
  const lowerText = text.toLowerCase().trim();

  // CREATE TABLE IF NOT EXISTS products
  if (lowerText.includes('create table if not exists products')) {
    return { rows: [] };
  }

  if (lowerText.includes('create table if not exists users') || lowerText.includes('alter table')) {
    return { rows: [] };
  }

  // CREATE TABLE IF NOT EXISTS orders
  if (lowerText.includes('create table if not exists orders')) {
    return { rows: [] };
  }

  // SELECT count(*) FROM products
  if (lowerText.includes('select count(*)') && lowerText.includes('products')) {
    return { rows: [{ count: mockDb.products.length.toString() }] };
  }

  // INSERT INTO products
  if (lowerText.includes('insert into products')) {
    if (lowerText.includes('values ($1')) {
      const [name, description, price, imageUrl, stock, category] = params ?? [];
      if (mockDb.products.some((product) => product.name === String(name))) return { rows: [] };
      const product = {
        id: productId++,
        name: String(name),
        description: String(description),
        price: Number(price),
        image_url: String(imageUrl),
        stock: Number(stock),
        category: String(category),
      };
      mockDb.products.push(product);
      return { rows: [{ id: product.id }] };
    }

    const valuesPattern = /\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*([\d.]+)\s*,\s*'([^']*)'\s*,\s*(\d+)\s*,\s*'([^']*)'\s*\)/g;
    let match;
    while ((match = valuesPattern.exec(text)) !== null) {
      mockDb.products.push({
        id: productId++,
        name: match[1],
        description: match[2],
        price: parseFloat(match[3]),
        image_url: match[4],
        stock: parseInt(match[5]),
        category: match[6],
      });
    }
    return { rows: [] };
  }

  if (lowerText.includes('update products set name = $1 where name = $2')) {
    const product = mockDb.products.find((entry) => entry.name === String(params?.[1]));
    if (product) product.name = String(params?.[0]);
    return { rows: [] };
  }

  if (lowerText.includes('update products set description = $1')) {
    const product = mockDb.products.find((entry) => entry.id === Number(params?.[4]));
    if (product) {
      product.description = String(params?.[0]);
      product.price = Number(params?.[1]);
      product.image_url = String(params?.[2]);
      product.category = String(params?.[3]);
    }
    return { rows: [] };
  }

  if (lowerText.includes('select id from products where name = $1')) {
    const product = mockDb.products.find((entry) => entry.name === String(params?.[0]));
    return { rows: product ? [{ id: product.id }] : [] };
  }

  if (lowerText.includes('select id, email, password_hash from users where email')) {
    const user = mockDb.users.find((entry) => entry.email === String(params?.[0]).toLowerCase());
    return { rows: user ? [user] : [] };
  }

  if (lowerText.includes('insert into users')) {
    const user = {
      id: userId++,
      email: String(params?.[0]).toLowerCase(),
      password_hash: String(params?.[1]),
    };
    mockDb.users.push(user);
    return { rows: [{ id: user.id, email: user.email }] };
  }

  if (lowerText.includes('select id, email from users where id')) {
    const user = mockDb.users.find((entry) => entry.id === Number(params?.[0]));
    return { rows: user ? [{ id: user.id, email: user.email }] : [] };
  }

  if (lowerText.includes('select id, total_amount, status, created_at from orders where user_id')) {
    return {
      rows: mockDb.orders
        .filter((order) => order.user_id === Number(params?.[0]))
        .sort((first, second) => second.id - first.id),
    };
  }

  if (lowerText.includes('insert into orders')) {
    const [userIdValue, customerName, sessionId, totalAmount] = params ?? [];
    const existingOrder = mockDb.orders.find((order) => order.payment_session_id === sessionId);
    if (existingOrder) return { rows: [] };

    const order = {
      id: orderId++,
      user_id: Number(userIdValue),
      customer_name: String(customerName),
      payment_session_id: String(sessionId),
      total_amount: Number(totalAmount),
      status: 'paid',
      created_at: new Date().toISOString(),
    };
    mockDb.orders.push(order);
    return { rows: [{ id: order.id }] };
  }

  // SELECT * FROM products
  if (lowerText.includes('select *') && lowerText.includes('from products')) {
    return { rows: mockDb.products };
  }

  return { rows: [] };
};
