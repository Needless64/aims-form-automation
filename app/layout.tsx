import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const siteUrl = process.env.SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default:
      "AIMS Admissions 2026–27 | Arundathi Institute of Medical Sciences",
    template: "%s | AIMS",
  },
  description:
    "Admissions enquiries for Arundathi Institute of Medical Sciences (AIMS), Dundigal, Telangana. MBBS admissions for 2026–27, affiliated to KNRUHS and NMC approved. Counselling code AIMD.",
  keywords: [
    "AIMS admissions",
    "Arundathi Institute of Medical Sciences",
    "MBBS admissions 2026",
    "medical college Hyderabad",
    "KNRUHS",
    "AIMD counselling code",
  ],
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "Arundathi Institute of Medical Sciences",
    title: "AIMS Admissions 2026–27",
    description:
      "Your medical transformation begins here. Enquire about admissions at Arundathi Institute of Medical Sciences, Dundigal.",
    images: [{ url: "/images/campus-main.webp", width: 2048, height: 768 }],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#1f3351",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
