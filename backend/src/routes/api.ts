import { Router } from 'express';
import { getProducts } from '../controllers/productController';
import { getCurrentUser, login, register } from '../controllers/authController';
import { confirmCheckout, createCheckoutSession, getOrders } from '../controllers/paymentController';
import { authenticate } from '../middleware/authenticate';
import rateLimit from 'express-rate-limit';

const router = Router();
const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 10,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	message: { error: 'Too many sign-in attempts. Please try again in a few minutes.' },
});

router.get('/products', getProducts);
router.post('/auth/register', authLimiter, register);
router.post('/auth/login', authLimiter, login);
router.get('/auth/me', authenticate, getCurrentUser);
router.post('/checkout/session', authenticate, createCheckoutSession);
router.get('/payments/session/:sessionId', authenticate, confirmCheckout);
router.get('/orders', authenticate, getOrders);

export default router;
