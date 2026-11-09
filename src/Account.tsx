import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch, requestEmailLink, signOut as supabaseSignOut } from "./supabase";
import { ArrowRight, ArrowUpRight, Check, LogOut, Pencil, ShieldCheck, TicketPercent, UserRound } from "lucide-react";

type User = { id: string; email: string; display_name: string; role: "customer" | "admin" | "super_admin" };
type Product = { id:string; name:string; description:string; category:string; price:number; compare_at_price:number|null; image_url:string; stock:number; active:number };
type AdminAccount = {email:string;role:"admin"|"super_admin";created_at:string;added_by_email:string|null};
type Coupon = { id:string; code:string; discount_type:"percent"|"fixed"; discount_value:number; min_order_value:number; max_uses:number|null; used_count:number; expires_at:string|null; active:number };
type Stats = { products:number; customers:number; orders:number; revenue:number; paymentsEnabled:boolean; activeCoupons:number; recentActivity:Array<{action:string;entity_type:string;created_at:string}> };
type Props = { mode: string };
const blankProduct = () => ({name:"",description:"",category:"General",price:"",compareAtPrice:"",imageUrl:"",stock:"0",active:true});
const blankCoupon = () => ({code:"",discountType:"percent",discountValue:"10",minimumOrder:"0",maxUses:"",expiresAt:""});

async function request<T>(url:string, init?:RequestInit):Promise<T>{
  const response=await apiFetch(url,{credentials:"same-origin",...init});
  const data=await response.json() as T & {error?:string};
  if(!response.ok) throw new Error(data.error??"Something went wrong. Please try again.");
  return data;
}

