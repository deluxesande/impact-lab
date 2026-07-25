import type { Metadata, Viewport } from "next";
import { Poppins, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import { MotionProvider } from "@/components/shell/motion-provider";
import "./globals.css";

// Poppins is NOT a variable font on Google Fonts, so weights must be listed
// explicitly. Three is the whole scale — every extra weight is another file.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Retained solely for figures via the `figure` utility — Poppins' digits are
// wide and non-tabular. Not the UI font.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // `%s` fills from each page's own title; the bare landing page uses `default`.
  title: {
    default: "Impact Lab — fair prices for farmers, cheaper food for everyone",
    template: "%s · Impact Lab",
  },
  description:
    "A fair, fixed rate for farmers' produce and below-supermarket prices for shoppers — with AI doing the pricing and the ordering.",
  applicationName: "Impact Lab",
};

export const viewport: Viewport = {
  // Matches the light-only background so mobile browser chrome doesn't clash.
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${poppins.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="flex min-h-full flex-col bg-background text-foreground">
          {/* No header here deliberately. Each surface renders its own
              <SiteHeader surface="..."> — nesting one here as well would stack
              two headers inside /farmer and /consumer, and the surface can't be
              passed upward from a child layout. Auth pages get none. */}
          <MotionProvider>
            {children}
            <Toaster position="top-center" />
          </MotionProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
