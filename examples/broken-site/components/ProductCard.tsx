import Image from "next/image";

export function ProductCard() {
  return (
    <div tabIndex={3}>
      <Image src="/product-screenshot.png" alt="Cool product dashboard" width={300} height={200} />
      <h3>Product Name</h3>
      <p>$29.99</p>
      <div onClick={() => console.log("add to cart")} style={{ cursor: "pointer" }}>
        Add to Cart
      </div>
    </div>
  );
}
