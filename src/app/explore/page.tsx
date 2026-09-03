import { Suspense } from "react";
import { ExploreClient } from "@/components/ExploreClient";

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="explore-loading">Se pregătește catalogul…</div>}>
      <ExploreClient />
    </Suspense>
  );
}
