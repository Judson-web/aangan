import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch, supabase, signInWithPassword, signUpWithPassword, requestEmailLink, requestPasswordReset, updatePassword, signOut as supabaseSignOut } from "./supabase";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Eye, EyeOff, KeyRound, LogOut, Mail, Pencil, ShieldCheck, TicketPercent, UserRound } from "lucide-react";

type User = { id: string; email: string; display_name: string; avatar_url?: string; role: "customer" | "admin" | "super_admin" };
type Product = { id:string; name:string; description:string; category:string; price:number; compare_at_price:number|null; image_url:string; stock:number; active:number };
type AdminAccount = {email:string;role:"admin"|"super_admin";created_at:string;added_by_email:string|null};
type Coupon = { id:string; code:string; discount_type:"percent"|"fixed"; discount_value:number; min_order_value:number; max_uses:number|null; used_count:number; expires_at:string|null; active:number };
type Stats = { products:number; customers:number; orders:number; revenue:number; paymentsEnabled:boolean; activeCoupons:number; recentActivity:Array<{action:string;entity_type:string;created_at:string}> };
type StoreSection = {id:string;title:string;subtitle:string;kind:"featured"|"category"|"manual";category:string;product_ids:string[];position:number;visible:number};
type Props = { mode: string };
const blankProduct = () => ({name:"",description:"",category:"Home",price:"",compareAtPrice:"",imageUrl:"",stock:"0",active:true});
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
  const [authTab,setAuthTab]=useState<"signin"|"signup">("signin");
  const [authMethod,setAuthMethod]=useState<"password"|"link">("password");
  const [step,setStep]=useState<"form"|"sent"|"reset-sent">("form");
  const [sentMessage,setSentMessage]=useState("");
  const [password,setPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [confirmNewPassword,setConfirmNewPassword]=useState("");
  const [showPassword,setShowPassword]=useState(false);
  const [showNewPassword,setShowNewPassword]=useState(false);
  const [recovery,setRecovery]=useState(false);
  const [authLoading,setAuthLoading]=useState(true);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [stats,setStats]=useState<Stats|null>(null);
  const [products,setProducts]=useState<Product[]>([]);
  const [coupons,setCoupons]=useState<Coupon[]>([]);
  const [admins,setAdmins]=useState<AdminAccount[]>([]);
  const [newAdminEmail,setNewAdminEmail]=useState("");
  const [product,setProduct]=useState(blankProduct);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [coupon,setCoupon]=useState(blankCoupon);
  const [notice,setNotice]=useState("");
  const [uploading,setUploading]=useState(false);
  const [sections,setSections]=useState<StoreSection[]>([]);
  const [section,setSection]=useState({title:"",subtitle:"",kind:"featured" as StoreSection["kind"],category:"",product_ids:[] as string[],position:"0",visible:true});
  const [editingSection,setEditingSection]=useState<string|null>(null);

  const loadAdmin=useCallback(async()=>{
    const [s,p,c,sectionData]=await Promise.all([
      request<Stats>("/api/admin/stats"),
      request<{products:Product[]}>("/api/admin/products"),
      request<{coupons:Coupon[]}>("/api/admin/coupons"),
      request<{sections:StoreSection[]}>("/api/admin/sections")
    ]);
    setStats(s);setProducts(p.products??[]);setCoupons(c.coupons??[]);setSections(sectionData.sections??[]);
    if(user?.role==="super_admin"){const adminData=await request<{admins:AdminAccount[]}>("/api/admin/admins");setAdmins(adminData.admins??[]);}
  },[user?.role]);
  useEffect(()=>{
    let alive=true;
    const refreshUser=async()=>{
      try{
        const d=await request<{user:User|null}>("/api/auth/me");
        if(alive){setUser(d.user);setDisplayName(d.user?.display_name??"");}
      }catch{if(alive)setUser(null);}
      finally{if(alive)setAuthLoading(false);}
    };
    void refreshUser();
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{
      if(event==="PASSWORD_RECOVERY"&&alive)setRecovery(true);
      // Supabase holds its auth lock while notifying listeners. Defer API work until
      // the callback returns so apiFetch can safely read the updated session.
      window.setTimeout(()=>{if(alive)void refreshUser();},0);
    });
    return()=>{alive=false;subscription.unsubscribe();};
  },[]);
  useEffect(()=>{
    if(mode!=="admin"||!(["admin","super_admin"] as const).includes(user?.role as "admin"|"super_admin"))return;
    let alive=true;
    const refresh=()=>loadAdmin().catch(e=>{if(alive)setNotice(e instanceof Error?e.message:"Could not refresh store data.");});
    refresh();
    const timer=window.setInterval(refresh,30000);
    return()=>{alive=false;window.clearInterval(timer);};
  },[mode,user?.role,loadAdmin]);

  async function requestCode(e:FormEvent){
    e.preventDefault();setBusy(true);setError("");
    try{
      if(!email.trim())throw new Error("Enter your email address to continue.");
      if(authTab==="signup"){
        if(displayName.trim().length<2)throw new Error("Please enter your name.");
        if(password.length<8)throw new Error("Use a password with at least 8 characters.");
        if(password!==confirmPassword)throw new Error("Your passwords do not match.");
        const {data,error}=await signUpWithPassword(email,password,displayName);
        if(error)throw error;
        if(data.session){window.location.assign("/profile");return;}
        setSentMessage("Your account is nearly ready. Confirm your email using the message we just sent, then return here to sign in.");
        setStep("sent");
        return;
      }
      if(authMethod==="link"){
        const {error}=await requestEmailLink(email,"",false);
        if(error)throw error;
        setSentMessage("A secure sign-in link is on its way. Open it on this device to finish signing in.");
        setStep("sent");
        return;
      }
      const {error}=await signInWithPassword(email,password);
      if(error)throw error;
      window.location.assign("/profile");
    }catch(x){
      const message=x instanceof Error?x.message:"We couldn't complete that request. Please try again.";
      if(/invalid login credentials/i.test(message))setError("That email and password don't match. Check them or reset your password.");
      else if(/email not confirmed/i.test(message))setError("Your email still needs confirming. Open the confirmation message we sent, or request a new sign-in link.");
      else if(/already registered|user already exists/i.test(message))setError("An account with this email already exists. Switch to sign in instead.");
      else setError(message);
    }finally{setBusy(false);}
  }
  async function sendPasswordReset(){
    setError("");
    if(!email.trim()){setError("Enter your email address first, then choose forgot password.");return;}
    setBusy(true);
    try{
      const {error}=await requestPasswordReset(email);
      if(error)throw error;
      setSentMessage("We've sent a password reset link to your email address. Open it on this device to choose a new password.");
      setStep("reset-sent");
    }catch(x){setError(x instanceof Error?x.message:"We couldn't send the reset link. Please try again.");}
    finally{setBusy(false);}
  }
  async function saveNewPassword(e:FormEvent){
    e.preventDefault();setError("");setNotice("");
    if(newPassword.length<8){setError("Use a password with at least 8 characters.");return;}
    if(newPassword!==confirmNewPassword){setError("Your passwords do not match.");return;}
    setBusy(true);
    try{
      const {error}=await updatePassword(newPassword);
      if(error)throw error;
      setRecovery(false);setNewPassword("");setConfirmNewPassword("");
      window.history.replaceState({}, "", "/profile");
      setNotice("Your password has been updated.");
    }catch(x){setError(x instanceof Error?x.message:"We couldn't update your password. Please request a fresh reset link.");}
    finally{setBusy(false);}
  }
  async function signOut(){
    setBusy(true);setNotice("");
    const {error}=await supabaseSignOut();
    if(error){setBusy(false);setNotice("We couldn't sign you out. Please try again.");return;}
    window.location.assign("/");
  }
  async function saveProfile(e:FormEvent){
    e.preventDefault();setBusy(true);setNotice("");
    try{const d=await request<{user:User}>("/api/profile",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({displayName})});setUser(d.user);setNotice("Your profile has been updated.");}
    catch(x){setNotice(x instanceof Error?x.message:"Could not update your profile.");}
    finally{setBusy(false);}
  }
  async function uploadProfileImage(file?:File){
    if(!file)return;setUploading(true);setNotice("");
    try{const form=new FormData();form.append("file",file);const result=await request<{avatar_url:string}>("/api/profile/avatar",{method:"POST",body:form});setUser(u=>u?{...u,avatar_url:result.avatar_url}:u);setNotice("Profile photo updated.");}
    catch(x){setNotice(x instanceof Error?x.message:"Profile photo upload failed.");}finally{setUploading(false);}
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
  async function saveSection(e:FormEvent){e.preventDefault();setNotice("");try{await request("/api/admin/sections",{method:editingSection?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...section,id:editingSection,position:Number(section.position)})});setSection({title:"",subtitle:"",kind:"featured",category:"",product_ids:[],position:String(sections.length),visible:true});setEditingSection(null);setNotice("Homepage section saved.");await loadAdmin();}catch(x){setNotice(x instanceof Error?x.message:"Could not save section.");}}
  function editSection(item:StoreSection){setEditingSection(item.id);setSection({title:item.title,subtitle:item.subtitle,kind:item.kind,category:item.category,product_ids:item.product_ids??[],position:String(item.position),visible:Boolean(item.visible)});}
  function editProduct(item:Product){
    setEditingId(item.id);setProduct({name:item.name,description:item.description,category:item.category,price:String(item.price),compareAtPrice:item.compare_at_price===null?"":String(item.compare_at_price),imageUrl:item.image_url,stock:String(item.stock),active:Boolean(item.active)});
    document.querySelector(".admin-form")?.scrollIntoView({behavior:"smooth",block:"start"});
  }

  return <section className="account-page section-pad route-section">
    <p className="eyebrow">THRILOKHA SHILPA · {mode==="admin"?"PRIVATE STORE STUDIO":"YOUR ACCOUNT"}</p>
    <h1 className="route-title">{mode==="admin"?<>Store <em>studio.</em></>:<>A little space <em>of your own.</em></>}</h1>
    {mode==="login"&&<div className="auth-layout">
      <aside className="auth-editorial">
        <div className="auth-art-frame"><img src="/thrilokha-artwork.svg" alt="Thrilokha Shilpa ornamental artwork"/></div>
        <p className="eyebrow">THRILOKHA SHILPA · YOUR SPACE</p>
        <h2>Good things begin with <em>the little details.</em></h2>
        <p>Keep your favourite pieces close, follow your selections and make the store feel a little more like yours.</p>
        <div className="auth-editorial-note"><span/> A considered space for everyday living</div>
      </aside>
      <div className="account-panel auth-card">
        {authLoading?<div className="auth-loading">Checking your account…</div>:user?<div className="auth-logged-in">
          <div className="auth-success-mark"><Check/></div>
          <p className="eyebrow">YOU'RE SIGNED IN</p>
          <h2>Welcome back.</h2>
          <p>Your account is ready. Continue to your profile and saved pieces.</p>
          <a className="checkout-button" href="/profile">Continue to profile <ArrowRight size={16}/></a>
        </div>:<>
          <div className="auth-heading">
            <p className="eyebrow">A MORE PERSONAL EXPERIENCE</p>
            <h2>{step==="reset-sent"?"Check your email":step==="sent"?"You're nearly there":authTab==="signup"?"Create your account":"Welcome back"}</h2>
            <p>{step!=="form"?sentMessage:authTab==="signup"?"A few details and you'll have your own space at Thrilokha Shilpa.":"Sign in to keep your bag and saved pieces together."}</p>
          </div>
          {step==="form"?<>
            <div className="auth-tabs" role="tablist" aria-label="Account access">
              <button type="button" role="tab" aria-selected={authTab==="signin"} className={authTab==="signin"?"active":""} onClick={()=>{setAuthTab("signin");setAuthMethod("password");setError("");}}>Sign in</button>
              <button type="button" role="tab" aria-selected={authTab==="signup"} className={authTab==="signup"?"active":""} onClick={()=>{setAuthTab("signup");setAuthMethod("password");setError("");}}>Create account</button>
            </div>
            <form className="auth-form" onSubmit={requestCode}>
              {authTab==="signup"&&<label>Your name
                <input autoComplete="name" required minLength={2} maxLength={80} value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Your name"/>
              </label>}
              <label>Email address
                <input type="email" inputMode="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>
              </label>
              {authMethod==="password"&&<>
                <label>Password
                  <span className="auth-password-wrap"><input type={showPassword?"text":"password"} autoComplete={authTab==="signup"?"new-password":"current-password"} required minLength={authTab==="signup"?8:undefined} value={password} onChange={e=>setPassword(e.target.value)} placeholder={authTab==="signup"?"At least 8 characters":"Your password"}/><button type="button" onClick={()=>setShowPassword(x=>!x)} aria-label={showPassword?"Hide password":"Show password"}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></span>
                </label>
                {authTab==="signup"&&<label>Confirm password
                  <span className="auth-password-wrap"><input type={showPassword?"text":"password"} autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Enter your password again"/></span>
                </label>}
              </>}
              {authTab==="signin"&&authMethod==="password"&&<div className="auth-form-utility"><button type="button" className="auth-text-button" onClick={()=>void sendPasswordReset()} disabled={busy}>Forgot password?</button></div>}
              <button className="checkout-button auth-submit" disabled={busy}>{busy?"Please wait…":authTab==="signup"?"Create account":authMethod==="link"?"Email me a sign-in link":"Sign in"} <ArrowRight size={16}/></button>
            </form>
            {authTab==="signin"&&<div className="auth-alternative">
              <span>OR</span>
              <button type="button" onClick={()=>{setAuthMethod(x=>x==="password"?"link":"password");setPassword("");setError("");}}><Mail size={16}/>{authMethod==="password"?"Use a secure email link instead":"Use password instead"}</button>
            </div>}
            <p className="auth-legal">By continuing, you agree to our <a href="/terms">Terms</a> and acknowledge our <a href="/privacy">Privacy Policy</a>.</p>
          </>:<div className="auth-sent-state">
            <div className="auth-success-mark">{step==="reset-sent"?<KeyRound/>:<Mail/>}</div>
            <p className="auth-sent-address">{email}</p>
            <p>{sentMessage}</p>
            <button type="button" className="back-link" onClick={()=>{setStep("form");setError("");setPassword("");}}> <ArrowLeft size={15}/> Back to sign in</button>
          </div>}
          {error&&<p className="verification-error auth-error" role="alert">{error}</p>}
        </>}
      </div>
    </div>}
    {mode==="profile"&&recovery&&<div className="account-panel auth-recovery">
      <p className="eyebrow">ACCOUNT SECURITY</p>
      <h2>Choose a new password</h2>
      <p>Use a fresh password to secure your account. It should be at least 8 characters long.</p>
      <form className="auth-form" onSubmit={saveNewPassword}>
        <label>New password
          <span className="auth-password-wrap"><input type={showNewPassword?"text":"password"} autoComplete="new-password" minLength={8} required value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="At least 8 characters"/><button type="button" aria-label={showNewPassword?"Hide password":"Show password"} onClick={()=>setShowNewPassword(x=>!x)}>{showNewPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></span>
        </label>
        <label>Confirm new password
          <input type={showNewPassword?"text":"password"} autoComplete="new-password" minLength={8} required value={confirmNewPassword} onChange={e=>setConfirmNewPassword(e.target.value)} placeholder="Enter it again"/>
        </label>
        <button className="checkout-button" disabled={busy}>{busy?"Updating…":"Update password"} <Check size={16}/></button>
      </form>
      {error&&<p className="verification-error" role="alert">{error}</p>}
    </div>}
        {mode==="profile"&&!recovery&&(authLoading?<div className="account-panel auth-loading">Loading your account…</div>:user?<div className="account-panel profile-panel">
      <div className="profile-avatar">{user.avatar_url?<img src={user.avatar_url} alt="Profile"/>:<UserRound/>}</div><h2>{user.display_name||"Welcome back"}</h2><p>{user.email}</p>
      <span className="account-role">{user.role==="super_admin"?"Super administrator":user.role==="admin"?"Administrator":"Customer account"}</span>
      <form className="profile-edit-form" onSubmit={saveProfile}><label>Profile photograph<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={e=>void uploadProfileImage(e.target.files?.[0])}/></label><label>Your display name<input value={displayName} onChange={e=>setDisplayName(e.target.value)} maxLength={80} placeholder="Your name"/></label><button className="checkout-button" disabled={busy}>Save profile <Check size={16}/></button></form>
      <div className="account-links"><a href="/bag">Shopping bag <ArrowRight size={16}/></a><a href="/wishlist">Saved pieces <ArrowRight size={16}/></a>{(user.role==="admin"||user.role==="super_admin")&&<a href="/admin">Store administration <ArrowUpRight size={16}/></a>}</div>
      <button className="back-link" onClick={signOut}><LogOut size={15}/> Sign out</button>
      {notice&&<p className="admin-notice" role="status">{notice}</p>}
    </div>:<div className="account-panel"><h2>Welcome to your account</h2><p>Sign in to keep your bag and saved pieces with you across devices.</p><a className="checkout-button" href="/login">Sign in or create account <ArrowRight size={16}/></a></div>)}
    {mode==="admin"&&authLoading&&<div className="account-panel auth-loading">Verifying store access…</div>}
    {mode==="admin"&&!authLoading&&((user?.role==="admin"||user?.role==="super_admin")?<>
      <div className="admin-stats">{[
        ["Live products",stats?.products??"…"],["Customer accounts",stats?.customers??"…"],["Orders",stats?.paymentsEnabled?stats.orders:"Not live"],["Active coupons",stats?.activeCoupons??"…"]
      ].map(([label,value])=><article key={String(label)}><small>{String(label)}</small><strong>{String(value)}</strong></article>)}</div>
      <div className="admin-live-note"><span className="live-dot"/> Statistics refresh every 30 seconds. Orders and revenue remain disabled until payment integration is enabled.</div>
      <section className="admin-list-section"><div className="admin-list-heading"><div><p className="eyebrow">HOMEPAGE EDITOR</p><h2>Catalogue <em>sections ({sections.length})</em></h2></div></div><p className="admin-access-copy">Create, reorder, hide or edit the lists shown on the homepage. Sections draw only from products you have actually published.</p><form className="admin-form" onSubmit={saveSection}><h2>{editingSection?"Edit section":"Add homepage section"}</h2><label>Section title<input required maxLength={100} value={section.title} onChange={e=>setSection({...section,title:e.target.value})}/></label><label>Subtitle<input maxLength={240} value={section.subtitle} onChange={e=>setSection({...section,subtitle:e.target.value})}/></label><div className="form-two"><label>Section type<select value={section.kind} onChange={e=>setSection({...section,kind:e.target.value as StoreSection["kind"]})}><option value="featured">All published products</option><option value="category">Category list</option><option value="manual">Selected products</option></select></label><label>Category<input value={section.category} onChange={e=>setSection({...section,category:e.target.value})} placeholder="Home, Wear, Art…"/></label></div>{section.kind==="manual"&&<fieldset className="section-product-picker"><legend>Choose products for this list</legend>{products.map(item=><label key={item.id}><input type="checkbox" checked={section.product_ids.includes(item.id)} onChange={e=>setSection(s=>({...s,product_ids:e.target.checked?[...s.product_ids,item.id]:s.product_ids.filter(id=>id!==item.id)}))}/>{item.name}</label>)}</fieldset>}<div className="form-two"><label>Display order<input type="number" min="0" value={section.position} onChange={e=>setSection({...section,position:e.target.value})}/></label><label className="admin-checkbox"><input type="checkbox" checked={section.visible} onChange={e=>setSection({...section,visible:e.target.checked})}/> Visible on homepage</label></div><button className="checkout-button">{editingSection?"Save section":"Create section"} <ArrowUpRight size={16}/></button>{editingSection&&<button type="button" className="back-link" onClick={()=>{setEditingSection(null);setSection({title:"",subtitle:"",kind:"featured",category:"",product_ids:[],position:String(sections.length),visible:true})}}>Cancel editing</button>}</form><div className="admin-product-list">{sections.map(item=><article key={item.id}><div><strong>{item.title}</strong><small>{item.kind} · Order {item.position} · {item.visible?"Visible":"Hidden"}</small></div><button className="icon-button" onClick={()=>editSection(item)} aria-label={"Edit "+item.title}><Pencil size={16}/></button><button className="coupon-toggle" onClick={async()=>{await request("/api/admin/sections/"+encodeURIComponent(item.id),{method:"DELETE"});await loadAdmin();}}>Delete</button></article>)}</div></section>
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
        {products.length===0?<p className="admin-empty">Your catalogue is empty. Add the first real product above.</p>:<div className="admin-product-list">{products.map(item=><article key={item.id}><img src={item.image_url||"/favicon.svg"} alt=""/><div><strong>{item.name}</strong><small>{item.category} · ₹{item.price.toLocaleString("en-IN")} · Stock {item.stock} · {item.active?"Published":"Hidden"}</small></div><button className="icon-button" onClick={()=>editProduct(item)} aria-label={"Edit "+item.name}><Pencil size={16}/></button><button className="coupon-toggle" onClick={async()=>{if(!window.confirm("Hide "+item.name+" from the catalogue?"))return;await request("/api/admin/products/"+encodeURIComponent(item.id),{method:"DELETE"});await loadAdmin();}}>Hide</button></article>)}</div>}
      </section>
      <section className="admin-list-section"><div className="admin-list-heading"><div><p className="eyebrow">PROMOTIONS</p><h2>Offers <em>({coupons.length})</em></h2></div></div>
        {coupons.length===0?<p className="admin-empty">No coupons have been created yet.</p>:<div className="coupon-list">{coupons.map(item=><article key={item.id}><TicketPercent size={19}/><div><strong>{item.code}</strong><small>{item.discount_type==="percent"?item.discount_value+"% off":"₹"+item.discount_value+" off"} · Used {item.used_count}{item.max_uses?"/"+item.max_uses:""} times</small></div><button type="button" className="coupon-toggle" onClick={()=>void toggleCoupon(item)}>{item.active?"Pause":"Activate"}</button></article>)}</div>}
      </section>
      {stats?.recentActivity?.length? <section className="admin-list-section"><p className="eyebrow">STORE AUDIT TRAIL</p><h2>Recent activity</h2><div className="activity-list">{stats.recentActivity.map((item,i)=><p key={i}><span>{item.action} {item.entity_type}</span><time>{new Date(item.created_at).toLocaleString("en-IN")}</time></p>)}</div></section>:null}
      {notice&&<p role="status" className="admin-notice">{notice}</p>}
    </>:<div className="account-panel"><ShieldCheck size={28}/><h2>Restricted area</h2><p>Only accounts with an administrator role granted by the store owner can access store management. Creating a customer account never grants admin access.</p><a className="checkout-button" href={user?"/profile":"/login"}>{user?"Return to profile":"Sign in"} <ArrowRight size={16}/></a></div>)}
  </section>;
}

