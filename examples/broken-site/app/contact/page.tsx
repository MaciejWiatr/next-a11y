export const metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <form>
      <h1>Contact Us</h1>
      <input type="text" placeholder="Your name" />
      <input type="email" placeholder="Your email" />
      <textarea placeholder="Your message" />
      <select name="subject">
        <option>General</option>
        <option>Support</option>
      </select>
      <button type="submit">Send</button>
    </form>
  );
}
