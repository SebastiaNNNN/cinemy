import { Suspense } from "react";
import { ExploreClient, ExploreLoading } from "@/components/ExploreClient";

export default function MoviesPage() {
  return (
    <Suspense fallback={<ExploreLoading />}>
      <ExploreClient mediaType="movie" />
    </Suspense>
  );
}
