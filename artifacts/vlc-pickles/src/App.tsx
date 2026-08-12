import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, BadgeCheck, CircleAlert, ClipboardList, Compass, Fish, HeartHandshake, Home,
  Leaf, Menu, Minus, Package, Pencil, Plus, Search, Settings, ShoppingBasket, Sparkles, Sprout,
  Trash2, X, Zap,
} from 'lucide-react';
import logoAsset from '@assets/WhatsApp_Image_2026-08-11_at_3.28.59_PM_1786504488507.jpeg';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { api } from '@/lib/api';

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  weight: string;
  description: string;
  story: string;
  ingredients: string;
  stock: number;
  badge: string;
};
type CartItem = { productId: string; quantity: number };
type Order = {
  id: string;
  createdAt: string;
  status: 'draft' | 'confirmed' | 'packed';
  customer: { name: string; phone: string; address: string; note: string };
  items: { productId: string; name: string; quantity: number; price: number }[];
  total: number;
};
type Store = {
  products: Product[];
  cart: CartItem[];
  orders: Order[];
  whatsapp: string;
  addToCart: (id: string, quantity?: number) => void;
  changeQuantity: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void;
  saveProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  updateOrderStatus: (id: string, status: Order['status']) => Promise<void>;
  saveWhatsapp: (phone: string) => Promise<void>;
  checkout: (customer: Order['customer']) => Promise<{ order: Order; whatsappOpened: boolean }>;
  toast: (message: string) => void;
};

const STORAGE = {
  products: 'vlc-pickles-products',
  cart: 'vlc-pickles-cart',
  orders: 'vlc-pickles-orders',
  whatsapp: 'vlc-pickles-whatsapp',
};
const seedProducts: Product[] = [
  {
    id: 'tuna-fish', name: 'Tuna Fish Pickle', category: 'Fish', price: 320, weight: '250 g',
    description: 'Tender tuna pieces, toasted spices, and a bright homemade masala.',
    story: 'Our first jar and the one that started the Sunday lunch arguments. Deep, savoury and warming.',
    ingredients: 'Tuna, gingelly oil, chilli, garlic, ginger, curry leaves, vinegar, house spices.',
    stock: 18, badge: 'The original',
  },
  {
    id: 'prawns', name: 'Prawns Pickle', category: 'Shellfish', price: 360, weight: '250 g',
    description: 'Juicy prawns folded into a sticky, fiery coastal masala.',
    story: 'Small-batch prawns cooked until they catch the masala at every edge. A proper rice companion.',
    ingredients: 'Prawns, gingelly oil, chilli, garlic, ginger, curry leaves, vinegar, house spices.',
    stock: 12, badge: 'Family favourite',
  },
  {
    id: 'squid', name: 'Squid Pickle', category: 'Shellfish', price: 340, weight: '250 g',
    description: 'Carefully prepared squid with a tender bite and a savoury spice finish.',
    story: 'Cleaned by hand, cooked patiently. The jar for people who know exactly what they like.',
    ingredients: 'Squid, gingelly oil, chilli, garlic, ginger, curry leaves, vinegar, house spices.',
    stock: 9, badge: 'Limited batch',
  },
  {
    id: 'nethili', name: 'Nethili Pickle', category: 'Fish', price: 290, weight: '250 g',
    description: 'Traditional anchovy pickle with tiny fish, big flavour, and a gentle tang.',
    story: 'A nostalgic coastal recipe with enough heat for curd rice and enough depth for everything else.',
    ingredients: 'Nethili, gingelly oil, chilli, garlic, ginger, curry leaves, vinegar, house spices.',
    stock: 24, badge: 'Coastal classic',
  },
];

function readStorage<T>(key: string, fallback: T): T {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) as T : fallback;
  } catch {
    return fallback;
  }
}
function writeStorage(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

const StoreContext = createContext<Store | null>(null);
function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('StoreProvider is missing');
  return store;
}

