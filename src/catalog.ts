export type Category = "All" | "Home" | "Wear" | "Jewellery" | "Art";
export interface Product {
  id: string; name: string; maker: string; category: Exclude<Category, "All">;
  price: number; oldPrice?: number; image: string; badge?: string;
  description: string; material: string; origin: string;
}
export const categories: Array<{ name: Exclude<Category, "All">; note: string; image: string }> = [
  { name: "Home", note: "Objects with a little soul", image: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=85" },
  { name: "Wear", note: "Everyday, made exceptional", image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=900&q=85" },
  { name: "Jewellery", note: "Small things, lasting stories", image: "https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=900&q=85" },
  { name: "Art", note: "A point of view for your walls", image: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=900&q=85" },
];
export const products: Product[] = [];
export const formatPrice = (amount: number): string =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);