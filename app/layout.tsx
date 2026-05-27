import type { Metadata, Viewport } from "next";
import { SeasonProvider } from "@/lib/season-context";
import { AuthProvider } from "@/lib/auth";
import AuthGate from "@/components/AuthGate";
import BottomNav from "@/components/BottomNav";
import SyncStatus from "@/components/SyncStatus";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wireman Golf League",
  description: "Family golf league scoring — Ella Sharp Park, Jackson MI",
};

export const viewport: Viewport = {
  themeColor: "#14532D",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AuthGate>
            <SeasonProvider>
              <div className="mx-auto flex min-h-screen max-w-md flex-col">
                <SyncStatus />
                <main className="flex-1 px-4 pb-28 pt-5">{children}</main>
                <BottomNav />
              </div>
            </SeasonProvider>
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
