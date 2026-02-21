import Link from "next/link";

export function Navbar() {
  return (
    <nav>
      <Link href="/"><a className="nav-link">Home</a></Link>
      <Link href="/about"><a className="nav-link">About</a></Link>
      <a href="https://twitter.com"><TwitterIcon /></a>
      <a href="https://github.com"><GithubIcon /></a>
    </nav>
  );
}

function TwitterIcon() {
  return <svg viewBox="0 0 24 24"><path d="M23 3a10.9 10.9 0 01-3.14 1.53" /></svg>;
}

function GithubIcon() {
  return <svg viewBox="0 0 24 24"><path d="M9 19c-5 1.5-5-2.5-7-3" /></svg>;
}
