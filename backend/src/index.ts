import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/api';
import { initializeDatabase } from './config/initDb';
import { handleStripeWebhook } from './controllers/paymentController';

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);
app.use(express.json());

app.use('/api', apiRoutes);

const PORT = process.env.PORT || 5000;

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => console.error('Database connection failed:', err));
