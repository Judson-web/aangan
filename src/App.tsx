import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, ArrowUpRight, Check,
  Heart, Leaf, Menu, Minus, Plus, Search, ShoppingBag, X,
} from "lucide-react";
import { categories, formatPrice, products, type Category, type Product } from "./catalog";

type CartLine = { productId: string; quantity: number };
type Panel = "cart" | "menu" | null;
const CART_KEY = "aangan-cart-v1";
const WISHLIST_KEY = "aangan-wishlist-v1";

function readCart(): CartLine[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CART_KEY) ?? "null");
    if (!Array.isArray(value)) return [];
    return value.filter((line): line is CartLine =>
      typeof line === "object" && line !== null &&
      "productId" in line && typeof line.productId === "string" &&
      products.some((product) => product.id === line.productId) &&
      "quantity" in line && typeof line.quantity === "number" &&
      Number.isSafeInteger(line.quantity) && line.quantity > 0,
    );
  } catch {
    return [];
  }
}

function readWishlist(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(WISHLIST_KEY) ?? "null");
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((id): id is string =>
      typeof id === "string" && products.some((product) => product.id === id),
    ))];
  } catch {
    return [];
  }
}

function persist(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The storefront remains usable when browser storage is unavailable.
  }
}

function BrandMark() {
  return <a className="brand" href="#top" aria-label="Aangan home">
    <span className="brand-symbol" aria-hidden="true"><span /><span /><span /><span /></span>
    <span className="brand-word">aangan<span className="brand-dot">.</span><small>MADE WITH MEANING</small></span>
  </a>;
}

function ProductCard({ product, wished, onWish, onOpen, onAdd }: {
  product: Product; wished: boolean; onWish: (id: string) => void;
  onOpen: (product: Product) => void; onAdd: (product: Product) => void;
}) {
  return <article className="product-card">
    <div className="product-image-wrap">
      <button className="image-button" onClick={() => onOpen(product)} aria-label={`View ${product.name}`}>
        <img src={product.image} alt={product.name} loading="lazy" />
      </button>
      {product.badge && <span className="product-badge">{product.badge}</span>}
      <button className={`wish-button ${wished ? "is-wished" : ""}`} onClick={() => onWish(product.id)} aria-label={wished ? "Remove from wishlist" : "Add to wishlist"} aria-pressed={wished}>
        <Heart size={17} fill={wished ? "currentColor" : "none"} />
      </button>
      <button className="quick-add" onClick={() => onAdd(product)}><Plus size={15} /> Add to bag</button>
    </div>
    <div className="product-meta"><span>{product.maker}</span><span>{product.category}</span></div>
    <button className="product-name" onClick={() => onOpen(product)}>{product.name}</button>
    <div className="price-line"><strong>{formatPrice(product.price)}</strong>{product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}</div>
  </article>;
}

