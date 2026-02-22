// Violations: html-lang, next-skip-nav
// - No lang on <html>
// - No skip navigation link (href="#main-content" or text "skip")
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { ThemeToggle } from "../components/ThemeToggle";
import { Sidebar } from "../components/Sidebar";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <ThemeToggle />
        <Sidebar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
