import type { Metadata, Viewport } from "next";
import { Inter, Oswald } from "next/font/google";
import { headers } from "next/headers";
import { CatalogLanguageProvider } from "@/components/CatalogLanguageProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { MyListProvider } from "@/components/MyListProvider";
import { PartyProvider } from "@/components/PartyProvider";
import { ClientGuard } from "@/components/ClientGuard";
import { PwaRegistration } from "@/components/PwaRegistration";
import { TvRemoteNavigation } from "@/components/TvRemoteNavigation";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const oswald = Oswald({ subsets: ["latin"], variable: "--font-display" });

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#141414",
  // Draws under the display cutout on notched phones instead of letterboxing it black.
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "Cinemy — Media Dashboard";
  const description = "Personal movie catalog, online streaming and synchronized progress.";

  return {
    metadataBase: new URL(origin),
    title,
    description,
    manifest: "/manifest.webmanifest",
    applicationName: "Cinemy",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Cinemy",
    },
    icons: {
      icon: [{ url: "/icons/cinemy.svg", type: "image/svg+xml" }],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    openGraph: { title, description, type: "website", images: [{ url: `${origin}/og.png`, width: 1792, height: 1024 }] },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${oswald.variable}`}>
        <CatalogLanguageProvider>
          <AuthProvider>
            <MyListProvider>
              <PartyProvider>
              <PwaRegistration />
              <TvRemoteNavigation />
              <ClientGuard />
              {children}
              </PartyProvider>
            </MyListProvider>
          </AuthProvider>
        </CatalogLanguageProvider>
      </body>
    </html>
  );
}