function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(seedProducts);
  const [cart, setCart] = useState<CartItem[]>(() => readStorage(STORAGE.cart, []));
  const [orders, setOrders] = useState<Order[]>([]);
  const [whatsapp, setWhatsapp] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => writeStorage(STORAGE.cart, cart), [cart]);
  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(''), 2500);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const toast = (message: string) => setToastMessage(message);
  useEffect(() => {
    let active = true;
    Promise.all([api.products(), api.orders(), api.whatsapp()])
      .then(([serverProducts, serverOrders, settings]) => {
        if (!active) return;
        setProducts(serverProducts);
        setOrders(serverOrders);
        setWhatsapp(settings.phone);
      })
      .catch((error: Error) => {
        if (active) toast(`Python backend unavailable: ${error.message}`);
      });
    return () => {
      active = false;
    };
  }, []);
  const addToCart = (id: string, quantity = 1) => {
    const product = products.find((item) => item.id === id);
    if (!product || product.stock < 1) return toast('That batch is sold out for now.');
    setCart((current) => {
      const line = current.find((item) => item.productId === id);
      const nextQuantity = Math.min(product.stock, (line?.quantity ?? 0) + quantity);
      return line ? current.map((item) => item.productId === id ? { ...item, quantity: nextQuantity } : item) : [...current, { productId: id, quantity: nextQuantity }];
    });
    toast(`${product.name} added to your basket`);
  };
  const changeQuantity = (id: string, quantity: number) => {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    setCart((current) => quantity < 1 ? current.filter((item) => item.productId !== id) : current.map((item) => item.productId === id ? { ...item, quantity: Math.min(quantity, product.stock) } : item));
  };
  const removeFromCart = (id: string) => setCart((current) => current.filter((item) => item.productId !== id));
  const saveProduct = async (product: Product) => {
    const saved = products.some((item) => item.id === product.id)
      ? await api.updateProduct(product.id, product)
      : await api.createProduct(product);
    setProducts((current) => current.some((item) => item.id === saved.id)
      ? current.map((item) => item.id === saved.id ? saved : item)
      : [...current, saved]);
    toast('Product shelf updated');
  };
  const deleteProduct = async (id: string) => {
    await api.deleteProduct(id);
    setProducts((current) => current.filter((item) => item.id !== id));
    setCart((current) => current.filter((item) => item.productId !== id));
    toast('Product removed from the shelf');
  };
  const updateOrderStatus = async (id: string, status: Order['status']) => {
    const updated = await api.updateOrder(id, status);
    setOrders((current) => current.map((order) => order.id === id ? updated : order));
    toast('Order status updated');
  };
  const saveWhatsapp = async (phone: string) => {
    const saved = await api.saveWhatsapp(phone);
    setWhatsapp(saved.phone);
    toast('WhatsApp number saved');
  };
  const checkout = async (customer: Order['customer']) => {
    const requestedItems = cart.map((line) => ({ productId: line.productId, quantity: line.quantity }));
    const order = await api.createOrder(customer, requestedItems);
    setOrders((current) => [order, ...current]);
    setProducts((current) => current.map((product) => {
      const line = requestedItems.find((item) => item.productId === product.id);
      return line ? { ...product, stock: product.stock - line.quantity } : product;
    }));
    setCart([]);
    const message = [`Hello VLC Pickles! I'd like to place an order.`, `Order: ${order.id}`, '', ...order.items.map((item) => `${item.name} × ${item.quantity} — ₹${item.price * item.quantity}`), '', `Total: ₹${order.total}`, `Name: ${customer.name}`, `Phone: ${customer.phone}`, `Address: ${customer.address}`, customer.note ? `Note: ${customer.note}` : ''].filter(Boolean).join('\n');
    const number = whatsapp.replace(/\D/g, '');
    if (number) {
      window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
      return { order, whatsappOpened: true };
    }
    return { order, whatsappOpened: false };
  };
  const value = useMemo(() => ({ products, cart, orders, whatsapp, addToCart, changeQuantity, removeFromCart, saveProduct, deleteProduct, updateOrderStatus, saveWhatsapp, checkout, toast }), [products, cart, orders, whatsapp]);
  return <StoreContext.Provider value={value}>{children}{toastMessage && <div className="toast-vlc" role="status" data-testid="status-toast">{toastMessage}</div>}</StoreContext.Provider>;
}

