import { Suspense } from "react";
import { ExploreClient, ExploreLoading } from "@/components/ExploreClient";

export default function ExplorePage() {
  return (
    <Suspense fallback={<ExploreLoading />}>
      <ExploreClient />
    </Suspense>
  );
}
