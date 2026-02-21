// No metadata export — violation: next-metadata-title
// No lang on <html> — violation: html-lang
// No skip nav — violation: next-skip-nav
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
