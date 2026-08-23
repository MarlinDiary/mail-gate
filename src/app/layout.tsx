import type { Metadata, Viewport } from "next";
import { Caveat, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "Mail Gate",
  description: "Protected mailbox link feed",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="flex h-full flex-col overflow-hidden">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster closeButton position="top-center" richColors theme="light" />
      </body>
    </html>
  );
}
