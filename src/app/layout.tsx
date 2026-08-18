import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/providers/QueryProvider";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "CSI Attendance Tracker",
  description: "Committee attendance tracking and management system for CSI",
  icons: {
    icon: "/csi.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${plusJakarta.variable} antialiased`}
      >
        <AuthProvider>
          <QueryProvider>
            <AppShell>{children}</AppShell>
            <Toaster position="bottom-right" richColors closeButton />
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