function App() {
  const [category, setCategory] = useState<Category>("All");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartLine[]>(readCart);
  const [wishlist, setWishlist] = useState<string[]>(readWishlist);
  const [toast, setToast] = useState("");
  const [newsletter, setNewsletter] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);

  useEffect(() => { persist(CART_KEY, cart); }, [cart]);
  useEffect(() => { persist(WISHLIST_KEY, wishlist); }, [wishlist]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setActiveProduct(null); setPanel(null); setSearchOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visibleProducts = useMemo(() => products.filter((product) => {
    const matchesCategory = category === "All" || product.category === category;
    const haystack = `${product.name} ${product.maker} ${product.category} ${product.origin}`.toLowerCase();
    return matchesCategory && haystack.includes(query.trim().toLowerCase()) && (!savedOnly || wishlist.includes(product.id));
  }), [category, query, savedOnly, wishlist]);
  const cartCount = cart.reduce((total, line) => total + line.quantity, 0);
  const cartTotal = cart.reduce((total, line) => {
    const product = products.find((item) => item.id === line.productId);
    return total + (product?.price ?? 0) * line.quantity;
  }, 0);

  const addToCart = (product: Product) => {
    setCart((current) => {
      const found = current.some((line) => line.productId === product.id);
      return found
        ? current.map((line) => line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { productId: product.id, quantity: 1 }];
    });
    setToast(`${product.name} added to your bag`);
  };
  const changeQuantity = (id: string, delta: number) => setCart((current) =>
    current.map((line) => line.productId === id ? { ...line, quantity: line.quantity + delta } : line)
      .filter((line) => line.quantity > 0));
  const toggleWish = (id: string) => {
    const exists = wishlist.includes(id);
    setWishlist((current) => exists
      ? current.filter((item) => item !== id)
      : [...current, id]);
    setToast(exists ? "Removed from your saved pieces" : "Saved for another day");
  };
  const chooseCategory = (next: Category) => {
    setCategory(next);
    setPanel(null);
    document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" });
  };

  return <div id="top" className="site-shell">
    <div className="announcement"><span>Complimentary shipping on orders above ₹2,500</span></div>
    <header className="site-header">
      <button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setPanel("menu")}><Menu /></button>
      <nav className="desktop-nav" aria-label="Main navigation">
        <a href="#collection" onClick={() => setCategory("All")}>Shop all</a>
        <a href="#categories">Discover</a>
        <a href="#story">Our story</a>
      </nav>
      <BrandMark />
      <div className="header-actions">
        <button className="icon-button search-trigger" aria-label="Search products" onClick={() => setSearchOpen((open) => !open)}><Search /></button>
        <button className="icon-button wishlist-trigger" aria-label={`Wishlist, ${wishlist.length} saved`} onClick={() => { setCategory("All"); setQuery(""); setSavedOnly((value) => !value); document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" }); }}><Heart fill={savedOnly ? "currentColor" : "none"} /></button>
        <button className="bag-trigger" onClick={() => setPanel("cart")} aria-label={`Shopping bag, ${cartCount} items`}><ShoppingBag size={19} /><span>Bag</span><b>{cartCount}</b></button>
      </div>
    </header>

    {searchOpen && <div className="search-bar"><Search size={18} /><input autoFocus value={query} onChange={(event) => { setQuery(event.target.value); setCategory("All"); }} placeholder="Search pieces, makers, places..." aria-label="Search catalogue" /><button onClick={() => { setQuery(""); setSearchOpen(false); }} aria-label="Close search"><X size={18} /></button></div>}

    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-line" /> THE ART OF EVERYDAY LIVING</p>
          <h1>Find beauty in<br /><em>the things</em> we keep.</h1>
          <p className="hero-description">Objects with soul. Made by hand, across India.</p>
          <a className="primary-link" href="#collection">Shop the edit <ArrowUpRight size={16} /></a>
          <div className="hero-footnote"><span>01 / 04</span><span className="footnote-rule" /><span>CRAFTED IN INDIA</span></div>
        </div>
        <div className="hero-art">
          <img src="https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=1400&q=90" alt="Handcrafted ceramic vessels arranged in warm natural light" />
          <div className="hero-stamp"><span>MADE</span><strong>slowly</strong><span>WITH CARE</span><i>✳</i></div>
          <div className="hero-caption">Crafted to be kept <span>↗</span></div>
        </div>
        <span className="hero-side-note">A LITTLE LESS ORDINARY · A LITTLE MORE YOU</span>
      </section>

      <section className="categories-section section-pad" id="categories">
        <div className="section-heading">
          <div><p className="eyebrow">SHOP BY CATEGORY</p><h2>Find your <em>favourite.</em></h2></div>
        </div>
        <div className="category-grid">
          {categories.map((item, index) => <button className="category-card" key={item.name} onClick={() => chooseCategory(item.name)}>
            <div className="category-image"><img src={item.image} alt="" loading="lazy" /><span>0{index + 1}</span><ArrowUpRight size={20} /></div>
            <div className="category-caption"><span><strong>{item.name}</strong></span><ArrowRight size={17} /></div>
          </button>)}
        </div>
      </section>

      <section className="collection-section section-pad" id="collection">
        <div className="section-heading collection-heading">
          <div><p className="eyebrow">THE COLLECTION</p><h2>Made to <em>belong.</em></h2></div>
        </div>
        <div className="collection-toolbar">
          <div className="filter-list" role="group" aria-label="Filter by category">
            {(["All", "Home", "Wear", "Jewellery", "Art"] as Category[]).map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => { setCategory(item); setSavedOnly(false); }}>{item}</button>)}
          </div>
          <span>{visibleProducts.length} pieces</span>
        </div>
        {savedOnly && <div className="saved-filter-note">Saved pieces <button onClick={() => setSavedOnly(false)}>Show all</button></div>}
        {visibleProducts.length ? <div className="product-grid">
          {visibleProducts.map((product) => <ProductCard key={product.id} product={product} wished={wishlist.includes(product.id)} onWish={toggleWish} onOpen={setActiveProduct} onAdd={addToCart} />)}
        </div> : <div className="empty-results"><Search size={24} /><h3>Nothing found just yet.</h3><p>Try another search or browse the full collection.</p><button className="text-link" onClick={() => { setQuery(""); setCategory("All"); }}>Clear filters <ArrowRight size={15} /></button></div>}
        <div className="collection-bottom"><span>CRAFTED ACROSS INDIA</span><a href="#categories">Browse categories <ArrowUpRight size={15} /></a></div>
      </section>

      <section className="maker-section" id="story">
        <div className="maker-image"><img src="https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=1200&q=90" alt="Artisan hands shaping a ceramic vessel" loading="lazy" /><span className="image-index">THE MAKER'S HAND</span></div>
        <div className="maker-copy"><p className="eyebrow">THE PEOPLE BEHIND IT</p><h2>Made by hand.<br /><em>Made to last.</em></h2><p>Every piece carries the skill and story of the hands that made it.</p><a className="primary-link" href="#collection">Meet the makers <ArrowUpRight size={16} /></a><div className="maker-signoff">A little more human, by design. <span>✳</span></div></div>
      </section>

      <section className="newsletter-section" id="newsletter">
        <div><p className="eyebrow">THE AANGAN LETTER</p><h2>A little note<br /><em>now and then.</em></h2></div>
        <div className="newsletter-copy"><p>New makers, fresh finds, once in a while.</p>
          <form className="newsletter-form" onSubmit={(event) => { event.preventDefault(); if (newsletter.includes("@") && newsletter.includes(".")) { setSubscribed(true); setNewsletter(""); } }}>
            <label className="sr-only" htmlFor="newsletter-email">Your email address</label><input id="newsletter-email" type="email" required placeholder="Your email address" value={newsletter} onChange={(event) => setNewsletter(event.target.value)} />
            <button type="submit" aria-label="Subscribe"><ArrowUpRight size={20} /></button>
          </form><span className="newsletter-note">{subscribed ? "You're on the list. Thank you for being here." : "Occasional mail. Unsubscribe anytime."}</span>
        </div>
      </section>
    </main>

    <footer className="site-footer">
      <div className="footer-top"><div><BrandMark /></div><div className="footer-links"><div><strong>EXPLORE</strong><a href="#collection">Shop all</a><a href="#categories">Categories</a><a href="#story">Our story</a></div><div><strong>THE DETAILS</strong><a href="#top">Shipping & returns</a><a href="#top">Care guide</a><a href="#top">Get in touch</a></div><div><strong>FOLLOW ALONG</strong><a href="#top">Instagram ↗</a><a href="#top">Pinterest ↗</a></div></div></div>
      <div className="footer-bottom"><span>© 2026 AANGAN STUDIO</span><span>MADE WITH MEANING, IN INDIA <i>✳</i></span><a href="#top">BACK TO TOP ↑</a></div>
    </footer>

    {panel && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setPanel(null); }}>
      <aside className={`drawer ${panel === "menu" ? "menu-drawer" : ""}`} aria-label={panel === "cart" ? "Shopping bag" : "Navigation menu"}>
        <div className="drawer-head"><span>{panel === "cart" ? `YOUR BAG · ${cartCount}` : "MENU"}</span><button className="icon-button" onClick={() => setPanel(null)} aria-label="Close panel"><X /></button></div>
        {panel === "menu" ? <nav className="drawer-nav">{(["All", "Home", "Wear", "Jewellery", "Art"] as Category[]).map((item) => <button key={item} onClick={() => chooseCategory(item)}>{item === "All" ? "Shop everything" : item}<ArrowUpRight size={18} /></button>)}<a href="#story" onClick={() => setPanel(null)}>Our story <ArrowUpRight size={18} /></a></nav> :
        <>{cart.length ? <div className="cart-lines">{cart.map((line) => {
          const product = products.find((item) => item.id === line.productId);
          if (!product) return null;
          return <div className="cart-line" key={line.productId}><img src={product.image} alt="" /><div className="cart-line-info"><span>{product.maker}</span><strong>{product.name}</strong><b>{formatPrice(product.price)}</b><div className="quantity-control"><button onClick={() => changeQuantity(product.id, -1)} aria-label="Decrease quantity"><Minus size={13} /></button><span>{line.quantity}</span><button onClick={() => changeQuantity(product.id, 1)} aria-label="Increase quantity"><Plus size={13} /></button></div></div><button className="remove-line" onClick={() => setCart((current) => current.filter((item) => item.productId !== product.id))} aria-label={`Remove ${product.name}`}><X size={16} /></button></div>;
        })}</div> : <div className="cart-empty"><ShoppingBag size={32} /><h3>Your bag is taking a breather.</h3><p>Find something thoughtful to bring home.</p><button className="primary-link" onClick={() => { setPanel(null); document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" }); }}>Explore the collection <ArrowRight size={15} /></button></div>}
        {cart.length > 0 && <div className="cart-summary"><div><span>Subtotal</span><strong>{formatPrice(cartTotal)}</strong></div><p>Shipping and taxes are calculated at checkout.</p><button className="checkout-button" onClick={() => setToast("Checkout will be available when the shop is connected.")}>Continue to checkout <ArrowRight size={17} /></button><small>Checkout is a preview. No payment will be taken.</small></div>}</>}
      </aside>
    </div>}

    {activeProduct && <div className="overlay modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveProduct(null); }}>
      <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close icon-button" onClick={() => setActiveProduct(null)} aria-label="Close product details"><X /></button><div className="modal-image"><img src={activeProduct.image} alt={activeProduct.name} /></div><div className="modal-copy"><p className="eyebrow">{activeProduct.category} · {activeProduct.maker}</p><h2 id="modal-title">{activeProduct.name}</h2><strong className="modal-price">{formatPrice(activeProduct.price)}</strong><p>{activeProduct.description}</p><dl><div><dt>Material</dt><dd>{activeProduct.material}</dd></div><div><dt>Made in</dt><dd>{activeProduct.origin}</dd></div></dl><button className="checkout-button" onClick={() => { addToCart(activeProduct); setActiveProduct(null); }}>Add to bag <Plus size={17} /></button><button className="modal-wish" onClick={() => toggleWish(activeProduct.id)}><Heart size={16} fill={wishlist.includes(activeProduct.id) ? "currentColor" : "none"} /> {wishlist.includes(activeProduct.id) ? "Saved to your wishlist" : "Save for later"}</button></div></section>
    </div>}

    <nav className="mobile-dock" aria-label="Quick navigation"><a href="#top" aria-label="Home"><Leaf size={19} /><span>Home</span></a><button onClick={() => setSearchOpen(true)} aria-label="Search"><Search size={19} /><span>Search</span></button><button onClick={() => { setSavedOnly(true); setCategory("All"); document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" }); }} aria-label="Saved pieces"><Heart size={19} /><span>Saved</span></button><button onClick={() => setPanel("cart")} aria-label={`Bag, ${cartCount} items`}><ShoppingBag size={19} /><span>Bag{cartCount ? ` · ${cartCount}` : ""}</span></button></nav>
    {toast && <div className="toast" role="status"><Check size={16} />{toast}<button onClick={() => setToast("")} aria-label="Dismiss notification"><X size={14} /></button></div>}
  </div>;
}

export default App;
