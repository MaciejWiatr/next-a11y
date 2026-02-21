// No metadata export — violation: next-metadata-title
import { Hero } from "../components/Hero";
import { SearchForm } from "../components/SearchForm";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <SearchForm />
    </main>
  );
}
