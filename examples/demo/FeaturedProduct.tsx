"use client";
/**
 * next-a11y demo — npx next-a11y scan examples/demo --fix
 */
import Image from "next/image";
import Link from "next/link";
import { CartIcon, HeartIcon, TwitterIcon } from "./icons";

export default function FeaturedProduct({ product = { image: "https://picsum.dev/400/300?seed=product" } }: { product?: { image: string } }) {
  return (
    <article className="card" tabIndex={0}>
      <Image src="https://picsum.dev/400/300?seed=hero" fill alt="300?Seed=Hero image" />
      <Image src={product.image} fill />

      <input type="text" placeholder="Search..." aria-label="Search products" />

      <button onClick={() => {}} type="button" aria-label="Add to cart"><CartIcon /></button>
      <button onClick={() => {}} type="button" aria-label="Add to favorites"><HeartIcon /></button>

      <form onSubmit={(e) => { e.preventDefault(); alert("You're on the list!"); }} className="notify-form">
        <label htmlFor="notify-email">Email</label>
        <input id="notify-email" type="email" placeholder="you@example.com" />
        <input type="text" placeholder="Your name" aria-label="Enter your name" />
        <select aria-label="Select product option">
          <option value="">Size preference</option>
          <option value="s">Small</option>
          <option value="m">Medium</option>
          <option value="l">Large</option>
        </select>
        <button type="submit">Notify when available</button>
      </form>

      <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Visit Twitter"><TwitterIcon /></a>

      <Link href="/shop" target="_blank" rel="noopener noreferrer">View all</Link>
    </article>
  );
}
