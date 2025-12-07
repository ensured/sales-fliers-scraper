"use client";

import dynamic from "next/dynamic";

// Dynamically import the main component to avoid SSR issues
const HomeContent = dynamic(
  () => import("./HomeContent").then((mod) => mod.default),
  {
    ssr: false,
  }
);

export default function Page() {
  return <HomeContent />;
}
