"use client";

import dynamic from "next/dynamic";

const EarningsDashboard = dynamic(
  () => import("@/components/earnings-dashboard").then((mod) => mod.EarningsDashboard),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }
);

export default function HomePage() {
  return <EarningsDashboard />;
}
