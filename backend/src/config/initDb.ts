import { query } from './db';

const demoProducts = [
  ['Studio Wireless', 'Immersive sound, sculpted in brushed aluminum.', 29900, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1000&auto=format&fit=crop&q=85', 20, 'Audio'],
  ['Form Mechanical', 'A considered keyboard with a satisfying, precise feel.', 18900, 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=1000&auto=format&fit=crop&q=85', 35, 'Desk'],
  ['Meridian Watch', 'Quietly capable timekeeping for every day.', 34500, 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1000&auto=format&fit=crop&q=85', 15, 'Wearables'],
  ['Arc Portable', 'Balanced sound that moves with you.', 15900, 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=1000&auto=format&fit=crop&q=85', 18, 'Audio'],
  ['Studio Keys', 'A compact, tactile workspace essential.', 11900, 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=1000&auto=format&fit=crop&q=85', 24, 'Desk'],
  ['Field Timepiece', 'Minimal design, built for a life in motion.', 24900, 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=1000&auto=format&fit=crop&q=85', 12, 'Wearables'],
  ['Solis Desk Lamp', 'A warm, sculptural glow for slower evenings.', 8900, 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=1000&auto=format&fit=crop&q=85', 16, 'Living'],
  ['Kanso Pour-over Set', 'A simple ritual, shaped in considered ceramic.', 4900, 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1000&auto=format&fit=crop&q=85', 28, 'Living'],
  ['Mori Leather Folio', 'A supple everyday carry, made to gather a patina.', 7900, 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=1000&auto=format&fit=crop&q=85', 14, 'Accessories'],
  ['Cove Travel Speaker', 'Room-filling sound in a take-anywhere form.', 12900, 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=1000&auto=format&fit=crop&q=85', 22, 'Audio'],
  ['Nami Ceramic Vase', 'A quiet sculptural accent, finished by hand.', 6400, 'https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=1000&auto=format&fit=crop&q=85', 18, 'Living'],
  ['Sora Sunglasses', 'Lightweight frames with an easy, timeless profile.', 8500, 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=1000&auto=format&fit=crop&q=85', 20, 'Accessories'],
  ['Aster Fountain Pen', 'A balanced writing instrument for everyday notes.', 3900, 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1000&auto=format&fit=crop&q=85', 30, 'Desk'],
  ['Trek Weekend Bag', 'A refined carryall for the days just out of town.', 11900, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1000&auto=format&fit=crop&q=85', 12, 'Accessories'],
] as const;

export const initializeDatabase = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price NUMERIC(10, 2) NOT NULL,
      image_url TEXT,
      stock INTEGER NOT NULL DEFAULT 10,
      category VARCHAR(80) NOT NULL DEFAULT 'Objects'
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      customer_name VARCHAR(100) NOT NULL,
      total_amount NUMERIC(10, 2) NOT NULL,
      user_id INTEGER REFERENCES users(id),
      payment_session_id TEXT UNIQUE,
      status VARCHAR(30) NOT NULL DEFAULT 'paid',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(80) NOT NULL DEFAULT 'Objects';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_session_id TEXT UNIQUE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'paid';
  `);

  const legacyNames: Record<string, string> = {
    'Wireless Headphones': 'Studio Wireless',
    'Mechanical Gaming Keyboard': 'Form Mechanical',
    'Fitness Smartwatch': 'Meridian Watch',
  };

  for (const [oldName, newName] of Object.entries(legacyNames)) {
    await query('UPDATE products SET name = $1 WHERE name = $2', [newName, oldName]);
  }

  for (const [name, description, price, imageUrl, stock, category] of demoProducts) {
    const existing = await query('SELECT id FROM products WHERE name = $1', [name]);
    if (existing.rows.length) {
      await query(
        'UPDATE products SET description = $1, price = $2, image_url = $3, category = $4 WHERE id = $5',
        [description, price, imageUrl, category, existing.rows[0].id]
      );
    } else {
      await query(
        'INSERT INTO products (name, description, price, image_url, stock, category) VALUES ($1, $2, $3, $4, $5, $6)',
        [name, description, price, imageUrl, stock, category]
      );
    }
  }
  console.log('INR demo products synced.');
};
