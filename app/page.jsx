import Link from "next/link";
import Nav from "./components/Nav";
import {
  MISSION,
  HERO_STATS,
  HOW_IT_WORKS,
  CASE_STUDIES,
  CLOSING_CTA,
  MANUAL_PROOF_POINT,
} from "@/lib/ccData";

export const metadata = {
  title: "Candidate Collective — trust as the only currency",
  description: MISSION,
};

export default function Landing() {
  return (
    <div className="cc-root">
      <Nav />

      <div className="cc-wrap">
        {/* Hero */}
        <header className="cc-hero">
          <div className="cc-eyebrow">Trust infrastructure for hospitality</div>
          <h1>The people who build hospitality, connected.</h1>
          <p className="cc-mission">{MISSION}</p>
          <div className="cc-hero-ctas">
            <Link href="/post-role" className="cc-btn cc-btn-primary cc-btn-lg">
              Vouch for someone
            </Link>
            <Link href="/post-role" className="cc-btn cc-btn-ghost cc-btn-lg">
              Post a role
            </Link>
          </div>
        </header>

        {/* Stat bar — four real numbers */}
        <div className="cc-stats">
          {HERO_STATS.map((s) => (
            <div className="cc-stat" key={s.key}>
              <div className={`cc-stat-value${s.value ? "" : " cc-pending"}`}>
                {s.value || "—"}
              </div>
              <div className="cc-stat-label">{s.label}</div>
              {s.sourced && !s.value && (
                <span className="cc-stat-flag" title="Populate from the ClickUp Contact Spine before launch">
                  Sourced · pending real value
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* How it works — the canonical four-step match flow */}
      <section className="cc-section">
        <div className="cc-wrap">
          <div className="cc-section-eyebrow">How it works</div>
          <h2>One flow, from posted role to proof step.</h2>
          <p className="cc-section-lede">
            No email touches any part of this sequence — everything happens in-app
            or through appointment booking.
          </p>
          <div className="cc-steps">
            {HOW_IT_WORKS.map((step) => (
              <div className="cc-step" key={step.n}>
                <div className="cc-step-n">{step.n}</div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Signal, not applications */}
      <section className="cc-section">
        <div className="cc-wrap">
          <div className="cc-section-eyebrow">Signal, not applications</div>
          <h2>We don't run keyword searches or accept open applications.</h2>
          <p className="cc-section-lede">
            Every candidate surfaces through someone who already knows them —
            scored by proximity in the Vouch Graph, not by self-reported experience.
          </p>
          <div className="cc-signal-grid">
            <div className="cc-rule-card">
              <h3>Cross-functional sourcing, enforced in the algorithm</h3>
              <p>
                Front-of-house users are only surfaced as Referrers for
                back-of-house searches, and back-of-house users only for
                front-of-house searches. Same-side suggestions are structurally
                excluded from the output — not filtered after the fact.
              </p>
              <div className="cc-rule-flow">
                <span className="cc-pill">Back-of-house role</span>
                <span className="cc-arrow">← asks →</span>
                <span className="cc-pill cc-pill-gold">Front-of-house Referrer</span>
              </div>
              <div className="cc-rule-flow">
                <span className="cc-pill">Front-of-house role</span>
                <span className="cc-arrow">← asks →</span>
                <span className="cc-pill cc-pill-gold">Back-of-house Referrer</span>
              </div>
            </div>
            <div className="cc-rule-card">
              <h3>The Vouch Graph</h3>
              <p>
                Every user sits in a graph modeled on the Erdős Number — trust
                distance is the scored signal. Vouch Number is computed from
                proximity to Tier-0 anchors across ten named lineages. The AI
                recommends who to ask; it never scores or certifies a candidate.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Case studies — real closed matches */}
      <section className="cc-section">
        <div className="cc-wrap">
          <div className="cc-section-eyebrow">Case studies</div>
          <h2>{MANUAL_PROOF_POINT}.</h2>
          <div className="cc-cases">
            {CASE_STUDIES.map((c) => (
              <div className="cc-case" key={c.name}>
                <div className="cc-case-name">{c.name}</div>
                <div className="cc-case-row">
                  <span className="cc-case-key">Challenge</span>
                  <span className="cc-case-val">{c.challenge}</span>
                </div>
                <div className="cc-case-row">
                  <span className="cc-case-key">Result</span>
                  <span className="cc-case-val">{c.result}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="cc-closing">
        <div className="cc-wrap">
          <h2>{CLOSING_CTA}</h2>
          <div className="cc-hero-ctas">
            <Link href="/post-role" className="cc-btn cc-btn-primary cc-btn-lg">
              Vouch for someone
            </Link>
            <Link href="/post-role" className="cc-btn cc-btn-ghost cc-btn-lg">
              Post a role
            </Link>
          </div>
        </div>
      </section>

      <footer className="cc-wrap cc-footer">
        <span>© {new Date().getFullYear()} Candidate Collective</span>
        <span>
          Founding operators: Jean-Georges · Major Food Group · Gabriel Kreuther
        </span>
      </footer>
    </div>
  );
}
