import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";

import Analytics from "@/components/Analytics";
import { METADATA_BASE, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { GROUND } from "@/lib/theme";
import "./globals.css";

/** Display face. Fraunces is the noted alternate; Bricolage is the default. */
const display = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const body = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: METADATA_BASE,
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // No `title`, `description` or `url` here: a card page sets its own, and
  // pinning them in the layout would make every "I'm stuck on #31" preview
  // read as the generic site pointing back at the root.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: GROUND,
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-ground text-ink">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
