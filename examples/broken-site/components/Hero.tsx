import Image from "next/image";

export function Hero() {
  return (
    <section>
      <Image src="/hero.jpg" fill />
      <h1>Welcome to Our Site</h1>
    </section>
  );
}
