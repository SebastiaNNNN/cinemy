import { Suspense } from "react";
import { ExploreClient, ExploreLoading } from "@/components/ExploreClient";

export default function SeriesPage() {
  return (
    <Suspense fallback={<ExploreLoading />}>
      <ExploreClient mediaType="tv" />
    </Suspense>
  );
}
