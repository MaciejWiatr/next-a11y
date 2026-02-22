// Violations: emoji-alt (🔥, 🚀), link-noopener (target="_blank" without rel)
export function Footer() {
  return (
    <footer>
      <p>Made with <span role="img" aria-label="fire">🔥</span> by our team</p>
      <p>Follow us <span role="img" aria-label="rocket">🚀</span></p>
      <a href="https://twitter.com" target="_blank" rel="noopener noreferrer">Twitter</a>
      <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
      <a href="https://discord.com" target="_blank" rel="noopener noreferrer">Discord</a>
    </footer>
  );
}
