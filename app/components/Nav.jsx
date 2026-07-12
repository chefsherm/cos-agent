import Link from "next/link";
import CCMark from "./CCMark";

export default function Nav() {
  return (
    <nav className="cc-nav">
      <Link href="/" className="cc-brand">
        <CCMark />
        Candidate Collective
      </Link>
      <div className="cc-nav-links">
        <Link href="/login" className="cc-btn cc-btn-ghost">
          Sign in
        </Link>
        <Link href="/post-role" className="cc-btn cc-btn-primary">
          Vouch for someone
        </Link>
      </div>
    </nav>
  );
}
