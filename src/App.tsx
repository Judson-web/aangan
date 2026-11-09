import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Check, Heart, Leaf, UserRound,
  Menu, Minus, Plus, Search, ShieldCheck, ShoppingBag, X,
} from "lucide-react";
import { categories, formatPrice, type Category, type Product } from "./catalog";
import AccountPage from "./Account";
import { apiFetch } from "./supabase";

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
    <img className="brand-monogram" src="/icon.svg" alt="" />
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
            const response = await apiFetch("/api/verify-human", {
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
    <p>Help us keep this storefront welcoming for real people. Complete Cloudflare's secure check to continue.</p>
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
      <button className="quick-add" onClick={() => onAdd(product)}><Plus size={15} /> Add to Cart</button>
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
  const [cloudUser, setCloudUser] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
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
  useEffect(() => { apiFetch("/api/products").then(r=>r.json()).then((d:{products?:Array<{id:string;name:string;description:string;category:string;price:number;compare_at_price:number|null;image_url:string}>})=>setCatalogue((d.products??[]).map(p=>({id:p.id,name:p.name,maker:"THRILOKHA SHILPA",category:(["Home","Wear","Jewellery","Art"].includes(p.category)?p.category:"Art") as Exclude<Category,"All">,price:p.price,oldPrice:p.compare_at_price??undefined,image:p.image_url,badge:undefined,description:p.description,material:"See product details",origin:"India"})))).catch(()=>setCatalogue([])); }, []);
  useEffect(() => {
    let alive = true;
    apiFetch("/api/human-status", { credentials: "same-origin" })
      .then((response) => response.json() as Promise<{ verified?: boolean }>)
      .then((result) => { if (alive) setVerified(Boolean(result.verified)); })
      .catch(() => { if (alive) setVerified(false); })
      .finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, []);
  useEffect(() => { saveStored(CART_KEY, cart); }, [cart]);
  useEffect(() => { saveStored(WISHLIST_KEY, wishlist); }, [wishlist]);
  useEffect(() => {
    let alive = true;
    const hydrate = async () => {
      try {
        const me = await apiFetch("/api/auth/me", { credentials: "same-origin" }).then(r => r.json()) as { user?: unknown };
        if (!alive) return;
        if (me.user) {
          const [remoteCart, remoteWishlist] = await Promise.all([
            apiFetch("/api/cart", { credentials: "same-origin" }).then(r => r.json()) as Promise<{items?:CartLine[]}>,
            apiFetch("/api/wishlist", { credentials: "same-origin" }).then(r => r.json()) as Promise<{items?:Array<{productId:string}>}>,
          ]);
          if (!alive) return;
          const localCart = readStored<CartLine[]>(CART_KEY, []);
          const merged = new Map<string, number>();
          for (const line of [...(remoteCart.items ?? []), ...localCart]) merged.set(line.productId, Math.max(merged.get(line.productId) ?? 0, line.quantity));
          setCart([...merged].map(([productId, quantity]) => ({ productId, quantity })));
          setWishlist([...new Set([...(remoteWishlist.items ?? []).map(x => x.productId), ...readStored<string[]>(WISHLIST_KEY, [])])]);
          setCloudUser(true);
        } else setCloudUser(false);
      } catch { if (alive) setCloudUser(false); }
      finally { if (alive) setCloudReady(true); }
    };
    void hydrate();
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!cloudUser || !cloudReady) return;
    void apiFetch("/api/cart", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: cart }) });
  }, [cart, cloudUser, cloudReady]);
  useEffect(() => {
    if (!cloudUser || !cloudReady) return;
    void apiFetch("/api/wishlist", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: wishlist }) });
  }, [wishlist, cloudUser, cloudReady]);
  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [menuOpen]);
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
    <div className="announcement"><span>THE THRILOKHA SHILPA EDIT · BEAUTY IN EVERY DETAIL</span><span>A MORE CONSIDERED WAY TO SHOP</span></div>
    <header className="site-header">
      <button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu /></button>
      <nav className="desktop-nav" aria-label="Main navigation">
        <button onClick={() => shop("All")}>Shop</button><button onClick={() => navigate("/about")}>Our Story</button>
      </nav>
      <BrandMark />
      <div className="header-actions">
        <button className="icon-button search-trigger" aria-label="Search products" onClick={() => setSearchOpen((open) => !open)}><Search /></button>
        <button className="icon-button wishlist-trigger" aria-label={`Wishlist, ${wishlist.length} saved`} onClick={() => navigate("/wishlist")}><Heart /></button>
        <button className="icon-button account-trigger" aria-label="Your account" onClick={() => navigate("/profile")}><UserRound /></button>
        <button className="bag-trigger" onClick={() => navigate("/bag")} aria-label={`Shopping bag, ${cartCount} items`}><ShoppingBag size={19} /><span>Bag</span><b>{cartCount}</b></button>
      </div>
    </header>
    <div className="category-ribbon"><button onClick={() => shop("All")}>ALL OBJECTS</button>{categories.map((item) => <button key={item.name} onClick={() => shop(item.name)}>{item.name.toUpperCase()}</button>)}<span>ART · CULTURE · EXPRESSION</span></div>
    {searchOpen && <form className="search-bar" onSubmit={(event) => { event.preventDefault(); navigate("/shop"); }}><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search objects, makers, materials…" aria-label="Search catalogue" /><button type="button" onClick={() => { setQuery(""); setSearchOpen(false); }} aria-label="Close search"><X size={18} /></button><button className="search-submit" type="submit">SEARCH</button></form>}

    <main key={pathname}>
      {pathname === "/about" && <section className="art-story section-pad route-section"><div className="breadcrumb"><button onClick={() => navigate("/")}>Home</button><span>/</span><span>The artwork</span></div><p className="eyebrow">THRILOKHA SHILPA</p><h1 className="route-title">A visual language <em>rooted in India.</em></h1><div className="art-story-grid"><figure><img src="/thrilokha-artwork.svg" alt="Original Thrilokha Shilpa devotional line artwork" /><figcaption>THE ORIGINAL ARTWORK</figcaption></figure><div><h2>Tradition, drawn <em>forward.</em></h2><p>This original illustration is the visual foundation of Thrilokha Shilpa. Its ornamental lines, devotional references and restrained palette shape the identity across the storefront.</p></div></div></section>}
      {pathname === "/" && <>
        <section className="hero art-led-hero">
          <div className="hero-copy"><p className="eyebrow"><span className="eyebrow-line" /> THRILOKHA SHILPA</p><h1>Art for the<br /><em>everyday.</em></h1><p className="hero-description">An Indian design identity shaped by art, line, colour and cultural memory.</p><button className="primary-link" onClick={() => navigate("/about")}>Discover the brand <ArrowUpRight size={16} /></button><div className="hero-footnote"><span>01 / 01</span><span className="footnote-rule" /><span>ROOTED IN INDIA</span></div></div>
          <div className="hero-art"><img src="/thrilokha-artwork.svg" alt="Original Thrilokha Shilpa devotional line artwork" /><div className="hero-stamp"><span>ART</span><strong>with</strong><span>INTENTION</span><i>✳</i></div><div className="hero-caption">A visual language of its own <span>✳</span></div></div><span className="hero-side-note">FORM · CULTURE · EXPRESSION</span>
        </section>
        <section className="art-story section-pad"><div className="section-heading"><div><p className="eyebrow">THE VISUAL LANGUAGE</p><h2>Inspired by <em>tradition.</em></h2></div></div><div className="art-story-grid"><figure><img src="/thrilokha-artwork.svg" alt="Thrilokha Shilpa original ornamental line illustration" /><figcaption>01 / LINE & FORM</figcaption></figure><div><p className="eyebrow">A CONTEMPORARY INDIAN AESTHETIC</p><h2>Old symbols.<br /><em>New expressions.</em></h2><p>Ornamental detail, expressive forms and a palette drawn from the visual richness of India. The artwork is the starting point, not a catalogue of imaginary products.</p></div></div></section>
        <section className="artwork-feature"><div><p className="eyebrow">THRILOKHA SHILPA</p><h2>Made to be <em>felt.</em></h2><p>A design-led identity for a considered lifestyle brand.</p></div><img src="/icon.svg" alt="Thrilokha Shilpa emblem" /></section>
      </>}
      {(pathname === "/login" || pathname === "/profile" || pathname === "/admin") && <AccountPage mode={pathname.slice(1)} />}
      {isShop && <section className="collection-section section-pad route-section"><div className="breadcrumb"><button onClick={() => navigate("/")}>Home</button><span>/</span><span>Shop</span>{effectiveCategory !== "All" && <><span>/</span><span>{effectiveCategory}</span></>}</div><div className="section-heading collection-heading"><div><p className="eyebrow">THE COMPLETE COLLECTION</p><h1>{effectiveCategory === "All" ? <>Objects of <em>desire.</em></> : <>{effectiveCategory} <em>edit.</em></>}</h1><p className="collection-subtitle">Discover thoughtful pieces, selected for their craft, character and quiet beauty.</p></div></div>{collectionControls}{productGrid(visibleProducts)}</section>}
      {pathname === "/wishlist" && <section className="collection-section section-pad route-section"><div className="breadcrumb"><button onClick={() => navigate("/")}>Home</button><span>/</span><span>Saved pieces</span></div><p className="eyebrow">YOUR PERSONAL EDIT</p><h1 className="route-title">Kept close to <em>heart.</em></h1>{productGrid(visibleProducts)}</section>}
      {pathname === "/bag" && <section className="bag-page section-pad route-section"><div className="breadcrumb"><button onClick={() => navigate("/")}>Home</button><span>/</span><span>Your bag</span></div><p className="eyebrow">A FEW GOOD THINGS</p><h1 className="route-title">Your <em>bag.</em></h1>{cart.length ? <div className="bag-layout"><div className="bag-lines">{cart.map((line) => { const product = catalogue.find((item) => item.id === line.productId); if (!product) return null; return <article className="bag-line" key={line.productId}><img src={product.image} alt={product.name} /><div><small>{product.maker}</small><h3>{product.name}</h3><strong>{formatPrice(product.price)}</strong><div className="quantity-control"><button onClick={() => changeQuantity(product.id, -1)} aria-label="Decrease quantity"><Minus size={13} /></button><span>{line.quantity}</span><button onClick={() => changeQuantity(product.id, 1)} aria-label="Increase quantity"><Plus size={13} /></button></div></div><button className="remove-line" onClick={() => setCart((current) => current.filter((entry) => entry.productId !== product.id))} aria-label={`Remove ${product.name}`}><X size={16} /></button></article>; })}</div><aside className="bag-summary"><p>ORDER SUMMARY</p><div><span>Subtotal</span><strong>{formatPrice(cartTotal)}</strong></div><div><span>Shipping</span><span>{cartTotal >= 2500 ? "Complimentary" : "Calculated later"}</span></div><button className="checkout-button" onClick={() => setToast("Secure checkout will be connected before launch.")}>Continue to checkout <ArrowRight size={17} /></button><small>Checkout preview only. No payment will be taken.</small></aside></div> : <div className="empty-results"><ShoppingBag size={28} /><h3>Your bag is waiting for a story.</h3><p>Find a piece that feels like it belongs with you.</p><button className="primary-link" onClick={() => shop("All")}>Explore the collection <ArrowRight size={15} /></button></div>}</section>}
      {activeProduct && <section className="product-page section-pad route-section"><div className="breadcrumb"><button onClick={() => navigate("/")}>Home</button><span>/</span><button onClick={() => shop(activeProduct.category)}>{activeProduct.category}</button><span>/</span><span>{activeProduct.name}</span></div><div className="product-detail"><div className="product-detail-image"><img src={activeProduct.image} alt={activeProduct.name} /></div><div className="product-detail-copy"><p className="eyebrow">{activeProduct.category} · {activeProduct.maker}</p><h1>{activeProduct.name}</h1><strong className="detail-price">{formatPrice(activeProduct.price)}</strong><p>{activeProduct.description}</p><dl><div><dt>Material</dt><dd>{activeProduct.material}</dd></div><div><dt>Made in</dt><dd>{activeProduct.origin}</dd></div></dl><button className="checkout-button" onClick={() => addToCart(activeProduct)}>Add to bag <Plus size={17} /></button><button className="modal-wish" onClick={() => toggleWish(activeProduct.id)}><Heart size={16} fill={wishlist.includes(activeProduct.id) ? "currentColor" : "none"} /> {wishlist.includes(activeProduct.id) ? "Saved to your wishlist" : "Save for later"}</button><button className="back-link" onClick={() => shop(activeProduct.category)}><ArrowLeft size={15} /> Back to {activeProduct.category}</button></div></div></section>}
    </main>
    {!["/","/shop","/wishlist","/bag","/about","/login","/profile","/admin"].includes(pathname) && !pathname.startsWith("/shop/") && !pathname.startsWith("/product/") && <section className="not-found-page section-pad route-section"><p className="eyebrow">A LITTLE DETOUR</p><h1 className="route-title">This page wandered <em>off.</em></h1><p>The page may have moved, or the link may be out of date.</p><button className="primary-link" onClick={() => navigate("/")}>Return home <ArrowRight size={16}/></button></section>}
    <footer className="site-footer"><div className="footer-top"><div><BrandMark /><p className="footer-manifesto">An Indian design identity shaped by art, line and cultural memory.</p></div><div className="footer-links"><div><strong>DISCOVER</strong><button onClick={() => shop("All")}>Shop all</button></div><div><strong>THE DETAILS</strong><button onClick={() => navigate("/about")}>The artwork</button></div><div><strong>YOUR SPACE</strong><button onClick={() => navigate("/wishlist")}>Saved pieces</button><button onClick={() => navigate("/bag")}>Shopping bag</button></div></div></div><div className="footer-bottom"><span>© 2026 THRILOKHA SHILPA</span><span>CRAFT · CULTURE · CONSIDERATION <i>✳</i></span><button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>BACK TO TOP ↑</button></div></footer>
    <nav className="mobile-dock" aria-label="Quick navigation"><button onClick={() => navigate("/")}><Leaf size={19} /><span>Home</span></button><button onClick={() => shop("All")}><Search size={19} /><span>Shop</span></button><button onClick={() => navigate("/wishlist")}><Heart size={19} /><span>Saved</span></button><button onClick={() => navigate("/bag")}><ShoppingBag size={19} /><span>Bag{cartCount ? ` · ${cartCount}` : ""}</span></button></nav>
    {menuOpen && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setMenuOpen(false); }}><aside className="drawer menu-drawer" role="dialog" aria-modal="true" aria-label="Store navigation"><div className="drawer-head"><BrandMark /><button className="icon-button" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X /></button></div><nav className="drawer-nav"><button onClick={() => shop("All")}>Shop everything <ArrowUpRight size={18} /></button>{categories.map((item) => <button key={item.name} onClick={() => shop(item.name)}>{item.name}<ArrowUpRight size={18} /></button>)}<button onClick={() => navigate("/about")}>Our Story <ArrowUpRight size={18} /></button><button onClick={() => navigate("/profile")}>My account <UserRound size={18}/></button></nav><div className="drawer-note"><strong>Art for the everyday.</strong><p>Explore a considered world of design, colour and beautiful details.</p><div className="drawer-quick-links"><a href="/profile">Your account</a><a href="/bag">Shopping bag</a></div></div></aside></div>}
    {toast && <div className="toast" role="status"><Check size={16} />{toast}<button onClick={() => setToast("")} aria-label="Dismiss notification"><X size={14} /></button></div>}
  </div>;
}
export default App;
