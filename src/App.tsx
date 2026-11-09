import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Check, Heart, Leaf, UserRound,
  Menu, Minus, Plus, Search, ShieldCheck, ShoppingBag, X,
} from "lucide-react";
import { categories, formatPrice, type Category, type Product } from "./catalog";
import AccountPage from "./Account";

type CartLine = { productId: string; quantity: number };
type SortOption = "featured" | "price-low" | "price-high" | "name";
const CART_KEY = "thrilokha-cart-v1";
const WISHLIST_KEY = "thrilokha-wishlist-v1";
const TURNSTILE_SITE_KEY = "0x4AAAAAAF5jPBnSE5tW7V28";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: {
        sitekey: string; theme?: "light" | "dark";
        callback: (token: string) => void;
        "error-callback"?: () => void;
        "expired-callback"?: () => void;
      }) => string;
      remove: (widgetId: string) => void;
    };
  }
}

function readStored<T>(key: string, fallback: T): T {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    return value === null ? fallback : value as T;
  } catch { return fallback; }
}
function saveStored(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional. */ }
}
function BrandMark() {
  return <a className="brand" href="/" aria-label="Thrilokha Shilpa home">
    <span className="brand-monogram">TS</span>
    <span className="brand-word">THRILOKHA <i>SHILPA</i><small>THE ART OF LIVING BEAUTIFULLY</small></span>
  </a>;
}
function TurnstileGate({ onVerified }: { onVerified: () => void }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!container) return;
    let widgetId: string | undefined;
    let cancelled = false;
    const mount = () => {
      if (cancelled || !window.turnstile || widgetId) return;
      setLoading(false);
      widgetId = window.turnstile.render(container, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "light",
        callback: async (token) => {
          setError("");
          try {
            const response = await fetch("/api/verify-human", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token }),
            });
            const result = await response.json() as { verified?: boolean; error?: string };
            if (!response.ok || !result.verified) throw new Error(result.error || "Verification could not be completed.");
            onVerified();
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Please try verification again.");
          }
        },
        "error-callback": () => setError("The verification challenge could not load. Check your connection and try again."),
        "expired-callback": () => setError("The challenge expired. Please verify again."),
      });
    };
    if (window.turnstile) mount();
    else {
      let script = document.querySelector<HTMLScriptElement>('script[data-turnstile="true"]');
      if (!script) {
        script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true; script.defer = true; script.dataset.turnstile = "true";
        document.head.appendChild(script);
      }
      script.addEventListener("load", mount);
      script.addEventListener("error", () => { setLoading(false); setError("Cloudflare verification is unavailable right now."); });
    }
    return () => { cancelled = true; if (widgetId && window.turnstile) window.turnstile.remove(widgetId); };
  }, [container, onVerified]);
  return <main className="verification-screen"><div className="verification-card">
    <BrandMark /><div className="verification-art"><span>✳</span><span>CRAFTED WITH INTENTION</span></div>
    <p className="eyebrow"><ShieldCheck size={14} /> A QUICK HUMAN CHECK</p>
    <h1>A moment before<br /><em>the beautiful things.</em></h1>
    <p>Help us keep this little marketplace welcoming for real people. Complete Cloudflare's secure check to continue.</p>
    <div className="turnstile-slot" ref={setContainer} />
    {loading && <span className="verification-loading">Loading secure verification…</span>}
    {error && <p className="verification-error" role="alert">{error}</p>}
    <small>Verification is remembered securely on this browser for 30 days.</small>
  </div></main>;
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
  const [pathname, setPathname] = useState(window.location.pathname);
  const [catalogue, setCatalogue] = useState<Product[]>([]);
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cart, setCart] = useState<CartLine[]>(() => readStored(CART_KEY, []));
  const [wishlist, setWishlist] = useState<string[]>(() => readStored(WISHLIST_KEY, []));
  const [toast, setToast] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("featured");

  const navigate = (path: string) => {
    window.history.pushState({}, "", path);
    setPathname(window.location.pathname);
    setMenuOpen(false); setSearchOpen(false); window.scrollTo({ top: 0, behavior: "instant" });
  };
  useEffect(() => {
    const onPop = () => { setPathname(window.location.pathname); window.scrollTo(0, 0); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => { fetch("/api/products").then(r=>r.json()).then((d:{products?:Array<{id:string;name:string;description:string;category:string;price:number;compare_at_price:number|null;image_url:string}>})=>setCatalogue((d.products??[]).map(p=>({id:p.id,name:p.name,maker:"THRILOKHA SHILPA",category:(["Home","Wear","Jewellery","Art"].includes(p.category)?p.category:"Art") as Exclude<Category,"All">,price:p.price,oldPrice:p.compare_at_price??undefined,image:p.image_url,badge:undefined,description:p.description,material:"See product details",origin:"India"})))).catch(()=>setCatalogue([])); }, []);
  useEffect(() => {
    let alive = true;
    fetch("/api/human-status", { credentials: "same-origin" })
      .then((response) => response.json() as Promise<{ verified?: boolean }>)
      .then((result) => { if (alive) setVerified(Boolean(result.verified)); })
      .catch(() => { if (alive) setVerified(false); })
      .finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, []);
  useEffect(() => { saveStored(CART_KEY, cart); }, [cart]);
  useEffect(() => { saveStored(WISHLIST_KEY, wishlist); }, [wishlist]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const routeCategory = pathname.startsWith("/shop/")
    ? (categories.find((item) => item.name.toLowerCase() === pathname.split("/")[2])?.name ?? "All")
    : "All";
  const effectiveCategory = pathname === "/shop" || pathname.startsWith("/shop/") ? routeCategory : "All";
  const visibleProducts = useMemo(() => {
    const filtered = catalogue.filter((product) => {
      const matchesCategory = effectiveCategory === "All" || product.category === effectiveCategory;
      const haystack = `${product.name} ${product.maker} ${product.category} ${product.origin}`.toLowerCase();
      const matchesSearch = haystack.includes(query.trim().toLowerCase());
      const matchesWishlist = pathname !== "/wishlist" || wishlist.includes(product.id);
      return matchesCategory && matchesSearch && matchesWishlist;
    });
    if (sortBy === "price-low") filtered.sort((a, b) => a.price - b.price);
    if (sortBy === "price-high") filtered.sort((a, b) => b.price - a.price);
    if (sortBy === "name") filtered.sort((a, b) => a.name.localeCompare(b.name));
    return filtered;
  }, [effectiveCategory, query, sortBy, pathname, wishlist]);
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cart.reduce((sum, line) => sum + (catalogue.find((item) => item.id === line.productId)?.price ?? 0) * line.quantity, 0);
  const activeProduct = pathname.startsWith("/product/") ? catalogue.find((item) => item.id === pathname.split("/")[2]) : undefined;

  const addToCart = (product: Product) => {
    setCart((current) => current.some((line) => line.productId === product.id)
      ? current.map((line) => line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line)
      : [...current, { productId: product.id, quantity: 1 }]);
    setToast(`${product.name} added to Cart`);
  };
  const changeQuantity = (id: string, delta: number) => setCart((current) =>
    current.map((line) => line.productId === id ? { ...line, quantity: line.quantity + delta } : line).filter((line) => line.quantity > 0));
  const toggleWish = (id: string) => {
    const exists = wishlist.includes(id);
    setWishlist((current) => exists ? current.filter((item) => item !== id) : [...current, id]);
    setToast(exists ? "Removed from your saved pieces" : "Saved for another day");
  };
  const shop = (next: Category = "All") => navigate(next === "All" ? "/shop" : `/shop/${next.toLowerCase()}`);
  const productGrid = (items: Product[]) => items.length
    ? <div className="product-grid">{items.map((product) => <ProductCard key={product.id} product={product} wished={wishlist.includes(product.id)} onWish={toggleWish} onOpen={(item) => navigate(`/product/${item.id}`)} onAdd={addToCart} />)}</div>
    : <div className="empty-results"><Search size={24} /><h3>Nothing found just yet.</h3><p>Try another search or browse the full collection.</p><button className="text-link" onClick={() => { setQuery(""); shop("All"); }}>Clear filters <ArrowRight size={15} /></button></div>;
  const collectionControls = <div className="collection-toolbar">
    <div className="filter-list" role="group" aria-label="Filter by category">
      {(["All", "Home", "Wear", "Jewellery", "Art"] as Category[]).map((item) => <button key={item} className={effectiveCategory === item ? "active" : ""} onClick={() => shop(item)}>{item}</button>)}
    </div>
    <div className="collection-controls"><span>{visibleProducts.length} pieces to discover</span><label className="sort-control"><span>Sort</span><select aria-label="Sort products" value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)}><option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name</option></select></label></div>
  </div>;

  if (checking) return <main className="verification-screen"><div className="verification-card"><BrandMark /><p>Preparing your visit…</p></div></main>;
  if (!verified) return <TurnstileGate onVerified={() => setVerified(true)} />;

  const isShop = pathname === "/shop" || pathname.startsWith("/shop/");
  return <div className="site-shell">
    <div className="announcement"><span>CRAFTED IN INDIA · DISCOVER OBJECTS WITH A STORY</span><span>COMPLIMENTARY SHIPPING ABOVE ₹2,500</span></div>
    <header className="site-header">
      <button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu /></button>
      <nav className="desktop-nav" aria-label="Main navigation">
        <button onClick={() => shop("All")}>Shop</button><button onClick={() => navigate("/collections")}>Collections</button><button onClick={() => navigate("/journal")}>The Edit</button><button onClick={() => navigate("/about")}>Our Story</button>
      </nav>
      <BrandMark />
      <div className="header-actions">
        <button className="icon-button search-trigger" aria-label="Search products" onClick={() => setSearchOpen((open) => !open)}><Search /></button>
        <button className="icon-button wishlist-trigger" aria-label={`Wishlist, ${wishlist.length} saved`} onClick={() => navigate("/wishlist")}><Heart /></button>
        <button className="icon-button account-trigger" aria-label="Your account" onClick={() => navigate("/profile")}><UserRound /></button>
        <button className="bag-trigger" onClick={() => navigate("/bag")} aria-label={`Shopping bag, ${cartCount} items`}><ShoppingBag size={19} /><span>Bag</span><b>{cartCount}</b></button>
      </div>
    </header>
    <div className="category-ribbon"><button onClick={() => shop("All")}>ALL OBJECTS</button>{categories.map((item) => <button key={item.name} onClick={() => shop(item.name)}>{item.name.toUpperCase()}</button>)}<span>THOUGHTFULLY FOUND · BEAUTIFULLY MADE</span></div>
    {searchOpen && <form className="search-bar" onSubmit={(event) => { event.preventDefault(); navigate("/shop"); }}><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search objects, makers, materials…" aria-label="Search catalogue" /><button type="button" onClick={() => { setQuery(""); setSearchOpen(false); }} aria-label="Close search"><X size={18} /></button><button className="search-submit" type="submit">SEARCH</button></form>}

    <main key={pathname}>
      {pathname === "/" && <>
        <section className="hero">
          <div className="hero-copy"><p className="eyebrow"><span className="eyebrow-line" /> THE ART OF EVERYDAY LIVING</p><h1>Objects of <em>beauty.</em><br />Stories to <em>keep.</em></h1><p className="hero-description">A considered world of Indian craft, design and everyday treasures.</p><button className="primary-link" onClick={() => shop("All")}>Discover the collection <ArrowUpRight size={16} /></button><div className="hero-footnote"><span>01 / 04</span><span className="footnote-rule" /><span>CRAFTED ACROSS INDIA</span></div></div>
          <div className="hero-art"><img src="https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=1400&q=90" alt="Handcrafted ceramic vessels arranged in warm natural light" /><div className="hero-stamp"><span>MADE</span><strong>slowly</strong><span>WITH CARE</span><i>✳</i></div><div className="hero-caption">Crafted to be kept <span>↗</span></div></div><span className="hero-side-note">A LITTLE LESS ORDINARY · A LITTLE MORE YOU</span>
        </section>
        <section className="categories-section section-pad"><div className="section-heading"><div><p className="eyebrow">THE THRILOKHA SHILPA EDIT</p><h2>Find your <em>favourite.</em></h2></div><button className="text-link" onClick={() => navigate("/collections")}>All collections <ArrowUpRight size={16} /></button></div><div className="category-grid">{categories.map((item, index) => <button className="category-card" key={item.name} onClick={() => shop(item.name)}><div className="category-image"><img src={item.image} alt="" loading="lazy" /><span>0{index + 1}</span><ArrowUpRight size={20} /></div><div className="category-caption"><span><strong>{item.name}</strong><small>{item.note}</small></span><ArrowRight size={17} /></div></button>)}</div></section>
        <section className="editorial-section"><div className="editorial-intro"><p className="eyebrow">A WORLD OF ART & ARTISTRY</p><h2>Little details.<br /><em>Lasting feeling.</em></h2><p>Objects that bring texture, character and a sense of belonging to the everyday.</p><button className="text-link" onClick={() => navigate("/journal")}>Read the journal <ArrowUpRight size={16} /></button><span className="editorial-flower">✳</span></div><button className="editorial-tile editorial-tile-large" onClick={() => shop("Home")}><img src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=90" alt="Warm artful home with natural textures" /><span className="tile-kicker">01 · THE SLOW HOME</span><span className="tile-title">Make room<br />for meaning <ArrowUpRight size={19} /></span></button><button className="editorial-tile editorial-tile-small" onClick={() => shop("Wear")}><img src="https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=900&q=90" alt="Indian handloom textile" /><span className="tile-kicker">02 · WOVEN STORIES</span><span className="tile-title">Wear your<br />own story <ArrowUpRight size={18} /></span></button><div className="editorial-note"><span>✳</span><p>Not mass made.<br />Made to mean more.</p><small>CRAFT · CULTURE · CONSIDERATION</small></div></section>
        <section className="promise-strip"><div><Leaf size={17} /><span>Independent makers</span></div><i /><div><Heart size={17} /><span>Chosen with intention</span></div><i /><div><ShoppingBag size={17} /><span>Thoughtful from cart to doorstep</span></div></section>
        <section className="collection-section section-pad"><div className="section-heading collection-heading"><div><p className="eyebrow">THE MOST LOVED</p><h2>Good things, <em>gathered.</em></h2><p className="collection-subtitle">A few beautiful places to begin.</p></div><button className="text-link" onClick={() => shop("All")}>Shop everything <ArrowUpRight size={16} /></button></div>{productGrid(catalogue.slice(0, 4))}</section>
        <section className="maker-section"><div className="maker-image"><img src="https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=1200&q=90" alt="Artisan hands shaping a ceramic vessel" loading="lazy" /><span className="image-index">THE MAKER'S HAND</span></div><div className="maker-copy"><p className="eyebrow">THE PEOPLE BEHIND IT</p><h2>Made by hand.<br /><em>Made to last.</em></h2><p>Every piece carries the skill and story of the hands that made it.</p><button className="primary-link" onClick={() => navigate("/about")}>Our story <ArrowUpRight size={16} /></button><div className="maker-signoff">A little more human, by design. <span>✳</span></div></div></section>
      </>}
      {(pathname === "/login" || pathname === "/profile" || pathname === "/admin") && <AccountPage mode={pathname.slice(1)} />}
      {isShop && <section className="collection-section section-pad route-section"><div className="breadcrumb"><button onClick={() => navigate("/")}>Home</button><span>/</span><span>Shop</span>{effectiveCategory !== "All" && <><span>/</span><span>{effectiveCategory}</span></>}</div><div className="section-heading collection-heading"><div><p className="eyebrow">THE COMPLETE COLLECTION</p><h1>{effectiveCategory === "All" ? <>Objects of <em>desire.</em></> : <>{effectiveCategory} <em>edit.</em></>}</h1><p className="collection-subtitle">Discover thoughtful pieces, selected for their craft, character and quiet beauty.</p></div></div>{collectionControls}{productGrid(visibleProducts)}</section>}
      {pathname === "/collections" && <section className="section-pad route-section"><div className="breadcrumb"><button onClick={() => navigate("/")}>Home</button><span>/</span><span>Collections</span></div><p className="eyebrow">CURATED BY FEELING</p><h1 className="route-title">A world of <em>beautiful things.</em></h1><div className="category-grid collection-route-grid">{categories.map((item, index) => <button className="category-card" key={item.name} onClick={() => shop(item.name)}><div className="category-image"><img src={item.image} alt="" /><span>0{index + 1}</span><ArrowUpRight size={20} /></div><div className="category-caption"><span><strong>{item.name}</strong><small>{item.note}</small></span><ArrowRight size={17} /></div></button>)}</div></section>}
      {pathname === "/wishlist" && <section className="collection-section section-pad route-section"><div className="breadcrumb"><button onClick={() => navigate("/")}>Home</button><span>/</span><span>Saved pieces</span></div><p className="eyebrow">YOUR PERSONAL EDIT</p><h1 className="route-title">Kept close to <em>heart.</em></h1>{productGrid(visibleProducts)}</section>}
      {pathname === "/bag" && <section className="bag-page section-pad route-section"><div className="breadcrumb"><button onClick={() => navigate("/")}>Home</button><span>/</span><span>Your bag</span></div><p className="eyebrow">A FEW GOOD THINGS</p><h1 className="route-title">Your <em>bag.</em></h1>{cart.length ? <div className="bag-layout"><div className="bag-lines">{cart.map((line) => { const product = catalogue.find((item) => item.id === line.productId); if (!product) return null; return <article className="bag-line" key={line.productId}><img src={product.image} alt={product.name} /><div><small>{product.maker}</small><h3>{product.name}</h3><strong>{formatPrice(product.price)}</strong><div className="quantity-control"><button onClick={() => changeQuantity(product.id, -1)} aria-label="Decrease quantity"><Minus size={13} /></button><span>{line.quantity}</span><button onClick={() => changeQuantity(product.id, 1)} aria-label="Increase quantity"><Plus size={13} /></button></div></div><button className="remove-line" onClick={() => setCart((current) => current.filter((entry) => entry.productId !== product.id))} aria-label={`Remove ${product.name}`}><X size={16} /></button></article>; })}</div><aside className="bag-summary"><p>ORDER SUMMARY</p><div><span>Subtotal</span><strong>{formatPrice(cartTotal)}</strong></div><div><span>Shipping</span><span>{cartTotal >= 2500 ? "Complimentary" : "Calculated later"}</span></div><button className="checkout-button" onClick={() => setToast("Secure checkout will be connected before launch.")}>Continue to checkout <ArrowRight size={17} /></button><small>Checkout preview only. No payment will be taken.</small></aside></div> : <div className="empty-results"><ShoppingBag size={28} /><h3>Your bag is waiting for a story.</h3><p>Find a piece that feels like it belongs with you.</p><button className="primary-link" onClick={() => shop("All")}>Explore the collection <ArrowRight size={15} /></button></div>}</section>}
      {activeProduct && <section className="product-page section-pad route-section"><div className="breadcrumb"><button onClick={() => navigate("/")}>Home</button><span>/</span><button onClick={() => shop(activeProduct.category)}>{activeProduct.category}</button><span>/</span><span>{activeProduct.name}</span></div><div className="product-detail"><div className="product-detail-image"><img src={activeProduct.image} alt={activeProduct.name} /></div><div className="product-detail-copy"><p className="eyebrow">{activeProduct.category} · {activeProduct.maker}</p><h1>{activeProduct.name}</h1><strong className="detail-price">{formatPrice(activeProduct.price)}</strong><p>{activeProduct.description}</p><dl><div><dt>Material</dt><dd>{activeProduct.material}</dd></div><div><dt>Made in</dt><dd>{activeProduct.origin}</dd></div></dl><button className="checkout-button" onClick={() => addToCart(activeProduct)}>Add to bag <Plus size={17} /></button><button className="modal-wish" onClick={() => toggleWish(activeProduct.id)}><Heart size={16} fill={wishlist.includes(activeProduct.id) ? "currentColor" : "none"} /> {wishlist.includes(activeProduct.id) ? "Saved to your wishlist" : "Save for later"}</button><button className="back-link" onClick={() => shop(activeProduct.category)}><ArrowLeft size={15} /> Back to {activeProduct.category}</button></div></div></section>}
      {pathname === "/journal" && <section className="journal-page route-section"><div className="journal-hero"><p className="eyebrow">THE THRILOKHA SHILPA JOURNAL</p><h1>On craft, culture<br />& <em>the considered life.</em></h1><p>Stories behind the objects, makers and traditions that make everyday life richer.</p></div><div className="journal-grid"><article><img src="https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=1100&q=85" alt="Hands shaping pottery" /><p className="eyebrow">THE MAKER'S PRACTICE</p><h2>The beauty of things made slowly.</h2><p>When a piece carries the rhythm of the hand, it carries a story beyond its shape.</p></article><article><img src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1100&q=85" alt="Warm home textures" /><p className="eyebrow">LIVING WITH ART</p><h2>Make space for the meaningful.</h2><p>Thoughtful objects invite us to notice the details we might otherwise pass by.</p></article></div></section>}
      {pathname === "/about" && <section className="about-page route-section"><div className="about-image"><img src="https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=1400&q=85" alt="Artisan hands shaping a ceramic vessel" /></div><div className="about-copy"><p className="eyebrow">OUR POINT OF VIEW</p><h1>Rooted in craft.<br /><em>Made for now.</em></h1><p>Thrilokha Shilpa is a celebration of objects with character: considered pieces shaped by skill, material and the makers behind them. We believe the things we live with should hold more than a price tag. They should hold a point of view, a sense of place and a little of the person who made them.</p><button className="primary-link" onClick={() => shop("All")}>Explore the collection <ArrowUpRight size={16} /></button></div></section>}
      {pathname === "/help" && <section className="help-page section-pad route-section"><p className="eyebrow">HERE TO HELP</p><h1 className="route-title">The little <em>details.</em></h1><div className="help-grid"><article><h2>Shipping</h2><p>Complimentary shipping is offered on preview orders above ₹2,500. Delivery timelines will be confirmed when fulfilment is connected.</p></article><article><h2>Returns</h2><p>Our return policy will be published before the store begins accepting live orders.</p></article><article><h2>Contact</h2><p>For questions about a piece or its maker, contact details will be added before launch.</p></article></div></section>}
    </main>
    <footer className="site-footer"><div className="footer-top"><div><BrandMark /><p className="footer-manifesto">A considered world of Indian craft, design and everyday treasures.</p></div><div className="footer-links"><div><strong>DISCOVER</strong><button onClick={() => shop("All")}>Shop all</button><button onClick={() => navigate("/collections")}>Collections</button><button onClick={() => navigate("/journal")}>The journal</button></div><div><strong>THE DETAILS</strong><button onClick={() => navigate("/help")}>Shipping & returns</button><button onClick={() => navigate("/help")}>Contact</button><button onClick={() => navigate("/about")}>Our story</button></div><div><strong>YOUR SPACE</strong><button onClick={() => navigate("/wishlist")}>Saved pieces</button><button onClick={() => navigate("/bag")}>Shopping bag</button></div></div></div><div className="footer-bottom"><span>© 2026 THRILOKHA SHILPA</span><span>CRAFT · CULTURE · CONSIDERATION <i>✳</i></span><button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>BACK TO TOP ↑</button></div></footer>
    <nav className="mobile-dock" aria-label="Quick navigation"><button onClick={() => navigate("/")}><Leaf size={19} /><span>Home</span></button><button onClick={() => shop("All")}><Search size={19} /><span>Shop</span></button><button onClick={() => navigate("/wishlist")}><Heart size={19} /><span>Saved</span></button><button onClick={() => navigate("/bag")}><ShoppingBag size={19} /><span>Bag{cartCount ? ` · ${cartCount}` : ""}</span></button></nav>
    {menuOpen && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setMenuOpen(false); }}><aside className="drawer menu-drawer"><div className="drawer-head"><BrandMark /><button className="icon-button" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X /></button></div><nav className="drawer-nav"><button onClick={() => shop("All")}>Shop everything <ArrowUpRight size={18} /></button>{categories.map((item) => <button key={item.name} onClick={() => shop(item.name)}>{item.name}<ArrowUpRight size={18} /></button>)}<button onClick={() => navigate("/collections")}>Collections <ArrowUpRight size={18} /></button><button onClick={() => navigate("/journal")}>The Edit <ArrowUpRight size={18} /></button><button onClick={() => navigate("/about")}>Our Story <ArrowUpRight size={18} /></button><button onClick={() => navigate("/profile")}>My account <UserRound size={18}/></button></nav></aside></div>}
    {toast && <div className="toast" role="status"><Check size={16} />{toast}<button onClick={() => setToast("")} aria-label="Dismiss notification"><X size={14} /></button></div>}
  </div>;
}
export default App;
