// Violations: img-alt (generic "photo", filename "IMG_4232.jpg")
import Image from "next/image";

export function TeamSection() {
  return (
    <section>
      <h2>Our Team</h2>
      <Image src="/team-photo.jpg" alt="photo" width={400} height={300} />
      <Image src="/product.jpg" alt="IMG_4232.jpg" width={600} height={400} />
    </section>
  );
}
