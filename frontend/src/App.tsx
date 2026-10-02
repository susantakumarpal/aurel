import { FormEvent, useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  Check,
  LockKeyhole,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  UserRound,
  X,
} from 'lucide-react';
import { Customer, Order, Product } from './types';
import './App.css';

type CartLine = { product: Product; quantity: number };
type AuthMode = 'signin' | 'signup';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'aurel-customer-token';
const formatPrice = (price: number | string) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(Number(price));

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('aurel-cart') || '[]') as CartLine[];
    } catch {
      return [];
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [productError, setProductError] = useState('');
  const [productsLoading, setProductsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All pieces');
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/products`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Our collection could not be reached.');
        return response.json() as Promise<Product[]>;
      })
      .then(setProducts)
      .catch(() => setProductError('The collection is taking a moment. Please refresh to try again.'))
      .finally(() => setProductsLoading(false));
  }, []);

  useEffect(() => {
    localStorage.setItem('aurel-cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (!products.length) return;
    setCart((current) => current.flatMap((line) => {
      const product = products.find((candidate) => candidate.id === line.product.id);
      if (!product || product.stock < 1) return [];
      return [{ product, quantity: Math.min(line.quantity, product.stock) }];
    }));
  }, [products]);

  useEffect(() => {
    if (!token) {
      setCustomer(null);
      return;
    }
    fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error('Session expired');
        const data = await response.json() as { user: Customer };
        setCustomer(data.user);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken('');
        setCustomer(null);
      });
  }, [token]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const sessionId = params.get('session_id');
    if (payment === 'cancelled') {
      setMessage('Checkout was cancelled. Your selection is still in your bag.');
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (payment === 'success' && sessionId) {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      fetch(`${API_URL}/payments/session/${encodeURIComponent(sessionId)}`, {
        headers: savedToken ? { Authorization: `Bearer ${savedToken}` } : {},
      })
        .then(async (response) => {
          const data = await response.json() as { confirmed?: boolean; error?: string };
          if (!response.ok || !data.confirmed) throw new Error(data.error || 'Payment confirmation is pending.');
          setCart([]);
          setMessage('Your order is confirmed. Thank you for choosing Aurel.');
        })
        .catch((error: Error) => setMessage(error.message))
        .finally(() => window.history.replaceState({}, '', window.location.pathname));
    }
  }, []);

  const itemCount = cart.reduce((total, line) => total + line.quantity, 0);
  const total = cart.reduce((sum, line) => sum + Number(line.product.price) * line.quantity, 0);
  const categories = ['All pieces', ...new Set(products.map((product) => product.category || 'Objects'))];
  const visibleProducts = products.filter((product) => {
    const matchesCategory = category === 'All pieces' || product.category === category;
    const searchText = `${product.name} ${product.description} ${product.category}`.toLowerCase();
    return matchesCategory && searchText.includes(query.toLowerCase().trim());
  });

  const addToCart = (product: Product) => {
    const existing = cart.find((line) => line.product.id === product.id);
    if (existing?.quantity === product.stock) {
      setMessage(`Only ${product.stock} ${product.name} remain in stock.`);
      return;
    }
    setCart((current) => existing
      ? current.map((line) => line.product.id === product.id
        ? { ...line, quantity: line.quantity + 1 }
        : line)
      : [...current, { product, quantity: 1 }]);
    setMessage(`${product.name} added to your bag.`);
  };

  const changeQuantity = (productId: number, change: number) => {
    const line = cart.find((item) => item.product.id === productId);
    if (!line) return;
    if (line.quantity + change > line.product.stock) {
      setMessage(`Only ${line.product.stock} ${line.product.name} remain in stock.`);
      return;
    }
    setCart((current) => current.flatMap((item) => {
      if (item.product.id !== productId) return [item];
      const quantity = item.quantity + change;
      return quantity > 0 ? [{ ...item, quantity }] : [];
    }));
  };

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError('');
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      setAuthError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setAuthError('Use at least 8 characters for your password.');
      return;
    }

    setAuthLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/${authMode === 'signup' ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await response.json() as { token?: string; user?: Customer; error?: string };
      if (!response.ok || !data.token || !data.user) throw new Error(data.error || 'We could not sign you in.');
      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setCustomer(data.user);
      setAuthMode(null);
      setPassword('');
      setMessage(authMode === 'signup' ? 'Your Aurel account is ready.' : 'Welcome back.');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const beginCheckout = async () => {
    if (!cart.length) return;
    if (!customer || !token) {
      setAuthMode('signin');
      setAuthError('Sign in or create an account to continue to secure checkout.');
      return;
    }
    setCheckoutLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/checkout/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
        }),
      });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || 'Secure checkout is unavailable.');
      window.location.assign(data.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Checkout could not be started.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const openAccount = async () => {
    if (!customer || !token) {
      setAuthError('');
      setAuthMode('signin');
      return;
    }
    setAccountOpen(true);
    setOrdersLoading(true);
    try {
      const response = await fetch(`${API_URL}/orders`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json() as { orders?: Order[]; error?: string };
      if (!response.ok) throw new Error(data.error || 'Orders are unavailable.');
      setOrders(data.orders || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Orders are unavailable.');
    } finally {
      setOrdersLoading(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
    setCustomer(null);
    setAccountOpen(false);
    setOrders([]);
    setMessage('You have signed out.');
  };

  return (
    <div className="storefront">
      <div className="announcement">
        <span>Thoughtful things, made to be kept.</span>
        <span className="announcement-right"><ShieldCheck size={13} /> Complimentary shipping over ₹12,000</span>
      </div>

      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Aurel home"><img className="brand-mark" src="/favicon.svg" alt="" />AUREL<span className="wordmark-dot">.</span></a>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#collection">The collection</a>
          <a href="#about">Our point of view</a>
        </nav>
        <div className="header-actions">
          <button className="icon-button search-toggle" aria-label="Search collection" onClick={() => document.getElementById('product-search')?.focus()}>
            <Search size={19} strokeWidth={1.7} />
          </button>
          <button className="icon-button" aria-label={customer ? 'View account and orders' : 'Sign in'} onClick={openAccount}>
            <UserRound size={19} strokeWidth={1.7} />
          </button>
          <button className="bag-button" onClick={() => setCartOpen(true)} aria-label={`Open bag, ${itemCount} items`}>
            <ShoppingBag size={18} strokeWidth={1.7} /> <span>Bag</span><span className="bag-count">{itemCount}</span>
          </button>
        </div>
      </header>

      <main id="top">
        <section className="hero" aria-label="Aurel collection">
          <div className="hero-content">
            <p className="eyebrow hero-eyebrow"><span /> THE EVERYDAY, ELEVATED</p>
            <h1>Good design<br />gets better<br /><em>with living.</em></h1>
            <p className="hero-copy">Considered objects for sound, time and the spaces in between.</p>
            <a className="hero-link" href="#collection">Explore the collection <ArrowDownRight size={17} /></a>
          </div>
          <div className="hero-caption"><span>01 / 03</span><span>Objects with intention</span></div>
          <div className="hero-side-note">FORM FOLLOWS FEELING</div>
        </section>

        {message && (
          <div className="notice" role="status">
            <span>{message}</span>
            <button aria-label="Dismiss message" onClick={() => setMessage('')}><X size={16} /></button>
          </div>
        )}

        <section className="collection section-wrap" id="collection">
          <div className="collection-heading">
            <div>
              <p className="eyebrow">MADE FOR THE DAILY</p>
              <h2>Objects of <em>lasting</em> value.</h2>
            </div>
            <p className="collection-note">Less, but more considered.<br />A small collection with a long point of view.</p>
          </div>

          <div className="collection-toolbar">
            <div className="category-list" role="group" aria-label="Filter by category">
              {categories.map((item) => (
                <button key={item} className={category === item ? 'category active' : 'category'} onClick={() => setCategory(item)}>
                  {item}
                </button>
              ))}
            </div>
            <label className="search-field" htmlFor="product-search">
              <Search size={16} strokeWidth={1.7} />
              <input id="product-search" type="search" placeholder="Find your object" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
          </div>

          {productError ? (
            <div className="empty-state"><p>{productError}</p></div>
          ) : productsLoading ? (
            <div className="loading-state">Arranging the collection<span /></div>
          ) : visibleProducts.length ? (
            <div className="product-grid">
              {visibleProducts.map((product, index) => (
                <article className="product-card" key={product.id}>
                  <div className="product-image-wrap">
                    <img src={product.image_url} alt={product.name} loading={index > 2 ? 'lazy' : 'eager'} />
                    <span className="product-category">{product.category || 'Objects'}</span>
                    <button className="quick-add" onClick={() => addToCart(product)} aria-label={`Add ${product.name} to bag`}>
                      <Plus size={18} strokeWidth={1.8} />
                    </button>
                  </div>
                  <div className="product-details">
                    <div className="product-title-line"><h3>{product.name}</h3><span>{formatPrice(product.price)}</span></div>
                    <p>{product.description}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state"><p>No objects found. Try another search.</p></div>
          )}
        </section>

        <section className="point-of-view" id="about">
          <div className="pov-image" role="img" aria-label="A considered listening space" />
          <div className="pov-copy">
            <p className="eyebrow">A SMALLER, BETTER EDIT</p>
            <h2>Keep what<br />moves you.</h2>
            <p>We look for honest materials, useful details and the kind of design that feels more at home with every passing year.</p>
            <a href="#collection">Meet the collection <ArrowRight size={16} /></a>
          </div>
          <span className="pov-index">AUREL / EST. 2024</span>
        </section>
      </main>

      <footer className="site-footer">
        <a className="wordmark footer-wordmark" href="#top" aria-label="Aurel home"><img className="brand-mark" src="/favicon.svg" alt="" />AUREL<span className="wordmark-dot">.</span></a>
        <p>Good things, thoughtfully chosen.</p>
        <span>© 2026 Aurel Objects</span>
      </footer>

      {cartOpen && (
        <div className="overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setCartOpen(false)}>
          <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="bag-title">
            <div className="drawer-header"><div><p className="eyebrow">YOUR SELECTION</p><h2 id="bag-title">The bag <span>({itemCount})</span></h2></div><button className="icon-button" aria-label="Close bag" onClick={() => setCartOpen(false)}><X size={21} /></button></div>
            {cart.length ? (
              <>
                <div className="cart-lines">
                  {cart.map(({ product, quantity }) => (
                    <div className="cart-line" key={product.id}>
                      <img src={product.image_url} alt="" />
                      <div className="cart-line-info"><h3>{product.name}</h3><p>{formatPrice(product.price)}</p><div className="quantity-control"><button aria-label={`Remove one ${product.name}`} onClick={() => changeQuantity(product.id, -1)}><Minus size={13} /></button><span>{quantity}</span><button aria-label={`Add one ${product.name}`} onClick={() => changeQuantity(product.id, 1)}><Plus size={13} /></button></div></div>
                      <strong>{formatPrice(Number(product.price) * quantity)}</strong>
                    </div>
                  ))}
                </div>
                <div className="drawer-bottom">
                  <p className="shipping-note"><Check size={15} /> Complimentary shipping over ₹12,000</p>
                  <div className="subtotal"><span>Subtotal</span><strong>{formatPrice(total)}</strong></div>
                  <p className="tax-note">Delivery options are shown securely at checkout.</p>
                  <button className="checkout-button" onClick={beginCheckout} disabled={checkoutLoading}>
                    {checkoutLoading ? 'Opening secure checkout…' : <>Continue to checkout <ArrowRight size={17} /></>}
                  </button>
                  <p className="secure-note"><LockKeyhole size={13} /> Encrypted payment, powered by Stripe</p>
                </div>
              </>
            ) : (
              <div className="empty-bag"><ShoppingBag size={25} strokeWidth={1.4} /><h3>Your bag is taking a breather.</h3><p>There are no objects here just yet.</p><button onClick={() => setCartOpen(false)}>Explore the collection <ArrowRight size={15} /></button></div>
            )}
          </aside>
        </div>
      )}

      {authMode && (
        <div className="overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setAuthMode(null)}>
          <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <button className="modal-close icon-button" aria-label="Close sign in" onClick={() => setAuthMode(null)}><X size={20} /></button>
            <p className="eyebrow">AUREL, PERSONALLY</p>
            <h2 id="auth-title">{authMode === 'signup' ? 'Make yourself at home.' : 'Welcome back.'}</h2>
            <p className="auth-intro">{authMode === 'signup' ? 'Create an account for a more considered checkout.' : 'Sign in to continue to your account and secure checkout.'}</p>
            <form onSubmit={submitAuth} noValidate>
              <label htmlFor="auth-email">Email address</label>
              <input id="auth-email" type="email" autoComplete="email" required maxLength={255} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
              <label htmlFor="auth-password">Password</label>
              <input id="auth-password" type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} required minLength={8} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
              {authError && <p className="form-error" role="alert">{authError}</p>}
              <button className="checkout-button auth-submit" type="submit" disabled={authLoading}>{authLoading ? 'One moment…' : authMode === 'signup' ? 'Create account' : 'Sign in'} <ArrowRight size={17} /></button>
            </form>
            <p className="auth-switch">{authMode === 'signup' ? 'Already have an account?' : 'New to Aurel?'} <button onClick={() => { setAuthMode(authMode === 'signup' ? 'signin' : 'signup'); setAuthError(''); }}>{authMode === 'signup' ? 'Sign in' : 'Create an account'}</button></p>
            <p className="privacy-note"><LockKeyhole size={13} /> Your account is protected with encrypted credentials.</p>
          </section>
        </div>
      )}

      {accountOpen && customer && (
        <div className="overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setAccountOpen(false)}>
          <section className="auth-modal account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title">
            <button className="modal-close icon-button" aria-label="Close account" onClick={() => setAccountOpen(false)}><X size={20} /></button>
            <p className="eyebrow">YOUR AUREL</p>
            <h2 id="account-title">A little history.</h2>
            <p className="account-email">{customer.email}</p>
            <div className="order-list">
              <h3>Recent orders</h3>
              {ordersLoading ? <p className="order-empty">Loading your orders…</p> : orders.length ? orders.map((order) => (
                <div className="order-row" key={order.id}><span>Order #{order.id}<small>{new Date(order.created_at).toLocaleDateString()}</small></span><span className="order-status">{order.status}</span><strong>{formatPrice(order.total_amount)}</strong></div>
              )) : <p className="order-empty">Your first order will feel right at home here.</p>}
            </div>
            <button className="signout-button" onClick={signOut}>Sign out <ArrowRight size={15} /></button>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
