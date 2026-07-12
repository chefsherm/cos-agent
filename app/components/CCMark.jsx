// The CC mark — two interlocking rings.
//
// FLAG: The brief says "reference the existing logo asset, never regenerate it."
// No logo asset ships in this repo. Drop the real mark at /public/cc-mark.svg
// and this component will use it. Until then it renders a minimal geometric
// two-ring placeholder (NOT a generated logo) so layout is correct. See FLAGS.md.

export default function CCMark({ size = 26 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 28"
      fill="none"
      aria-label="Candidate Collective"
      role="img"
    >
      <circle cx="14" cy="14" r="10.5" stroke="#B8962E" strokeWidth="2" />
      <circle cx="26" cy="14" r="10.5" stroke="#F0EDE4" strokeWidth="2" />
    </svg>
  );
}
