import Image from "next/image";

export function Hero() {
  return (
    <section>
      <Image src="/hero.png" fill />
      <h1>Welcome to Our Site</h1>
    </section>
  );
}
