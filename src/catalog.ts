export type Category = "All" | "Home" | "Wear" | "Jewellery" | "Art";
export interface Product {
  id: string; name: string; maker: string; category: Exclude<Category, "All">;
  price: number; oldPrice?: number; image: string; badge?: string;
  description: string; material: string; origin: string;
}
export const categories: Array<{ name: Exclude<Category, "All">; note: string; image: string }> = [
  { name: "Home", note: "Objects with a little soul", image: "/thrilokha-artwork.svg" },
  { name: "Wear", note: "Everyday, made exceptional", image: "/thrilokha-artwork.svg" },
  { name: "Jewellery", note: "Small things, lasting stories", image: "/thrilokha-artwork.svg" },
  { name: "Art", note: "A point of view for your walls", image: "/thrilokha-artwork.svg" },
];
export const products: Product[] = [];
export const formatPrice = (amount: number): string =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);