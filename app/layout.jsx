import "./globals.css";

export const metadata = {
  title: "Chief of Staff — Sherm",
  description: "CoS Agent for Candidate Collective",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
