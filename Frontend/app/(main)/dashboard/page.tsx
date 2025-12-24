"use client";

import { useState, useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/authStore";
import * as api from "@/lib/api";
import { ArticleCard } from "@/components/shared/ArticleCard";
import { ProgressLoader } from "@/components/shared/ProgressLoader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Glasses, Settings, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useCallback } from "react";

function BriefingSkeleton() {
  return (
    <div className="space-y-8 w-full">
      <div className="space-y-2 px-4">
        <div className="h-9 w-48 md:w-64 animate-shimmer rounded-lg" />
        <div className="h-6 w-36 md:w-48 animate-shimmer rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 px-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="h-[450px] md:h-[500px] animate-shimmer" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
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
    isFetchingNextPage,
    refetch 
  } = useInfiniteQuery({
    queryKey: ["dashboardNews", user?.email],
    queryFn: ({ pageParam = 1 }) => api.fetchNews(user!.email!, null, pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.totalResults / 20);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
    enabled: !!user && !!token && !isChecking,
    staleTime: 5 * 60 * 1000,
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
        <BriefingSkeleton />
      </div>
    );
  }

  const latestPage = data?.pages[0];

  // Handle background ingestion task state
  if (latestPage && latestPage.status === "processing") {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 w-full">
        <ProgressLoader
          taskId={latestPage.task_id!}
          onComplete={() => {
            refetch();
          }}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <BriefingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="space-y-4 max-w-lg w-full text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            Your Daily Briefing
          </h2>
          <Card className="p-6 md:p-8 border-destructive/50">
            <p className="text-destructive text-sm md:text-base">
              Error fetching your briefing: {(error as Error).message}
            </p>
          </Card>
        </div>
      </div>
    );
  }

  if (user.preferred_domains.length === 0) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/25 bg-muted/30 p-8 md:p-16 text-center max-w-2xl w-full">
          <div className="mx-auto flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-full bg-primary/10 mb-6">
            <Glasses className="h-8 w-8 md:h-10 md:w-10 text-primary" />
          </div>
          <h2 className="text-xl md:text-3xl font-bold mb-2">
            Welcome to NewsLens!
          </h2>
          <p className="text-muted-foreground max-w-sm mb-8 text-sm md:text-lg">
            Let's personalize your news feed. Select topics you're interested in
            to get started.
          </p>
          <Button asChild size="lg" className="gap-2">
            <Link href="/settings">
              <Settings className="h-4 w-4" />
              Choose Your Interests
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const allArticles = data?.pages.flatMap((page) => page.articles) || [];

  if (!data || allArticles.length === 0) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="space-y-4 max-w-lg w-full text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            Your Daily Briefing
          </h2>
          <Card className="p-6 md:p-8 text-center">
            <p className="text-muted-foreground text-sm md:text-base">
              No articles found matching your preferences right now. Try
              adjusting your interests in settings.
            </p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/settings">
                <Settings className="h-4 w-4 mr-2" />
                Update Preferences
              </Link>
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8 w-full relative">
      <div className="space-y-2 px-4">
        <h2 className="text-2xl md:text-4xl font-bold tracking-tight">
          Your Daily Briefing
        </h2>
        <p className="text-muted-foreground text-sm md:text-lg">
          {latestPage?.totalResults || 0} articles curated for you
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
            <span className="text-sm">Loading more articles...</span>
          </div>
        )}
      </div>
    </div>
  );
}