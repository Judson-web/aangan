import { describe, expect, it } from "vitest";
import { categories, formatPrice, products } from "./catalog";

describe("Aangan catalogue", () => {
  it("contains all four curated departments", () => {
    expect(categories.map((category) => category.name)).toEqual(["Home", "Wear", "Jewellery", "Art"]);
  });

  it("keeps product identifiers unique", () => {
    expect(new Set(products.map((product) => product.id)).size).toBe(products.length);
  });

  it("formats prices using Indian rupees", () => {
    expect(formatPrice(2450)).toBe("₹2,450");
  });
});