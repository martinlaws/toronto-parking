import type { Metadata, Viewport } from "next";
import { Archivo, DM_Mono, Newsreader } from "next/font/google";

import Analytics from "@/components/Analytics";
import { METADATA_BASE, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { GROUND } from "@/lib/theme";
import "./globals.css";

/**
 * Structure: every heading, every figure, every uppercase label, and the
 * running text besides. `axes: ["wdth"]` is the load-bearing argument.
 * `next/font/google` ships a variable font's weight axis and nothing else
 * unless the extras are named, so without it the masthead at `wdth 118` and a
 * tier head at `wdth 84` both arrive at 100 and the width ladder the whole
 * type system hangs from flattens to one width, silently and at build time.
 */
const sans = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

/**
 * A person speaking: ledes, captions, the legend, the dedication, the
 * signature. `axes: ["opsz"]` for the same reason the sans names `wdth` — the
 * dedication is set at `opsz 60` and a caption at `opsz 14`, and without the
 * axis both render at the 16 the face defaults to. The italic is a real cut
 * and has to be asked for: `font-synthesis: none` in `globals.css` means a
 * missing italic stays upright rather than being slanted to fake one.
 */
const serif = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  display: "swap",
});

/**
 * Machine strings and micro-labels: par figures, board coordinates, the board
 * string, the code. DM Mono is not a variable family, so `weight` is required
 * rather than optional, and the three cuts here are the three the design uses.
 */
const mono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
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
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable} ${mono.variable} h-full antialiased`}
    >
      {/* Body text is `ink-edge`, not `ink`. The near-black is display ink,
          meaning headings, figures and the structural rules, and the page
          flattens to one colour if running prose takes it too. Anything that
          wants the darker one asks for it. */}
      <body className="flex min-h-full flex-col bg-ground text-ink-edge">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
