"use client";

import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, List, FileText, ArrowLeft, Sparkles } from "lucide-react";
import { useArticleStore } from "@/lib/articleStore";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Image from "next/image";

function SummarySkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      {/* Back button skeleton */}
      <div className="h-9 w-20 animate-shimmer rounded-md" />
      
      {/* Title skeleton */}
      <div className="space-y-3">
        <div className="h-10 w-3/4 animate-shimmer rounded-lg" />
        <div className="h-10 w-full animate-shimmer rounded-lg" />
      </div>

      {/* Image skeleton */}
      <div className="h-64 md:h-96 lg:h-[500px] w-full animate-shimmer rounded-xl" />

      {/* Summary card skeleton */}
      <Card className="animate-shimmer">
        <CardHeader>
          <div className="h-8 w-64 animate-shimmer rounded-lg" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-6 w-full animate-shimmer rounded-lg" />
            <div className="h-6 w-full animate-shimmer rounded-lg" />
            <div className="h-6 w-5/6 animate-shimmer rounded-lg" />
            <div className="h-6 w-4/6 animate-shimmer rounded-lg" />
          </div>
        </CardContent>
      </Card>

      {/* Loading message */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center justify-center gap-3 py-8">
          <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          <p className="text-sm md:text-base text-muted-foreground">
            AI is analyzing the article and generating summary...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SummarizeClientView() {
  const router = useRouter();
  const article = useArticleStore((state) => state.selectedArticle);
  const articleUrl = article?.url;

  useEffect(() => {
    if (!article) {
      router.replace("/dashboard");
    }
  }, [article, router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["summarize", articleUrl],
    queryFn: () => api.fetchSummary(articleUrl!),
    enabled: !!articleUrl,
  });

  if (isLoading || !article) {
    return <SummarySkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <Card className="p-6 md:p-8 max-w-lg w-full text-center border-destructive/50">
          <p className="text-destructive font-medium mb-2 text-sm md:text-base">
            Error generating summary
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            {(error as Error).message}
          </p>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </Card>
      </div>
    );
  }

  if (!data || data.articles.length === 0) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <Card className="p-6 md:p-8 max-w-lg w-full text-center">
          <p className="text-muted-foreground mb-4 text-sm md:text-base">
            Could not generate a summary for this article.
          </p>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </Card>
      </div>
    );
  }

  const summary = data.articles[0];
  const imageUrl =
    article.urlToImage && article.urlToImage.startsWith("http")
      ? article.urlToImage
      : "/placeholder-news.jpg";

  return (
    <article className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => router.back()} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {/* Article Header */}
      <div className="space-y-6">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight">
          {article.title}
        </h1>

        <div className="relative h-64 md:h-96 lg:h-[500px] w-full overflow-hidden rounded-xl border shadow-lg">
          <Image
            src={imageUrl}
            alt={article.title}
            fill
            className="object-cover"
            priority
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.srcset = "";
              target.src = "/placeholder-news.jpg";
            }}
          />
        </div>
      </div>

      {/* AI Summary Card */}
      <Card className="border-primary/20 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl md:text-3xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            AI-Generated Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <p className="text-base md:text-lg leading-relaxed">
              {summary.description}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Read Full Article Button */}
      <Button asChild size="lg" className="w-full gap-2">
        <a href={articleUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-4 w-4" />
          Read Full Original Article
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
            <ul className="space-y-3">
              {summary.info.map((info, index) => (
                <li key={info.url} className="flex items-start gap-2">
                  <span className="text-muted-foreground font-medium shrink-0">
                    {index + 1}.
                  </span>
                  <a
                    href={info.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline hover:opacity-80 transition-opacity wrap-break-word"
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