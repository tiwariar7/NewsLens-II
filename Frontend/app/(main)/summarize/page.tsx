// app/(main)/summarize/page.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ExternalLink, List, FileText, Bookmark } from "lucide-react";
import { useArticleStore } from "@/lib/articleStore";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { recordArticleRead } from "@/lib/api";

// --- MODIFIED SKELETON ---
// This skeleton now matches the structure of the final page,
// similar to how your SearchSkeleton matches its page's grid.
function SummarySkeleton() {
  return (
    <article className="mx-auto max-w-4xl space-y-8">
      {/* 1. Title Skeleton */}
      <div className="h-10 md:h-11 w-3/4 animate-pulse rounded-lg bg-muted"></div>

      {/* 2. Image Skeleton */}
      <div className="relative h-64 md:h-96 w-full animate-pulse rounded-lg bg-muted"></div>

      {/* 3. AI Summary Card Skeleton */}
      <Card>
        <CardHeader>
          {/* Card Title Skeleton */}
          <div className="h-8 md:h-9 w-1/2 animate-pulse rounded-lg bg-muted"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Summary Text Skeleton */}
            <div className="h-6 w-full animate-pulse rounded-lg bg-muted"></div>
            <div className="h-6 w-full animate-pulse rounded-lg bg-muted"></div>
            <div className="h-6 w-5/6 animate-pulse rounded-lg bg-muted"></div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Button Skeleton */}
      <div className="h-11 w-full animate-pulse rounded-lg bg-muted"></div>

      {/* 5. Sources Card Skeleton */}
      <Card>
        <CardHeader>
          <div className="h-7 w-1/3 animate-pulse rounded-lg bg-muted"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 pl-5">
            <div className="h-5 w-3/4 animate-pulse rounded-lg bg-muted"></div>
            <div className="h-5 w-2/3 animate-pulse rounded-lg bg-muted"></div>
          </div>
        </CardContent>
      </Card>
    </article>
  );
}
// --- END MODIFIED SKELETON ---

export default function SummarizePage() {
  // 2. GET ARTICLE FROM STORE, NOT URL
  const router = useRouter();
  const article = useArticleStore((state) => state.selectedArticle);
  const articleUrl = article?.url; // Get URL from the stored article

  const [isBookmarked, setIsBookmarked] = useState(false);

  // 3. REDIRECT IF STATE IS EMPTY (e.g., page refresh)
  useEffect(() => {
    if (!article) {
      router.replace("/dashboard");
    }
  }, [article, router]);

  // Record read duration periodically while viewing summary
  const startTimeRef = useRef<number>(Date.now());
  useEffect(() => {
    if (!article?.id) return;
    startTimeRef.current = Date.now();
    
    // Immediate ping
    recordArticleRead(article.id, 1).catch(() => {});
    
    const intervalId = setInterval(() => {
      const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
      if (duration >= 1) {
        recordArticleRead(article.id, duration).catch(() => {});
      }
    }, 5000);

    return () => {
      clearInterval(intervalId);
      const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
      if (duration >= 1) {
        recordArticleRead(article.id, duration).catch(() => {});
      }
    };
  }, [article?.id]);

  const handleBookmarkToggle = async () => {
    if (!article || !article.id) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      
      const method = isBookmarked ? "DELETE" : "POST";
      const url = isBookmarked 
        ? `${process.env.NEXT_PUBLIC_API_URL}/bookmarks/${article.id}` 
        : `${process.env.NEXT_PUBLIC_API_URL}/bookmarks`;
        
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: isBookmarked ? null : JSON.stringify({ article_id: article.id }),
      });
      
      if (response.ok) {
        setIsBookmarked(!isBookmarked);
      }
    } catch (error) {
      console.error("Failed to toggle bookmark", error);
    }
  };

  // 4. Run the summary query
  const { data, isLoading, error } = useQuery({
    queryKey: ["summarize", articleUrl],
    queryFn: () => api.fetchSummary(articleUrl!),
    enabled: !!articleUrl,
  });

  // --- MODIFIED LOADING STATE ---
  // 5. Show loading state *before* checking for article
  // This now includes a loading message, just like your SearchPage example.
  if (isLoading || !article) {
    return (
      <div className="space-y-6">
        <p className="text-center text-muted-foreground text-sm md:text-base">
          Generating summary...
        </p>
        <SummarySkeleton />
      </div>
    );
  }
  // --- END MODIFIED LOADING STATE ---

  if (error) {
    return <p className="text-rose-500">Error: {(error as Error).message}</p>;
  }

  if (!data || data.articles.length === 0) {
    return <p>Could not generate a summary for this article.</p>;
  }

  const summary = data.articles[0];
  const imageUrl =
    article.urlToImage && article.urlToImage.startsWith("http")
      ? article.urlToImage
      : "/placeholder-news.jpg";

  return (
    <article className="mx-auto max-w-4xl space-y-8">
      {/* 6. ADDED ARTICLE DETAILS TO THE SUMMARY PAGE */}
      <div className="flex justify-between items-start gap-4">
        <h1 className="text-3xl md:text-4xl font-extrabold leading-tight">
          {article.title}
        </h1>
        {article.id && (
          <Button
            onClick={handleBookmarkToggle}
            variant="outline"
            size="icon"
            className={`shrink-0 transition-colors ${isBookmarked ? 'bg-primary/10 text-primary border-primary/50' : ''}`}
            title="Bookmark this article"
          >
            <Bookmark className={`h-5 w-5 ${isBookmarked ? 'fill-current' : ''}`} />
          </Button>
        )}
      </div>
      <div className="relative h-64 md:h-96 w-full overflow-hidden rounded-lg">
        <Image
          src={imageUrl}
          alt={article.title}
          layout="fill"
          objectFit="cover"
        />
      </div>

      {/* AI Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl md:text-3xl">
            <FileText className="h-6 w-6" />
            AI-Generated Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <p>{summary.description}</p>
          </div>
        </CardContent>
      </Card>

      {/* Read Full Article Button */}
      <Button asChild size="lg" className="w-full">
        <a href={articleUrl} target="_blank" rel="noopener noreferrer">
          Read Full Original Article <ExternalLink className="ml-2 h-4 w-4" />
        </a>
      </Button>

      {/* Sources Card */}
      {summary.info && summary.info.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <List className="h-5 w-5" />
              Sources Used for Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5">
              {summary.info.map((info) => (
                <li key={info.url}>
                  <a
                    href={info.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline hover:opacity-80"
                  >
                    {info.title}
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </article>
  );
}