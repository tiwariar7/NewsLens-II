"use client";

import { useArticleStore } from "@/lib/articleStore";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Sparkles, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { recordArticleRead } from "@/lib/api";

// ─── Entity Highlight Config ──────────────────────────────────────────────────

const ENTITY_STYLES: Record<string, { bg: string; border: string; label: string }> = {
  PERSON:  { bg: "bg-emerald-100 dark:bg-emerald-900/40",  border: "border-emerald-400", label: "Person"  },
  ORG:     { bg: "bg-sky-100 dark:bg-sky-900/40",          border: "border-sky-400",     label: "Org"     },
  GPE:     { bg: "bg-amber-100 dark:bg-amber-900/40",      border: "border-amber-400",   label: "Place"   },
  MONEY:   { bg: "bg-lime-100 dark:bg-lime-900/40",        border: "border-lime-400",    label: "Money"   },
  DATE:    { bg: "bg-violet-100 dark:bg-violet-900/40",    border: "border-violet-400",  label: "Date"    },
  PRODUCT: { bg: "bg-rose-100 dark:bg-rose-900/40",        border: "border-rose-400",    label: "Product" },
};

interface FlatEntity { text: string; label: string; }

function buildEntityMap(entities: Record<string, any[]> | null | undefined): FlatEntity[] {
  if (!entities) return [];
  const flat: FlatEntity[] = [];
  for (const [label, list] of Object.entries(entities)) {
    for (const e of list) {
      const text = typeof e === "string" ? e : e?.text ?? "";
      if (text) flat.push({ text, label });
    }
  }
  return flat.sort((a, b) => b.text.length - a.text.length); // longest first → greedy match
}

function highlightEntities(content: string, entities: FlatEntity[]): React.ReactNode[] {
  if (!entities.length) return [content];
  const escaped = entities.map(e => e.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  return content.split(regex).map((part, i) => {
    const entity = entities.find(e => e.text.toLowerCase() === part.toLowerCase());
    if (entity) {
      const style = ENTITY_STYLES[entity.label] ?? ENTITY_STYLES.PERSON;
      return (
        <span
          key={i}
          className={`relative inline-flex items-center rounded px-0.5 border ${style.bg} ${style.border} cursor-help group`}
          title={style.label}
        >
          {part}
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex
            items-center whitespace-nowrap rounded-md bg-popover border text-popover-foreground
            text-[10px] font-semibold px-2 py-1 shadow-lg z-50 pointer-events-none">
            {style.label}
          </span>
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ArticleDetailsPage() {
  const router = useRouter();
  const article = useArticleStore((state) => state.selectedArticle);
  const [highlightEnabled, setHighlightEnabled] = useState(false);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!article) router.replace("/dashboard");
  }, [article, router]);

  // Record read duration periodically (every 5 seconds)
  useEffect(() => {
    if (!article?.id) return;
    startTimeRef.current = Date.now();
    
    const intervalId = setInterval(() => {
      const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
      if (duration >= 3) {
        recordArticleRead(article.id, duration).catch(() => {});
      }
    }, 5000);

    return () => {
      clearInterval(intervalId);
      const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
      if (duration >= 3) {
        recordArticleRead(article.id, duration).catch(() => {});
      }
    };
  }, [article?.id]);

  if (!article) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] py-12">
        <p className="text-muted-foreground">Loading article or redirecting...</p>
      </div>
    );
  }

  const imageUrl =
    article.urlToImage && article.urlToImage.startsWith("http")
      ? article.urlToImage
      : "/placeholder-news.jpg";

  const publishedDate = new Date(article.publishedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handleViewSummary = () => {
    router.push(article ? "/summarize" : "/dashboard");
  };

  const flatEntities = buildEntityMap(article.entities);
  const hasEntities = flatEntities.length > 0;
  const contentText = article.content ?? article.description ?? "No content available.";
  const renderedContent = highlightEnabled && hasEntities
    ? highlightEntities(contentText, flatEntities)
    : contentText;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Button variant="ghost" onClick={() => router.back()} className="mb-6 gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <article className="space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight">
            {article.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="font-medium">{article.source.name}</span>
            <span className="hidden sm:inline">&bull;</span>
            <time dateTime={article.publishedAt}>{publishedDate}</time>
            {article.category && (
              <Badge variant="secondary" className="capitalize">{article.category}</Badge>
            )}
          </div>
        </div>

        {/* Featured Image */}
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

        {/* Content Card with NER Toggle */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-xl md:text-2xl">Article Overview</CardTitle>
            {hasEntities && (
              <Button
                variant={highlightEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => setHighlightEnabled(!highlightEnabled)}
                className="gap-1.5 shrink-0"
                id="ner-toggle"
              >
                {highlightEnabled ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {highlightEnabled ? "Hide" : "Highlight"} Entities
              </Button>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Legend */}
            {highlightEnabled && hasEntities && (
              <div className="flex flex-wrap gap-2 pb-3 border-b">
                {Object.entries(ENTITY_STYLES).map(([label, style]) => {
                  if (!flatEntities.some(e => e.label === label)) return null;
                  return (
                    <span
                      key={label}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${style.bg} ${style.border}`}
                    >
                      {style.label}
                    </span>
                  );
                })}
              </div>
            )}
            <p className="text-base md:text-lg leading-relaxed text-foreground/90 whitespace-pre-line">
              {renderedContent}
            </p>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button asChild size="lg" className="flex-1 gap-2">
            <a href={article.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Read Full Article
            </a>
          </Button>
          <Button onClick={handleViewSummary} variant="outline" size="lg" className="flex-1 gap-2">
            <Sparkles className="h-4 w-4" />
            View AI Summary
          </Button>
        </div>
      </article>
    </div>
  );
}