"use client";

import { useState, useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/authStore";
import * as api from "@/lib/api";
import { ArticleCard } from "@/components/shared/ArticleCard";
import { Card } from "@/components/ui/card";
import { Loader2, Bookmark } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef } from "react";

function BookmarksSkeleton() {
  return (
    <div className="space-y-8 w-full">
      <div className="space-y-2 px-4">
        <div className="h-9 w-48 md:w-64 animate-shimmer rounded-lg bg-muted" />
        <div className="h-6 w-36 md:w-48 animate-shimmer rounded-lg bg-muted" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 px-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="h-[450px] md:h-[500px] animate-shimmer bg-muted" />
        ))}
      </div>
    </div>
  );
}

export default function BookmarksPage() {
  const { user, token } = useAuthStore();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Protect route - redirect if not authenticated
  useEffect(() => {
    if (!token || !user) {
      router.replace("/login");
    } else {
      setIsChecking(false);
    }
  }, [token, user, router]);

  const { 
    data, 
    isLoading, 
    error, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ["bookmarks", user?.email],
    queryFn: ({ pageParam = 1 }) => api.fetchBookmarks(pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.totalResults / 20);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
    enabled: !!user && !!token && !isChecking,
  });

  // Intersection Observer for infinite scrolling
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1, rootMargin: "200px" }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Show loading while checking auth
  if (isChecking || !token || !user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <BookmarksSkeleton />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <BookmarksSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="space-y-4 max-w-lg w-full text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            Your Bookmarks
          </h2>
          <Card className="p-6 md:p-8 border-destructive/50">
            <p className="text-destructive text-sm md:text-base">
              Error fetching bookmarks: {(error as Error).message}
            </p>
          </Card>
        </div>
      </div>
    );
  }

  const allArticles = data?.pages.flatMap((page) => page.articles) || [];
  const totalResults = data?.pages[0]?.totalResults || 0;

  if (!data || allArticles.length === 0) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/25 bg-muted/30 p-8 md:p-16 text-center max-w-2xl w-full">
          <div className="mx-auto flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-full bg-primary/10 mb-6">
            <Bookmark className="h-8 w-8 md:h-10 md:w-10 text-primary" />
          </div>
          <h2 className="text-xl md:text-3xl font-bold mb-2">
            No Bookmarks Yet
          </h2>
          <p className="text-muted-foreground max-w-sm mb-8 text-sm md:text-lg">
            Articles you bookmark will appear here for easy reading later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8 w-full relative">
      <div className="space-y-2 px-4 mt-6">
        <h2 className="text-2xl md:text-4xl font-bold tracking-tight">
          Your Bookmarks
        </h2>
        <p className="text-muted-foreground text-sm md:text-lg">
          {totalResults} saved article{totalResults === 1 ? '' : 's'}
        </p>
      </div>

      <div className="w-full px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {allArticles.map((article, idx) => (
            <ArticleCard key={`${article.url}-${idx}`} article={article} />
          ))}
        </div>
      </div>

      {/* Infinite Scroll Loader Target */}
      <div ref={observerTarget} className="flex justify-center py-6">
        {isFetchingNextPage && (
          <div className="flex items-center text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading more bookmarks...</span>
          </div>
        )}
      </div>
    </div>
  );
}