function Logo({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="logo-lockup" data-testid="link-logo">
    <img src={logoAsset} alt="VLC Pickles family logo" />
    {!compact && <span className="logo-word">VLC<small>Pickles · homemade with love</small></span>}
  </Link>;
}

function Header() {
  const { cart } = useStore();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const links = [{ href: '/', label: 'Home' }, { href: '/shop', label: 'Shop' }, { href: '/#story', label: 'Our story' }, { href: '/#process', label: 'How we make it' }];
  return <>
    <div className="top-strip text-center py-2 text-[.6rem] uppercase" data-testid="banner-fresh-batch">Small batches from our kitchen · Packed with flavour, sent with care</div>
    <header className="site-header">
      <div className="container-vlc flex min-h-[82px] items-center justify-between gap-5">
        <Logo />
        <nav className="nav-links hidden md:flex items-center gap-8" aria-label="Main navigation">
          {links.map((link) => <Link key={link.href} href={link.href} className={`nav-link ${location === link.href ? 'active' : ''}`} data-testid={`link-nav-${link.label.toLowerCase().replaceAll(' ', '-')}`}>{link.label}</Link>)}
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/cart" className="relative p-2 text-[hsl(var(--primary))]" aria-label={`Basket with ${cart.reduce((sum, item) => sum + item.quantity, 0)} items`} data-testid="link-cart">
            <ShoppingBasket size={22} />
            {cart.length > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[hsl(var(--accent))] px-1 text-[.6rem] font-bold text-[hsl(var(--accent-foreground))]" data-testid="badge-cart-count">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>}
          </Link>
          <button className="p-2 md:hidden" onClick={() => setOpen(!open)} aria-label="Toggle navigation" data-testid="button-toggle-navigation">{open ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
      </div>
      {open && <div className="container-vlc border-t border-[hsl(var(--border))] py-4 md:hidden">
        <nav className="grid gap-4">{links.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="nav-link" data-testid={`link-mobile-${link.label.toLowerCase().replaceAll(' ', '-')}`}>{link.label}</Link>)}</nav>
      </div>}
    </header>
  </>;
}

function Footer() {
  return <footer className="footer">
    <div className="container-vlc footer-grid">
      <div><Logo /><p className="mt-5 max-w-[270px]">Three brothers, one family kitchen, and seafood pickle recipes that deserve a place at your table.</p></div>
      <div><h3>Find your jar</h3><p><Link href="/shop">Shop all pickles</Link><br /><Link href="/shop">Fish pickles</Link><br /><Link href="/shop">Shellfish pickles</Link></p></div>
      <div><h3>Our kitchen</h3><p><Link href="/#story">Our story</Link><br /><Link href="/#process">How we make it</Link><br /><Link href="/admin">Owner's shelf</Link></p></div>
      <div><h3>Made to share</h3><p>Best with hot rice, curd rice, dosa, or the first thing you can find in the fridge.</p><Link href="/cart" className="btn-accent mt-2">Start an order <ArrowRight size={15} /></Link></div>
    </div>
    <div className="container-vlc mt-12 border-t border-[hsl(var(--primary-foreground)/.18)] pt-5 text-[.65rem] text-[hsl(44_45%_76%)]">© {new Date().getFullYear()} VLC Pickles · Homemade in small batches</div>
  </footer>;
}

function AppShell({ children }: { children: ReactNode }) {
  return <div className="site-shell grain"><Header />{children}<Footer /></div>;
}

function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { addToCart } = useStore();
  return <motion.article className={`product-card reveal reveal-delay-${Math.min(index + 1, 3)}`} whileHover={{ y: -4 }} data-testid={`card-product-${product.id}`}>
    <Link href={`/product/${product.id}`} className="block" data-testid={`link-product-${product.id}`}>
      <div className="product-visual"><img src={logoAsset} alt={`${product.name} VLC Pickles jar`} /><span className="absolute left-3 top-3 z-[2] rounded-full bg-[hsl(var(--accent))] px-2 py-1 font-mono-brand text-[.5rem] font-bold uppercase tracking-wider text-[hsl(var(--accent-foreground))]">{product.badge}</span></div>
      <div className="product-body"><span className="product-tag">{product.category} · {product.weight}</span><h3 className="product-name">{product.name}</h3><p className="product-description">{product.description}</p></div>
    </Link>
    <div className="product-body !pt-0"><div className="product-meta"><span className="price">₹{product.price}</span><button className="mini-btn solid" onClick={() => addToCart(product.id)} disabled={!product.stock} data-testid={`button-add-${product.id}`}><Plus size={13} /> {product.stock ? 'Add jar' : 'Sold out'}</button></div></div>
  </motion.article>;
}

function HomePage() {
  const { products } = useStore();
  return <>
    <main>
      <section className="hero"><div className="container-vlc hero-inner">
        <div className="reveal"><span className="hero-kicker"><Sparkles size={14} /> A little taste of where we come from</span><h1 className="hero-title">Authentic<br /><em>taste</em> of home.</h1><p className="hero-copy">South Indian seafood pickles made like they are in our family kitchen: thoughtfully, patiently, with a little extra garlic.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/shop" className="btn-primary" data-testid="link-hero-shop">Shop the kitchen <ArrowRight size={16} /></Link><Link href="/#story" className="btn-quiet" data-testid="link-hero-story">Meet the family</Link></div></div>
        <div className="hero-art reveal reveal-delay-2"><div className="art-ring" /><img src={logoAsset} alt="VLC Pickles family and jar illustration" /><div className="hero-seal">SMALL<br />BATCH<br />KITCHEN</div></div>
      </div></section>
      <section className="section section-yellow"><div className="container-vlc">
        <div className="section-head"><div><span className="eyebrow">The jars everyone asks for</span><h2 className="section-title">Our signature<br />pickles.</h2></div><Link href="/shop" className="btn-quiet" data-testid="link-signature-shop">See all jars <ArrowRight size={15} /></Link></div>
        <div className="product-grid">{products.slice(0, 4).map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div>
      </div></section>
      <section className="section section-green"><div className="container-vlc">
        <div className="rule-title mb-9"><h2 className="section-title text-[hsl(var(--primary-foreground))]">Why a VLC jar?</h2></div>
        <div className="feature-row">
          {[{ icon: Fish, title: 'Good seafood', text: 'Selected for taste, never just size.' }, { icon: Leaf, title: 'Real ingredients', text: 'No shortcuts hiding in the masala.' }, { icon: HeartHandshake, title: 'Made with care', text: 'Every batch checked by family.' }, { icon: Sprout, title: 'Big flavour', text: 'A little jar goes a long way.' }].map(({ icon: Icon, title, text }) => <div className="feature" key={title}><Icon size={27} strokeWidth={1.5} /><strong>{title}</strong><span>{text}</span></div>)}
        </div>
      </div></section>
      <section className="section" id="story"><div className="container-vlc story-grid">
        <div className="story-mark reveal"><img src={logoAsset} alt="VLC Pickles family portrait illustration" /></div>
        <div className="reveal reveal-delay-1"><span className="eyebrow">Three brothers, one cupboard</span><h2 className="section-title">This is our<br />family recipe.</h2><p className="story-copy mt-6">VLC started with a jar passed across a kitchen table. We wanted the sort of pickle that makes a plain bowl of rice feel like someone had been cooking for you all day — bold, coastal, and familiar.</p><p className="story-copy mt-4">We still make it in small batches, still argue about the right amount of chilli, and still keep the best jar at home.</p><div className="quote">“The jar should taste like the person who made it.”</div></div>
      </div></section>
      <section className="section section-yellow" id="process"><div className="container-vlc"><div className="section-head"><div><span className="eyebrow">From catch to cupboard</span><h2 className="section-title">How we make<br />the magic.</h2></div><span className="font-mono-brand text-[.65rem] uppercase tracking-widest text-[hsl(var(--muted-foreground))]">No rush · No shortcuts</span></div><div className="process-grid">{[{ n: '01', title: 'Select', text: 'We choose seafood we would happily serve at home.' }, { n: '02', title: 'Clean', text: 'Prepared carefully, by hand, in our kitchen.' }, { n: '03', title: 'Cook', text: 'Slow heat lets the aromatics do their work.' }, { n: '04', title: 'Blend', text: 'Our masala finds every nook and cranny.' }, { n: '05', title: 'Pack', text: 'Sealed fresh, ready for your next meal.' }].map((step) => <div className="process-step" key={step.n}><span className="process-num">{step.n}</span><h3>{step.title}</h3><p>{step.text}</p></div>)}</div></div></section>
      <section className="section section-green"><div className="container-vlc flex flex-col items-center text-center"><span className="eyebrow !text-[hsl(var(--secondary))]">A jar for every kind of meal</span><h2 className="section-title mt-3 max-w-[690px] text-[hsl(var(--primary-foreground))]">Open one when the rice is hot.</h2><p className="mt-5 max-w-[460px] text-sm leading-7 text-[hsl(var(--primary-foreground)/.7)]">The best kind of pantry staple is the one that makes you look forward to leftovers.</p><Link href="/shop" className="btn-accent mt-8" data-testid="link-bottom-shop">Browse the jars <ArrowRight size={15} /></Link></div></section>
    </main>
  </>;
}

function ShopPage() {
  const { products } = useStore();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const categories = ['All', ...Array.from(new Set(products.map((product) => product.category)))];
  const filtered = products.filter((product) => (category === 'All' || product.category === category) && `${product.name} ${product.description}`.toLowerCase().includes(query.toLowerCase()));
  return <main><section className="page-hero"><div className="container-vlc"><span className="eyebrow">Straight from our shelf</span><h1>Shop the<br />kitchen.</h1><p className="mt-5 max-w-[510px] text-sm leading-7 text-[hsl(var(--muted-foreground))]">Four seafood pickles, made in small batches. Choose your favourite, or let dinner decide.</p></div></section><section className="section"><div className="container-vlc"><div className="shop-toolbar"><div className="search-box"><Search size={16} className="text-[hsl(var(--muted-foreground))]" /><input type="search" placeholder="Search the shelf" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search products" data-testid="input-search-products" /></div><div className="filter-list" aria-label="Product categories">{categories.map((item) => <button key={item} className={`filter ${category === item ? 'active' : ''}`} onClick={() => setCategory(item)} data-testid={`button-filter-${item.toLowerCase()}`}>{item}</button>)}</div></div>{filtered.length ? <div className="product-grid">{filtered.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div> : <div className="empty-state"><Search size={30} /><h2 className="font-display text-2xl text-[hsl(var(--foreground))]">No jars found</h2><p className="mt-2">Try another search or clear the category filter.</p><button className="btn-quiet mt-5" onClick={() => { setQuery(''); setCategory('All'); }} data-testid="button-clear-filters">Clear filters</button></div>}</div></section></main>;
}

function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { products, addToCart } = useStore();
  const product = products.find((item) => item.id === id);
  const [quantity, setQuantity] = useState(1);
  if (!product) return <NotFound />;
  return <main><section className="section"><div className="container-vlc detail-layout"><div className="detail-art reveal"><img src={logoAsset} alt={`${product.name} jar`} /></div><div className="detail-info reveal reveal-delay-1"><span className="eyebrow">{product.category} · {product.weight} · {product.badge}</span><h1>{product.name}</h1><p>{product.description}</p><p className="mt-4">{product.story}</p><div className="detail-price">₹{product.price} <span className="text-[.7rem] text-[hsl(var(--muted-foreground))]">per {product.weight}</span></div><div className="flex flex-wrap items-center gap-2"><div className="quantity-picker" aria-label="Choose quantity"><button onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Decrease quantity" data-testid="button-decrease-quantity"><Minus size={15} /></button><span data-testid="text-product-quantity">{quantity}</span><button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} aria-label="Increase quantity" data-testid="button-increase-quantity"><Plus size={15} /></button></div><button className="btn-primary" onClick={() => addToCart(product.id, quantity)} disabled={!product.stock} data-testid={`button-detail-add-${product.id}`}><ShoppingBasket size={16} /> Add to basket</button></div><div className="notice mt-7"><BadgeCheck size={17} className="shrink-0 text-[hsl(var(--primary))]" /><span>{product.stock ? `${product.stock} jars currently in this batch.` : 'This batch has sold out. Check back soon.'} Made with seafood, spice, and a lot of care.</span></div><div className="mt-8 border-t border-[hsl(var(--border))] pt-6"><p className="font-mono-brand text-[.62rem] uppercase tracking-widest text-[hsl(var(--muted-foreground))]">What is inside</p><p className="mt-2 text-sm leading-6">{product.ingredients}</p></div></div></div></section></main>;
}

function CartPage() {
  const { products, cart, changeQuantity, removeFromCart, checkout, whatsapp, toast } = useStore();
  const [customer, setCustomer] = useState({ name: '', phone: '', address: '', note: '' });
  const [complete, setComplete] = useState<Order | null>(null);
  const lines = cart.map((line) => ({ ...line, product: products.find((item) => item.id === line.productId)! })).filter((line) => line.product);
  const total = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const update = (field: keyof typeof customer, value: string) => setCustomer((current) => ({ ...current, [field]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!customer.name || !customer.phone || !customer.address) return toast('Please add your name, phone, and address first.');
    try {
      const result = await checkout(customer);
      setComplete(result.order);
      if (!result.whatsappOpened) toast('Order saved as a draft. Add the shop WhatsApp number in Admin to send it.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'We could not save this order.');
    }
  };
  if (complete) return <main><section className="section"><div className="container-vlc max-w-[650px] text-center"><div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><ClipboardList size={33} /></div><span className="eyebrow mt-7 block">Order draft created</span><h1 className="section-title mt-3">Thank you,<br />{complete.customer.name.split(' ')[0]}.</h1><p className="mx-auto mt-6 max-w-[500px] text-sm leading-7 text-[hsl(var(--muted-foreground))]">{whatsapp ? 'WhatsApp should be open with your order details. The VLC kitchen will reply to confirm everything.' : 'Your order is safely saved in this demo. The owner needs to set a WhatsApp number in Admin before it can be sent.'}</p><div className="panel mt-8 text-left"><div className="summary-row"><span>Order reference</span><strong>{complete.id}</strong></div><div className="summary-row summary-total"><span>Total</span><strong>₹{complete.total}</strong></div></div><div className="mt-7 flex justify-center gap-3"><Link className="btn-primary" href="/shop" data-testid="link-success-shop">Keep browsing</Link><Link className="btn-quiet" href="/" data-testid="link-success-home">Back home</Link></div></div></section></main>;
  if (!lines.length) return <main><section className="section"><div className="container-vlc"><div className="empty-state"><ShoppingBasket size={34} /><span className="eyebrow">Your basket is waiting</span><h1 className="font-display mt-3 text-4xl text-[hsl(var(--foreground))]">Nothing in the cupboard yet.</h1><p className="mx-auto mt-3 max-w-[420px]">Pick a jar, find a favourite, and we will pack it up for your table.</p><Link href="/shop" className="btn-primary mt-7" data-testid="link-empty-cart-shop">Browse pickles <ArrowRight size={15} /></Link></div></div></section></main>;
  return <main><section className="page-hero"><div className="container-vlc"><span className="eyebrow">Almost ready for the table</span><h1>Your basket.</h1></div></section><section className="section"><div className="container-vlc cart-layout"><div className="panel"><h2>Selected jars <span className="font-mono-brand text-sm text-[hsl(var(--muted-foreground))]">({cart.reduce((sum, item) => sum + item.quantity, 0)})</span></h2>{lines.map(({ product, quantity }) => <div className="cart-line" key={product.id}><img src={logoAsset} alt="" /><div><h3>{product.name}</h3><p>₹{product.price} · {product.weight}</p><div className="line-actions"><button onClick={() => changeQuantity(product.id, quantity - 1)} aria-label={`Decrease ${product.name}`} data-testid={`button-cart-decrease-${product.id}`}><Minus size={13} /></button><span className="font-mono-brand text-xs">{quantity}</span><button onClick={() => changeQuantity(product.id, quantity + 1)} aria-label={`Increase ${product.name}`} data-testid={`button-cart-increase-${product.id}`}><Plus size={13} /></button><button onClick={() => removeFromCart(product.id)} data-testid={`button-remove-${product.id}`}>Remove</button></div></div><strong className="font-mono-brand text-sm">₹{product.price * quantity}</strong></div>)}</div><div className="grid gap-5"><div className="panel"><h2>Send your order</h2>{whatsapp ? <div className="notice mb-5"><Zap size={17} className="shrink-0 text-[hsl(var(--accent))]" /><span>This will open WhatsApp with a ready-to-send message to VLC Pickles.</span></div> : <div className="notice danger mb-5"><CircleAlert size={17} className="shrink-0 text-[hsl(var(--accent))]" /><span>WhatsApp is not configured yet. Your draft will save, but sending needs the shop number in Admin.</span></div>}<form className="checkout-form" onSubmit={submit}><div className="field"><label htmlFor="customer-name">Your name</label><input id="customer-name" value={customer.name} onChange={(event) => update('name', event.target.value)} placeholder="Who should we address?" required data-testid="input-customer-name" /></div><div className="field"><label htmlFor="customer-phone">Phone number</label><input id="customer-phone" value={customer.phone} onChange={(event) => update('phone', event.target.value)} placeholder="For delivery coordination" required data-testid="input-customer-phone" /></div><div className="field"><label htmlFor="customer-address">Delivery address</label><textarea id="customer-address" value={customer.address} onChange={(event) => update('address', event.target.value)} placeholder="House, street, town, pin code" required data-testid="input-customer-address" /></div><div className="field"><label htmlFor="customer-note">Note <span>(optional)</span></label><input id="customer-note" value={customer.note} onChange={(event) => update('note', event.target.value)} placeholder="Anything the kitchen should know?" data-testid="input-customer-note" /></div><div className="summary-row summary-total"><span>Total</span><strong>₹{total}</strong></div><button className="btn-accent w-full" type="submit" data-testid="button-send-order">{whatsapp ? 'Review & open WhatsApp' : 'Save order draft'} <ArrowRight size={16} /></button></form></div></div></div></section></main>;
}

function ProductModal({ product, onClose }: { product?: Product; onClose: () => void }) {
  const { saveProduct } = useStore();
  const [form, setForm] = useState<Product>(product ?? { ...seedProducts[0], id: '', name: '', stock: 0 });
  const update = (field: keyof Product, value: string) => setForm((current) => ({ ...current, [field]: ['price', 'stock'].includes(field) ? Number(value) : value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    saveProduct({ ...form, id: form.id || form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') });
    onClose();
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title"><div className="modal-head"><h2 id="product-modal-title">{product ? 'Edit jar' : 'Add a jar'}</h2><button className="icon-btn" onClick={onClose} aria-label="Close product form" data-testid="button-close-product-modal"><X size={20} /></button></div><form className="checkout-form" onSubmit={submit}><div className="field"><label htmlFor="product-name">Product name</label><input id="product-name" value={form.name} onChange={(event) => update('name', event.target.value)} required data-testid="input-product-name" /></div><div className="grid grid-cols-2 gap-3"><div className="field"><label htmlFor="product-price">Price in rupees</label><input id="product-price" type="number" min="0" value={form.price} onChange={(event) => update('price', event.target.value)} required data-testid="input-product-price" /></div><div className="field"><label htmlFor="product-stock">Stock count</label><input id="product-stock" type="number" min="0" value={form.stock} onChange={(event) => update('stock', event.target.value)} required data-testid="input-product-stock" /></div></div><div className="grid grid-cols-2 gap-3"><div className="field"><label htmlFor="product-category">Category</label><select id="product-category" value={form.category} onChange={(event) => update('category', event.target.value)} data-testid="select-product-category"><option>Fish</option><option>Shellfish</option><option>Special batch</option></select></div><div className="field"><label htmlFor="product-weight">Weight</label><input id="product-weight" value={form.weight} onChange={(event) => update('weight', event.target.value)} required data-testid="input-product-weight" /></div></div><div className="field"><label htmlFor="product-description">Short description</label><textarea id="product-description" value={form.description} onChange={(event) => update('description', event.target.value)} required data-testid="input-product-description" /></div><div className="field"><label htmlFor="product-ingredients">Ingredients</label><input id="product-ingredients" value={form.ingredients} onChange={(event) => update('ingredients', event.target.value)} required data-testid="input-product-ingredients" /></div><button className="btn-primary w-full" type="submit" data-testid="button-save-product"><BadgeCheck size={16} /> Save to shelf</button></form></div></div>;
}

function AdminPage() {
  const { products, orders, whatsapp, saveWhatsapp, deleteProduct, updateOrderStatus } = useStore();
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState<Product | undefined>();
  const [adding, setAdding] = useState(false);
  const [phone, setPhone] = useState(whatsapp);
  const totalStock = products.reduce((sum, product) => sum + product.stock, 0);
  return <main><section className="page-hero"><div className="container-vlc"><span className="eyebrow">Owner's shelf · demo mode</span><h1>Kitchen<br />control room.</h1><p className="mt-5 max-w-[530px] text-sm leading-7 text-[hsl(var(--muted-foreground))]">A local first dashboard for keeping the jars, stock, and incoming orders in order.</p></div></section><section className="section"><div className="container-vlc"><div className="notice danger mb-7"><CircleAlert size={18} className="shrink-0 text-[hsl(var(--accent))]" /><span><strong>Demo mode:</strong> this area has no real authentication yet. Product, order, and WhatsApp settings are stored only in this browser's localStorage.</span></div><div className="admin-layout"><aside className="admin-nav"><h2>VLC owner</h2><button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')} data-testid="button-admin-overview"><Home size={16} /> Overview</button><button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')} data-testid="button-admin-products"><Package size={16} /> Products & stock</button><button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')} data-testid="button-admin-orders"><ClipboardList size={16} /> Orders</button><button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')} data-testid="button-admin-settings"><Settings size={16} /> WhatsApp settings</button></aside><div className="admin-content">
      {tab === 'overview' && <><div className="admin-header"><div><h1>Good morning, kitchen.</h1><p className="text-sm text-[hsl(var(--muted-foreground))]">Here is what is happening on the shelf.</p></div><button className="btn-accent" onClick={() => setTab('products')} data-testid="button-admin-quick-add"><Plus size={16} /> Add a jar</button></div><div className="stat-grid"><div className="stat"><small>Jars on shelf</small><strong>{products.length}</strong></div><div className="stat"><small>Total stock</small><strong>{totalStock}</strong></div><div className="stat"><small>Order drafts</small><strong>{orders.length}</strong></div></div><div className="panel"><h2>Latest orders</h2>{orders.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Reference</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead><tbody>{orders.slice(0, 5).map((order) => <tr key={order.id}><td className="font-mono-brand">{order.id}</td><td>{order.customer.name}</td><td>₹{order.total}</td><td><span className="badge">{order.status}</span></td></tr>)}</tbody></table></div> : <div className="empty-state !p-8"><ClipboardList size={25} /><p>No orders yet. They will appear here after checkout.</p></div>}</div></>}
      {tab === 'products' && <><div className="admin-header"><div><h1>Products & stock</h1><p className="text-sm text-[hsl(var(--muted-foreground))]">Keep the shelf honest and the batches moving.</p></div><button className="btn-primary" onClick={() => setAdding(true)} data-testid="button-add-product"><Plus size={16} /> Add product</button></div><div className="panel"><div className="table-wrap"><table className="data-table"><thead><tr><th>Jar</th><th>Category</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><strong>{product.name}</strong><br /><span className="text-[.65rem] text-[hsl(var(--muted-foreground))]">{product.weight}</span></td><td>{product.category}</td><td>₹{product.price}</td><td><span className={`badge ${product.stock < 10 ? 'low' : ''}`}>{product.stock} jars</span></td><td><div className="flex gap-1"><button className="icon-btn" onClick={() => setEditing(product)} aria-label={`Edit ${product.name}`} data-testid={`button-edit-product-${product.id}`}><Pencil size={16} /></button><button className="icon-btn" onClick={() => window.confirm(`Remove ${product.name} from the shelf?`) && deleteProduct(product.id)} aria-label={`Delete ${product.name}`} data-testid={`button-delete-product-${product.id}`}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div></div></>}
      {tab === 'orders' && <><div className="admin-header"><div><h1>Incoming orders</h1><p className="text-sm text-[hsl(var(--muted-foreground))]">Drafts saved from this browser appear here.</p></div></div><div className="panel">{orders.length ? <div className="grid gap-4">{orders.map((order) => <div key={order.id} className="rounded-xl border border-[hsl(var(--border))] p-4"><div className="flex flex-wrap justify-between gap-3"><div><span className="font-mono-brand text-[.65rem] text-[hsl(var(--accent))]">{order.id}</span><h3 className="font-display text-xl">{order.customer.name}</h3><p className="text-xs text-[hsl(var(--muted-foreground))]">{order.customer.phone} · {order.customer.address}</p></div><select className="field rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs" value={order.status} onChange={(event) => updateOrderStatus(order.id, event.target.value as Order['status'])} aria-label={`Status for ${order.id}`} data-testid={`select-order-status-${order.id}`}><option value="draft">Draft</option><option value="confirmed">Confirmed</option><option value="packed">Packed</option></select></div><div className="mt-4 flex flex-wrap gap-2 text-xs">{order.items.map((item) => <span className="badge" key={item.productId}>{item.name} × {item.quantity}</span>)}<strong className="ml-auto font-mono-brand">₹{order.total}</strong></div></div>)}</div> : <div className="empty-state"><ClipboardList size={30} /><h2 className="font-display text-2xl text-[hsl(var(--foreground))]">A quiet order book</h2><p className="mt-2">Orders will land here when customers check out.</p></div>}</div></>}
      {tab === 'settings' && <><div className="admin-header"><div><h1>WhatsApp settings</h1><p className="text-sm text-[hsl(var(--muted-foreground))]">This is where the kitchen receives orders.</p></div></div><div className="panel max-w-[620px]"><div className="notice mb-6"><Zap size={18} className="shrink-0 text-[hsl(var(--accent))]" /><span>Use the full shop number with country code. For India, start with 91 and leave out the + sign.</span></div><form className="checkout-form" onSubmit={(event) => { event.preventDefault(); saveWhatsapp(phone); }}><div className="field"><label htmlFor="admin-whatsapp">Shop WhatsApp number</label><input id="admin-whatsapp" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="919876543210" inputMode="tel" data-testid="input-admin-whatsapp" /></div><button className="btn-primary self-start" type="submit" data-testid="button-save-whatsapp"><Settings size={16} /> Save WhatsApp number</button></form><div className="mt-7 border-t border-[hsl(var(--border))] pt-5"><p className="font-mono-brand text-[.62rem] uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Current setup</p><p className="mt-2 text-sm">{whatsapp ? `Ready to send to +${whatsapp}` : 'Not configured yet — checkout will save drafts only.'}</p></div></div></>}
      </div></div></div></section></main>;
}

function NotFound() {
  return <main><section className="section"><div className="container-vlc empty-state"><Compass size={34} /><span className="eyebrow">That page wandered off</span><h1 className="font-display mt-3 text-5xl text-[hsl(var(--foreground))]">Nothing here.</h1><Link href="/" className="btn-primary mt-7" data-testid="link-not-found-home">Back to the kitchen <Home size={15} /></Link></div></section></main>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><AppShell><Switch><Route path="/" component={HomePage} /><Route path="/shop" component={ShopPage} /><Route path="/product/:id" component={ProductPage} /><Route path="/cart" component={CartPage} /><Route path="/admin" component={AdminPage} /><Route component={NotFound} /></Switch></AppShell></ErrorBoundary>;
}

function App() {
  return <StoreProvider><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></StoreProvider>;
}

export default App;