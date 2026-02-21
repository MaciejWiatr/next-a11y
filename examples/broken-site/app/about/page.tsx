// No metadata export — violation: next-metadata-title
export default function AboutPage() {
  return (
    <div>
      <h1>About Us</h1>
      <h3>Our Mission</h3>
      <p>We build great products.</p>
      <div onClick={() => console.log("clicked")}>
        Click to learn more
      </div>
    </div>
  );
}
