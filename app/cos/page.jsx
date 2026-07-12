import Dashboard from "@/components/Dashboard";

// The original CoS Agent (Chief of Staff for Sherm) is preserved here at /cos.
// The CC platform rebuild is now the primary app at /.
export const metadata = {
  title: "Chief of Staff — Sherm",
  description: "CoS Agent for Candidate Collective",
};

export default function CosHome() {
  return <Dashboard />;
}
