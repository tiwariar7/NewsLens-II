"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { ArticleCard } from "@/components/shared/ArticleCard";
import { ProgressLoader } from "@/components/shared/ProgressLoader";
import { ChatInterface } from "@/components/search/ChatInterface";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchIcon, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";

function SearchSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
      {[...Array(6)].map((_, i) => (
        <Card key={i} className="h-[450px] md:h-[500px] animate-shimmer" />
      ))}
    </div>
  );
}

export default function SearchPage() {
  const { token, user } = useAuthStore();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [searchMode, setSearchMode] = useState("recent");
  const [submittedMode, setSubmittedMode] = useState("recent");
  const [page, setPage] = useState(1);
  const [isChecking, setIsChecking] = useState(true);

  // Protect route
  useEffect(() => {
    if (!token || !user) {
      router.replace("/login");
    } else {
      setIsChecking(false);
    }
  }, [token, user, router]);

  const { data, isLoading, error, isFetching, refetch } = useQuery({
    queryKey: ["searchNews", submittedQuery, page, submittedMode],
    queryFn: () => {
      if (submittedMode === "recent") {
        return api.searchNews(submittedQuery, page);
      } else {
        return api.historicalSearch(submittedQuery, submittedMode);
      }
    },
    enabled: submittedQuery !== "" && !!token && !isChecking,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setPage(1);
      setSubmittedQuery(query.trim());
      setSubmittedMode(searchMode);
    }
  };

  // Show loading while checking auth
  if (isChecking || !token || !user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <SearchSkeleton />
      </div>
    );
  }

  const totalPages = data ? Math.ceil(data.totalResults / 20) : 0;
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return (
    <div className="space-y-8 pb-8 w-full px-4 relative">
      {/* Header Section */}
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight">
            Search News
          </h1>
          <p className="text-muted-foreground text-sm md:text-lg max-w-2xl mx-auto">
            Find articles on any topic that interests you
          </p>
        </div>

        {/* Search Form */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col w-full max-w-2xl mx-auto gap-4"
        >
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="text"
              placeholder="Search for topics, e.g., 'AI'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 h-10 md:h-11"
            />
            <Button 
              type="submit" 
              size="default" 
              disabled={isLoading || !query.trim()}
              className="w-full sm:w-auto"
            >
              <SearchIcon className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
          
          <Tabs value={searchMode} onValueChange={setSearchMode} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="recent">Recent News</TabsTrigger>
              <TabsTrigger value="historical">Historical Search</TabsTrigger>
              <TabsTrigger value="research">Research Mode</TabsTrigger>
            </TabsList>
          </Tabs>
        </form>
      </div>

      {/* Loading Overlay when fetching new page */}
      {isFetching && submittedQuery && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="p-6 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Loading page {page}...</p>
          </Card>
        </div>
      )}

      {/* Results Section */}
      <div className="mt-8">
        {isLoading && (
          <div className="space-y-4">
            <p className="text-center text-muted-foreground text-sm md:text-base">
              Searching...
            </p>
            <SearchSkeleton />
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center min-h-[400px]">
            <Card className="p-6 md:p-8 max-w-md w-full text-center">
              <p className="text-destructive font-medium mb-2 text-sm md:text-base">
                Error searching articles
              </p>
              <p className="text-sm text-muted-foreground">
                {(error as Error).message}
              </p>
            </Card>
          </div>
        )}

        {submittedQuery && !isLoading && !error && data && data.status === "processing" && (
          <div className="flex items-center justify-center min-h-[400px] w-full">
            <ProgressLoader
              taskId={data.task_id!}
              onComplete={() => {
                refetch();
              }}
            />
          </div>
        )}

        {submittedQuery && !isLoading && !error && data && data.status !== "processing" && (
          <>
            {page === 1 && data.articles.length > 0 && (
              <ChatInterface query={submittedQuery} contextArticles={data.articles.slice(0, 5)} />
            )}

            <div className="mb-6">
              <p className="text-muted-foreground text-center text-sm md:text-base">
                Found{" "}
                <span className="font-semibold text-foreground">
                  {data.totalResults}
                </span>{" "}
                results for "
                <span className="font-semibold text-foreground wrap-break-word">
                  {submittedQuery}
                </span>
                "
              </p>
            </div>

            {data.articles.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {data.articles.map((article) => (
                    <ArticleCard key={article.url} article={article} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-8">
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

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium whitespace-nowrap">
                        Page {page} of {totalPages}
                      </span>
                    </div>

                    <Button
                      onClick={() => setPage((old) => old + 1)}
                      disabled={!hasNextPage || isFetching}
                      size="default"
                      className="gap-2 w-full sm:w-auto"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center min-h-[400px]">
                <Card className="p-6 md:p-8 max-w-md w-full text-center">
                  <p className="text-muted-foreground text-sm md:text-base">
                    No articles found for "
                    <span className="font-semibold wrap-break-word">{submittedQuery}</span>".
                    Try a different search term.
                  </p>
                </Card>
              </div>
            )}
          </>
        )}

        {!submittedQuery && !isLoading && (
          <div className="flex items-center justify-center min-h-[400px]">
            <Card className="p-8 md:p-12 max-w-md w-full text-center">
              <SearchIcon className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground text-base md:text-lg">
                Enter a search term to find articles
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}