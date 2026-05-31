import type { Metadata } from "next";

import CartPage from "@/components/cart/CartPage";

export const metadata: Metadata = {
  title: "Cart | TecBunny",
  description: "Review the products in your cart and continue to our secure checkout in a single step.",
};

export default function Page() {
  return <CartPage />;
}
