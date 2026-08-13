import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "Comb — Support should travel";
const description =
  "An open protocol for portable, verifiable patronage entitlements. Federate the entitlements. Never federate the money.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "comb.is";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  const origin = `${protocol}://${host}`;
  const socialImage = new URL("/og.png", origin).toString();

  return {
    title,
    description,
    metadataBase: new URL(origin),
    alternates: {
      canonical: "/",
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: origin,
      images: [
        {
          url: socialImage,
          width: 1731,
          height: 909,
          alt: "Comb — Support should travel.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