export default function AccountPage({ mode }: Props) {
  const [user,setUser]=useState<User|null>(null);
  const [email,setEmail]=useState("");
  const [displayName,setDisplayName]=useState("");
  const [step,setStep]=useState<"email"|"sent">("email");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [stats,setStats]=useState<Stats|null>(null);
  const [products,setProducts]=useState<Product[]>([]);
  const [coupons,setCoupons]=useState<Coupon[]>([]);\n  const [admins,setAdmins]=useState<AdminAccount[]>([]);\n  const [newAdminEmail,setNewAdminEmail]=useState("");
  const [product,setProduct]=useState(blankProduct);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [coupon,setCoupon]=useState(blankCoupon);
  const [notice,setNotice]=useState("");
  const [uploading,setUploading]=useState(false);

  const loadAdmin=useCallback(async()=>{
    const [s,p,c]=await Promise.all([
      request<Stats>("/api/admin/stats"),
      request<{products:Product[]}>("/api/admin/products"),
      request<{coupons:Coupon[]}>("/api/admin/coupons")
    ]);
    setStats(s);setProducts(p.products??[]);setCoupons(c.coupons??[]);
    if(user?.role==="super_admin"){const adminData=await request<{admins:AdminAccount[]}>("/api/admin/admins");setAdmins(adminData.admins??[]);}
  },[]);
  useEffect(()=>{request<{user:User|null}>("/api/auth/me").then(d=>{setUser(d.user);setDisplayName(d.user?.display_name??"");}).catch(()=>setUser(null));},[]);
  useEffect(()=>{
    if(mode!=="admin"||user?.role!=="admin")return;
    let alive=true;
    const refresh=()=>loadAdmin().catch(e=>{if(alive)setNotice(e instanceof Error?e.message:"Could not refresh store data.");});
    refresh();
    const timer=window.setInterval(refresh,30000);
    return()=>{alive=false;window.clearInterval(timer);};
  },[mode,user?.role,loadAdmin]);

  async function requestCode(e:FormEvent){
    e.preventDefault();setBusy(true);setError("");
    try{const {error}=await requestEmailLink(email);if(error)throw error;setStep("sent");}
    catch(x){setError(x instanceof Error?x.message:"Could not send sign-in code.");}
    finally{setBusy(false);}
  }
  async function signOut(){
    await supabaseSignOut();
    window.location.assign("/");
  }
  async function saveProfile(e:FormEvent){
    e.preventDefault();setBusy(true);setNotice("");
    try{const d=await request<{user:User}>("/api/profile",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({displayName})});setUser(d.user);setNotice("Your profile has been updated.");}
    catch(x){setNotice(x instanceof Error?x.message:"Could not update your profile.");}
    finally{setBusy(false);}
  }
  async function uploadImage(file?:File){
    if(!file)return;
    setUploading(true);setNotice("");
    try{
      const form=new FormData();form.append("file",file);
      const result=await request<{url:string}>("/api/admin/media",{method:"POST",body:form});
      setProduct(p=>({...p,imageUrl:result.url}));setNotice("Image uploaded securely to Cloudflare storage.");
    }catch(x){setNotice(x instanceof Error?x.message:"Image upload failed.");}
    finally{setUploading(false);}
  }
  async function saveProduct(e:FormEvent){
    e.preventDefault();setNotice("");
    const payload={...product,price:Number(product.price),compareAtPrice:product.compareAtPrice?Number(product.compareAtPrice):null,stock:Number(product.stock)};
    try{
      await request(editingId?"/api/admin/products/"+encodeURIComponent(editingId):"/api/admin/products",{method:editingId?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      setNotice(editingId?"Product changes saved.":"Product published to the storefront.");
      setProduct(blankProduct());setEditingId(null);await loadAdmin();
    }catch(x){setNotice(x instanceof Error?x.message:"Could not save product.");}
  }
  async function toggleCoupon(item:Coupon){
    try{await request("/api/admin/coupons/"+encodeURIComponent(item.id),{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({...item,active:!item.active,discountType:item.discount_type,discountValue:item.discount_value,minimumOrder:item.min_order_value,maxUses:item.max_uses,expiresAt:item.expires_at})});setNotice(item.active?"Coupon paused.":"Coupon activated.");await loadAdmin();}
    catch(x){setNotice(x instanceof Error?x.message:"Could not update coupon.");}
  }
  async function saveCoupon(e:FormEvent){
    e.preventDefault();setNotice("");
    try{
      await request("/api/admin/coupons",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...coupon,discountValue:Number(coupon.discountValue),minimumOrder:Number(coupon.minimumOrder),maxUses:coupon.maxUses?Number(coupon.maxUses):null})});
      setNotice("Coupon published and ready to use.");setCoupon(blankCoupon());await loadAdmin();
    }catch(x){setNotice(x instanceof Error?x.message:"Could not publish coupon.");}
  }
  function editProduct(item:Product){
    setEditingId(item.id);setProduct({name:item.name,description:item.description,category:item.category,price:String(item.price),compareAtPrice:item.compare_at_price===null?"":String(item.compare_at_price),imageUrl:item.image_url,stock:String(item.stock),active:Boolean(item.active)});
    document.querySelector(".admin-form")?.scrollIntoView({behavior:"smooth",block:"start"});
  }

  return <section className="account-page section-pad route-section">
    <p className="eyebrow">THRILOKHA SHILPA · {mode==="admin"?"PRIVATE STORE STUDIO":"YOUR ACCOUNT"}</p>
    <h1 className="route-title">{mode==="admin"?<>Store <em>studio.</em></>:<>A little space <em>of your own.</em></>}</h1>
    {mode==="login"&&<div className="account-panel">
      <h2>{step==="email"?"Sign in or create an account":"Check your inbox"}</h2>
      <p>{step==="email"?"Enter your email and we’ll send you a secure sign-in link. No password to remember.":"A secure sign-in link has been sent to "+email+". Open it on this device to continue."}</p>
      {step==="email"?<form onSubmit={requestCode}>
        <label>Your name (optional)<input value={displayName} onChange={e=>setDisplayName(e.target.value)} maxLength={80} placeholder="How should we greet you?"/></label>
        <label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
        <button className="checkout-button" disabled={busy}>{busy?"Sending…":"Send sign-in code"} <ArrowRight size={16}/></button>
      </form>:<div className="email-link-sent">
        <div className="profile-avatar"><Check/></div>
        <p>We’ve sent a sign-in link to <strong>{email}</strong>. Open the email and follow the link to finish signing in.</p>
        <button type="button" className="back-link" onClick={()=>setStep("email")}>Use a different email</button>
      </div>}
      {error&&<p className="verification-error" role="alert">{error}</p>}
    </div>}
    {mode==="profile"&&(user?<div className="account-panel profile-panel">
      <div className="profile-avatar"><UserRound/></div><h2>{user.display_name||"Welcome back"}</h2><p>{user.email}</p>
      <span className="account-role">{user.role==="super_admin"?"Super administrator":user.role==="admin"?"Administrator":"Customer account"}</span>
      <form className="profile-edit-form" onSubmit={saveProfile}><label>Your display name<input value={displayName||user.display_name} onChange={e=>setDisplayName(e.target.value)} maxLength={80} placeholder="Your name"/></label><button className="checkout-button" disabled={busy}>Save profile <Check size={16}/></button></form>
      <div className="account-links"><a href="/bag">Shopping bag <ArrowRight size={16}/></a><a href="/wishlist">Saved pieces <ArrowRight size={16}/></a>{(user.role==="admin"||user.role==="super_admin")&&<a href="/admin">Store administration <ArrowUpRight size={16}/></a>}</div>
      <button className="back-link" onClick={signOut}><LogOut size={15}/> Sign out</button>
      {notice&&<p className="admin-notice" role="status">{notice}</p>}
    </div>:<div className="account-panel"><h2>Welcome to your account</h2><p>Sign in to keep your bag and saved pieces with you across devices.</p><a className="checkout-button" href="/login">Sign in or create account <ArrowRight size={16}/></a></div>)}
    {mode==="admin"&&((user?.role==="admin"||user?.role==="super_admin")?<>
      <div className="admin-stats">{[
        ["Live products",stats?.products??"…"],["Customer accounts",stats?.customers??"…"],["Orders",stats?.paymentsEnabled?stats.orders:"Not live"],["Active coupons",stats?.activeCoupons??"…"]
      ].map(([label,value])=><article key={String(label)}><small>{String(label)}</small><strong>{String(value)}</strong></article>)}</div>
      <div className="admin-live-note"><span className="live-dot"/> Statistics refresh every 30 seconds. Orders and revenue remain disabled until payment integration is enabled.</div>
      <div className="admin-forms">
        <form className="admin-form" onSubmit={saveProduct}>
          <p className="eyebrow">CATALOGUE MANAGEMENT</p><h2>{editingId?"Edit product":"Add a product"}</h2>
          <label>Product name<input required value={product.name} onChange={e=>setProduct({...product,name:e.target.value})}/></label>
          <label>Description<textarea value={product.description} onChange={e=>setProduct({...product,description:e.target.value})}/></label>
          <div className="form-two"><label>Category<select value={product.category} onChange={e=>setProduct({...product,category:e.target.value})}><option>Home</option><option>Wear</option><option>Jewellery</option><option>Art</option></select></label><label>Price (₹)<input type="number" min="0" required value={product.price} onChange={e=>setProduct({...product,price:e.target.value})}/></label></div>
          <div className="form-two"><label>Offer / compare-at price<input type="number" min="0" value={product.compareAtPrice} onChange={e=>setProduct({...product,compareAtPrice:e.target.value})}/></label><label>Stock<input type="number" min="0" value={product.stock} onChange={e=>setProduct({...product,stock:e.target.value})}/></label></div>
          <label>Product image<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={e=>void uploadImage(e.target.files?.[0])}/></label>
          {uploading&&<p className="upload-state">Uploading image…</p>}
          {product.imageUrl&&<div className="upload-preview"><img src={product.imageUrl} alt="Product preview"/><span>Image uploaded</span></div>}
          <label className="admin-checkbox"><input type="checkbox" checked={product.active} onChange={e=>setProduct({...product,active:e.target.checked})}/> Visible in storefront</label>
          <button className="checkout-button" disabled={uploading}>{editingId?"Save changes":"Publish product"} <ArrowUpRight size={16}/></button>
          {editingId&&<button type="button" className="back-link" onClick={()=>{setEditingId(null);setProduct(blankProduct());}}>Cancel editing</button>}
        </form>
        <form className="admin-form" onSubmit={saveCoupon}>
          <p className="eyebrow">PROMOTIONS</p><h2>Create an offer</h2>
          <label>Coupon code<input required value={coupon.code} onChange={e=>setCoupon({...coupon,code:e.target.value.toUpperCase()})} placeholder="WELCOME10"/></label>
          <div className="form-two"><label>Discount type<select value={coupon.discountType} onChange={e=>setCoupon({...coupon,discountType:e.target.value as "percent"|"fixed"})}><option value="percent">Percentage</option><option value="fixed">Fixed ₹</option></select></label><label>Discount value<input type="number" min="1" required value={coupon.discountValue} onChange={e=>setCoupon({...coupon,discountValue:e.target.value})}/></label></div>
          <label>Minimum order (₹)<input type="number" min="0" value={coupon.minimumOrder} onChange={e=>setCoupon({...coupon,minimumOrder:e.target.value})}/></label>
          <label>Maximum uses<input type="number" min="1" value={coupon.maxUses} onChange={e=>setCoupon({...coupon,maxUses:e.target.value})}/></label>
          <label>Expiry date<input type="date" value={coupon.expiresAt} onChange={e=>setCoupon({...coupon,expiresAt:e.target.value})}/></label>
          <button className="checkout-button">Publish coupon <ArrowUpRight size={16}/></button>
        </form>
      </div>
      {user?.role==="super_admin"&&<section className="admin-list-section admin-access-section"><div className="admin-list-heading"><div><p className="eyebrow">ACCESS CONTROL</p><h2>Administrators <em>({admins.length})</em></h2></div></div>
        <p className="admin-access-copy">You are the super administrator. Add trusted people by email. They receive administrator access after signing in with that exact address. Only you can add or remove administrators.</p>
        <form className="admin-add-form" onSubmit={async e=>{e.preventDefault();try{await request("/api/admin/admins",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:newAdminEmail})});setNewAdminEmail("");setNotice("Administrator access granted to "+newAdminEmail+".");await loadAdmin();}catch(x){setNotice(x instanceof Error?x.message:"Could not add administrator.");}}}>
          <label>Administrator email<input type="email" required value={newAdminEmail} onChange={e=>setNewAdminEmail(e.target.value)} placeholder="colleague@example.com"/></label>
          <button className="checkout-button">Add administrator <ArrowUpRight size={16}/></button>
        </form>
        <div className="admin-people-list">{admins.map(item=><article key={item.email}><div><strong>{item.email}</strong><small>{item.role==="super_admin"?"Super administrator":"Administrator"} · Added {new Date(item.created_at).toLocaleDateString("en-IN")}</small></div>{item.role==="admin"&&<button type="button" className="coupon-toggle" onClick={async()=>{if(!window.confirm("Remove administrator access for "+item.email+"?"))return;try{await request("/api/admin/admins/"+encodeURIComponent(item.email),{method:"DELETE"});setNotice("Administrator access removed.");await loadAdmin();}catch(x){setNotice(x instanceof Error?x.message:"Could not remove administrator.");}}}>Remove access</button>}</article>)}</div>
      </section>}
      <section className="admin-list-section"><div className="admin-list-heading"><div><p className="eyebrow">LIVE CATALOGUE</p><h2>Products <em>({products.length})</em></h2></div><button className="text-link" onClick={()=>void loadAdmin()}>Refresh <ArrowRight size={15}/></button></div>
        {products.length===0?<p className="admin-empty">Your catalogue is empty. Add the first real product above.</p>:<div className="admin-product-list">{products.map(item=><article key={item.id}><img src={item.image_url||"/favicon.svg"} alt=""/><div><strong>{item.name}</strong><small>{item.category} · ₹{item.price.toLocaleString("en-IN")} · Stock {item.stock} · {item.active?"Published":"Hidden"}</small></div><button className="icon-button" onClick={()=>editProduct(item)} aria-label={"Edit "+item.name}><Pencil size={16}/></button></article>)}</div>}
      </section>
      <section className="admin-list-section"><div className="admin-list-heading"><div><p className="eyebrow">PROMOTIONS</p><h2>Offers <em>({coupons.length})</em></h2></div></div>
        {coupons.length===0?<p className="admin-empty">No coupons have been created yet.</p>:<div className="coupon-list">{coupons.map(item=><article key={item.id}><TicketPercent size={19}/><div><strong>{item.code}</strong><small>{item.discount_type==="percent"?item.discount_value+"% off":"₹"+item.discount_value+" off"} · Used {item.used_count}{item.max_uses?"/"+item.max_uses:""} times</small></div><button type="button" className="coupon-toggle" onClick={()=>void toggleCoupon(item)}>{item.active?"Pause":"Activate"}</button></article>)}</div>}
      </section>
      {stats?.recentActivity?.length? <section className="admin-list-section"><p className="eyebrow">STORE AUDIT TRAIL</p><h2>Recent activity</h2><div className="activity-list">{stats.recentActivity.map((item,i)=><p key={i}><span>{item.action} {item.entity_type}</span><time>{new Date(item.created_at).toLocaleString("en-IN")}</time></p>)}</div></section>:null}
      {notice&&<p role="status" className="admin-notice">{notice}</p>}
    </>:<div className="account-panel"><ShieldCheck size={28}/><h2>Restricted area</h2><p>Only accounts with an administrator role granted by the store owner can access store management. Creating a customer account never grants admin access.</p><a className="checkout-button" href={user?"/profile":"/login"}>{user?"Return to profile":"Sign in"} <ArrowRight size={16}/></a></div>)}
  </section>;
}

