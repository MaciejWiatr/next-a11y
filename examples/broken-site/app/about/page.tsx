// Violations: next-metadata-title, heading-order (h1 -> h3 skip)
import { TeamSection } from "../../components/TeamSection";

export default function AboutPage() {
  return (
    <main>
      <h1>About Us</h1>
      <h3>Our Mission</h3>
      <p>We build great things.</p>
      <TeamSection />
    </main>
  );
}
