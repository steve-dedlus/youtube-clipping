import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Technical Clipper",
  description: "Clip long-form YouTube content into viral short-form videos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
