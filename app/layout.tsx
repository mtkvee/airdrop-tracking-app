import "./globals.css";
import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  metadataBase: new URL("https://airdroptracer.vercel.app/"),
  title: "Airdrop Tracer | Track and Organize Your Crypto Airdrops",
  description:
    "Track, verify, and organize crypto airdrops with a clean history, fast filters, and local-first storage.",
  keywords: [
    "airdrop",
    "crypto",
    "tracer",
    "blockchain",
    "rewards",
    "web3",
    "tracking app",
    "vee",
  ],
  applicationName: "Airdrop Tracer",
  creator: "Vee",
  publisher: "Vee",
  authors: [{ name: "Vee" }],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-video-preview": -1,
      "max-snippet": -1,
    },
  },
  icons: {
    apple: "/favicon/apple-touch-icon.png",
    icon: [
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    other: [{ rel: "manifest", url: "/favicon/site.webmanifest" }],
  },
  openGraph: {
    title: "Airdrop Tracer | Track and Organize Your Crypto Airdrops",
    description:
      "Track, verify, and organize crypto airdrops with a clean history, fast filters, and local-first storage.",
    type: "website",
    siteName: "Airdrop Tracer",
    url: "/",
    images: [
      {
        url: "/og/open-graph-1200x630.png",
        width: 1200,
        height: 630,
        alt: "Airdrop Tracer logo artwork",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Airdrop Tracer | Track and Organize Crypto Airdrops",
    description:
      "Track, verify, and organize crypto airdrops with a clean history, fast filters, and local-first storage.",
    images: ["/og/open-graph-1200x630.png"],
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isVercelDeployment = process.env.VERCEL === "1";
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
        />
      </head>
      <body>
        {children}
        {isVercelDeployment ? <SpeedInsights /> : null}
      </body>
    </html>
  );
}
