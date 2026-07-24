import VouchCollect from "@/components/VouchCollect";

export const metadata = {
  title: "Share a vouch — Candidate Collective",
  description: "A quick, trust-first vouch for someone you've worked with.",
};

export default function VouchPage({ params }) {
  return <VouchCollect token={params.token} />;
}
