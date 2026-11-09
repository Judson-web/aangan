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
export const products: Product[] = [
  { id: "01", name: "The Sunday Table Set", maker: "Mitti Studio", category: "Home", price: 2450, oldPrice: 2900, image: "https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?auto=format&fit=crop&w=900&q=85", badge: "Bestseller", description: "A quietly beautiful table set, shaped by hand and finished in a soft, earthy glaze. Made for slow breakfasts and long conversations.", material: "Stoneware ceramic", origin: "Khurja, Uttar Pradesh" },
  { id: "02", name: "Gulabi Handloom Scarf", maker: "Neel Looms", category: "Wear", price: 1850, image: "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=900&q=85", badge: "New arrival", description: "Light, breathable and woven with a gentle rhythm of colour. An easy layer that brings a little craft into an ordinary day.", material: "Handwoven cotton", origin: "Chanderi, Madhya Pradesh" },
  { id: "03", name: "Aabha Brass Hoops", maker: "House of Aabha", category: "Jewellery", price: 1290, image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=900&q=85", description: "Sculptural brass hoops with a warm, brushed finish. Light enough for every day, distinctive enough to be remembered.", material: "Recycled brass", origin: "Jaipur, Rajasthan" },
  { id: "04", name: "Monsoon Study No. 4", maker: "Aranya Atelier", category: "Art", price: 3200, image: "https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=900&q=85", description: "An expressive study in layered pigment and movement, inspired by the first rain over a dry landscape.", material: "Archival print on cotton rag", origin: "Kochi, Kerala" },
  { id: "05", name: "Dhoop Incense Holder", maker: "Mitti Studio", category: "Home", price: 890, image: "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=900&q=85", description: "A small, tactile ritual object with a natural finish. Each piece carries the subtle marks of the hands that made it.", material: "Terracotta", origin: "Auroville, Tamil Nadu" },
  { id: "06", name: "Sunehri Everyday Tote", maker: "Neel Looms", category: "Wear", price: 1650, image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=85", description: "A roomy carryall in sturdy woven cotton, finished with considered details and made to be used, not saved.", material: "Handloom cotton", origin: "Kutch, Gujarat" },
  { id: "07", name: "Kamal Pendant", maker: "House of Aabha", category: "Jewellery", price: 2150, image: "https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=900&q=85", badge: "Limited", description: "A lotus-inspired pendant with a softly sculpted silhouette. A little reminder to find your own kind of stillness.", material: "Gold-plated brass", origin: "Jaipur, Rajasthan" },
  { id: "08", name: "Earth & Ochre Print", maker: "Aranya Atelier", category: "Art", price: 2750, image: "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=900&q=85", description: "Warm mineral tones and organic forms bring the calm of the natural world into your space.", material: "Giclée art print", origin: "Kochi, Kerala" },
];
export const formatPrice = (amount: number): string =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);