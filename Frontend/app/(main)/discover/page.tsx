"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { ArticleCard } from "@/components/shared/ArticleCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BackendArticle } from "@/types";
import { AlertCircle, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

function BriefingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
      {[...Array(8)].map((_, i) => (
        <Card key={i} className="h-[450px] md:h-[500px] animate-shimmer" />
      ))}
    </div>
  );
}

export default function DiscoverPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["topHeadlines", page],
    queryFn: () => api.fetchTopHeadlines(page),
    staleTime: 5 * 60 * 1000,
    retry: 2,
    // Removed placeholderData
  });

  if (isLoading) {
    return (
      <div className="space-y-8 px-4">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Discover: Top Headlines
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Fetching the latest top headlines...
          </p>
        </div>
        <BriefingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8 px-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Discover: Top Headlines
        </h1>
        <Card className="p-6 md:p-8 border-destructive/50">
          <div className="flex items-start gap-4">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div className="space-y-2">
              <p className="text-destructive font-medium text-sm md:text-base">
                Error fetching headlines
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {(error as Error).message}
              </p>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                size="sm"
                className="mt-4"
              >
                Retry
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!data || data.articles.length === 0) {
    return (
      <div className="space-y-8 px-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Discover: Top Headlines
        </h1>
        <Card className="p-6 md:p-8 text-center">
          <p className="text-muted-foreground text-sm md:text-base">
            No top headlines found at the moment. Please try again later.
          </p>
        </Card>
      </div>
    );
  }

  const totalPages = Math.ceil(data.totalResults / 20);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return (
    <div className="space-y-8 px-4 relative">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Discover: Top Headlines
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Page {page} of {totalPages > 0 ? totalPages : 1} ({data.totalResults}{" "}
          results)
        </p>
      </div>

      {/* Loading Overlay when fetching new page */}
      {isFetching && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="p-6 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Loading page {page}...</p>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {data.articles.map((article: BackendArticle) => (
          <ArticleCard key={article.url} article={article} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-4">
          <Button
            onClick={() => setPage((old) => Math.max(old - 1, 1))}
            disabled={!hasPrevPage || isFetching}
            variant="outline"
            size="default"
            className="gap-2 w-full sm:w-auto"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>

          <span className="text-sm text-muted-foreground whitespace-nowrap">
            Page {page} of {totalPages}
          </span>

          <Button
            onClick={() => {
              if (page < totalPages) {
                setPage((old) => old + 1);
              }
            }}
            disabled={isFetching || !hasNextPage}
            size="default"
            className="gap-2 w-full sm:w-auto"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
