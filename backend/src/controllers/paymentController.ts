import { Request, Response } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { query } from '../config/db';
import { AuthenticatedRequest } from '../middleware/authenticate';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

const checkoutSchema = z.object({
  items: z.array(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(10),
  })).min(1).max(25),
}).superRefine(({ items }, context) => {
  if (new Set(items.map((item) => item.productId)).size !== items.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Cart contains duplicate products.' });
  }
});

const recordPaidOrder = async (session: Stripe.Checkout.Session) => {
  const userId = Number(session.client_reference_id);
  if (!Number.isSafeInteger(userId) || userId < 1 || !session.id || !session.amount_total) return false;
  const userResult = await query('SELECT id, email FROM users WHERE id = $1', [userId]);
  const user = userResult.rows[0] as { id: number; email: string } | undefined;
  if (!user) return false;

  await query(
    `INSERT INTO orders (user_id, customer_name, payment_session_id, total_amount, status)
     VALUES ($1, $2, $3, $4, 'paid')
     ON CONFLICT (payment_session_id) DO NOTHING RETURNING id`,
    [userId, session.customer_details?.name || user.email, session.id, session.amount_total / 100]
  );
  return true;
};

export const createCheckoutSession = async (req: Request, res: Response) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues.map((issue) => issue.message).join(' ') });
  }
  if (!stripe) return res.status(503).json({ error: 'Secure checkout is not configured yet.' });

  try {
    const { userId } = req as AuthenticatedRequest;
    const result = await query('SELECT * FROM products');
    const products = result.rows as Array<{
      id: number;
      name: string;
      description: string;
      price: string | number;
      image_url: string;
      stock: number;
    }>;
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    let subtotalPaise = 0;

    for (const item of parsed.data.items) {
      const product = products.find((candidate) => candidate.id === item.productId);
      if (!product) return res.status(400).json({ error: 'A product in your cart is no longer available.' });
      if (item.quantity > product.stock) {
        return res.status(400).json({ error: `Only ${product.stock} ${product.name} remain in stock.` });
      }

      const unitAmount = Math.round(Number(product.price) * 100);
      subtotalPaise += unitAmount * item.quantity;
      lineItems.push({
        quantity: item.quantity,
        price_data: {
          currency: 'inr',
          unit_amount: unitAmount,
          product_data: {
            name: product.name,
            description: product.description,
            images: /^https:\/\//.test(product.image_url) ? [product.image_url] : [],
          },
        },
      });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const userResult = await query('SELECT id, email FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0] as { id: number; email: string } | undefined;
    if (!user) return res.status(401).json({ error: 'Sign in to continue.' });
    const freeShipping = subtotalPaise >= 1_200_000;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      client_reference_id: String(userId),
      customer_email: user.email,
      billing_address_collection: 'required',
      shipping_address_collection: { allowed_countries: ['IN'] },
      shipping_options: [{
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: freeShipping ? 0 : 49_900, currency: 'inr' },
          display_name: freeShipping ? 'Complimentary delivery' : 'Standard delivery',
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 3 },
            maximum: { unit: 'business_day', value: 5 },
          },
        },
      }],
      phone_number_collection: { enabled: true },
      success_url: `${frontendUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/?payment=cancelled`,
    });

    return res.json({ url: session.url });
  } catch {
    return res.status(502).json({ error: 'Secure checkout could not be started. Please try again.' });
  }
};

export const confirmCheckout = async (req: Request, res: Response) => {
  if (!stripe) return res.status(503).json({ error: 'Payment confirmation is not configured.' });
  const sessionId = z.string().min(10).max(255).safeParse(req.params.sessionId);
  if (!sessionId.success) return res.status(400).json({ error: 'Invalid payment session.' });

  try {
    const { userId } = req as AuthenticatedRequest;
    const session = await stripe.checkout.sessions.retrieve(sessionId.data);
    if (session.client_reference_id !== String(userId)) {
      return res.status(403).json({ error: 'This payment belongs to another account.' });
    }
    if (session.payment_status !== 'paid') {
      return res.status(409).json({ error: 'This payment has not been completed.' });
    }
    if (!(await recordPaidOrder(session))) {
      return res.status(409).json({ error: 'This payment could not be associated with an account order.' });
    }
    return res.json({ confirmed: true });
  } catch {
    return res.status(502).json({ error: 'We could not verify this payment yet.' });
  }
};

export const getOrders = async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const result = await query(
      'SELECT id, total_amount, status, created_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return res.json({ orders: result.rows });
  } catch {
    return res.status(500).json({ error: 'We could not load your orders.' });
  }
};

export const handleStripeWebhook = async (req: Request, res: Response) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.header('stripe-signature');
  if (!stripe || !webhookSecret) return res.status(503).send('Webhook is not configured.');
  if (!signature || !Buffer.isBuffer(req.body)) return res.status(400).send('Invalid webhook request.');

  try {
    const event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === 'paid') await recordPaidOrder(session);
    }
    return res.json({ received: true });
  } catch {
    return res.status(400).send('Webhook signature verification failed.');
  }
};