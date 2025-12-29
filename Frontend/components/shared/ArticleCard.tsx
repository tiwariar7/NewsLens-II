import Image from "next/image";
import { BackendArticle } from "@/types";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useArticleStore } from "@/lib/articleStore";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { Sparkles, Bookmark, BookmarkCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { ArticleChatModal } from "@/components/shared/ArticleChatModal";
import * as api from "@/lib/api";
import { toast } from "sonner";

interface ArticleCardProps {
  article: BackendArticle;
}

export function ArticleCard({ article }: ArticleCardProps) {
  const router = useRouter();
  const setSelectedArticle = useArticleStore(
    (state) => state.setSelectedArticle
  );
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isBookmarking, setIsBookmarking] = useState(false);
  const [animateBounce, setAnimateBounce] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleBookmarkToggle = async () => {
    if (!article.id || isBookmarking) return;
    
    setIsBookmarking(true);
    setAnimateBounce(true);
    setTimeout(() => setAnimateBounce(false), 500);

    try {
      if (isBookmarked) {
        await api.removeBookmark(article.id);
        setIsBookmarked(false);
        toast("Bookmark removed", {
          description: article.title.slice(0, 60) + (article.title.length > 60 ? "…" : ""),
          icon: "🗑️",
        });
      } else {
        await api.addBookmark(article.id);
        setIsBookmarked(true);
        toast.success("Article bookmarked!", {
          description: article.title.slice(0, 60) + (article.title.length > 60 ? "…" : ""),
          icon: "🔖",
          action: {
            label: "View Bookmarks",
            onClick: () => router.push("/bookmarks"),
          },
        });
      }
    } catch (error) {
      console.error("Failed to toggle bookmark", error);
      toast.error("Failed to bookmark", {
        description: "Something went wrong. Please try again.",
      });
    } finally {
      setIsBookmarking(false);
    }
  };

  const getSubjectivity = (): {
    label: string;
    className: string;
    text: string;
  } => {
    const subjectivity = article.sentiment?.raw_subjectivity;
    if (subjectivity === undefined || subjectivity === null) {
      return { label: "N/A", className: "bg-zinc-500", text: "N/A" };
    }
    if (subjectivity < 0.5) {
      const percentage = ((1 - subjectivity) * 100).toFixed(0);
      return {
        label: "Fact-Based",
        className: "bg-blue-600 hover:bg-blue-700",
        text: `${percentage}% Factual`,
      };
    } else {
      const percentage = (subjectivity * 100).toFixed(0);
      return {
        label: "Opinion-Based",
        className: "bg-amber-600 hover:bg-amber-700",
        text: `${percentage}% Opinion`,
      };
    }
  };

  const sentiment = getSubjectivity();
  const imageUrl =
    article.urlToImage && article.urlToImage.startsWith("http")
      ? article.urlToImage
      : "/placeholder-news.jpg";

  const formattedDate = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  const handleViewSummary = () => {
    setSelectedArticle(article);
    router.push(`/summarize`);
  };

  return (
    <Card className="group flex h-full flex-col overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      {/* Image Section */}
      <div className="relative h-40 sm:h-48 w-full overflow-hidden">
        <Image
          src={imageUrl}
          alt={article.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-110"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.srcset = "";
            target.src = "/placeholder-news.jpg";
          }}
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Title Section - grows to push footer down */}
      <CardHeader className="grow space-y-2 pb-3 flex flex-row items-start justify-between gap-2">
        <CardTitle className="line-clamp-2 text-base sm:text-lg leading-snug transition-colors duration-200 group-hover:text-primary">
          {article.title}
        </CardTitle>
        {article.id && (
          <button
            ref={btnRef}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleBookmarkToggle();
            }}
            disabled={isBookmarking}
            className={cn(
              "relative p-2 -mr-2 -mt-2 rounded-full transition-all duration-300 shrink-0",
              isBookmarked
                ? "bg-primary/10 hover:bg-primary/20 shadow-[0_0_8px_rgba(var(--primary),0.3)]"
                : "hover:bg-muted",
              animateBounce && "animate-bounce",
              isBookmarking && "opacity-60 cursor-wait"
            )}
            title={isBookmarked ? "Remove Bookmark" : "Bookmark Article"}
          >
            {isBookmarked ? (
              <BookmarkCheck className="w-5 h-5 fill-primary text-primary transition-all duration-300 scale-110" />
            ) : (
              <Bookmark className="w-5 h-5 text-muted-foreground transition-all duration-300 hover:scale-110" />
            )}
            {/* Success ring pulse */}
            {animateBounce && isBookmarked && (
              <span className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-40" />
            )}
          </button>
        )}
      </CardHeader>

      {/* Description Section */}
      <CardContent className="pb-3 pt-0">
        <p className="line-clamp-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {article.description || "No description available."}
        </p>
      </CardContent>

      {/* Source and Sentiment Badge - at bottom */}
      <CardFooter className="flex justify-between items-center border-t pt-3 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 min-w-0 pr-2">
          <span
            className="truncate font-medium text-muted-foreground text-xs"
            title={article.source?.name || "Unknown Source"}
          >
            {article.source?.name || "Unknown Source"}
          </span>
          {formattedDate && (
            <span className="text-muted-foreground text-xs shrink-0">
              {formattedDate}
            </span>
          )}
        </div>

        <Badge
          title={sentiment.label}
          className={`shrink-0 border-none text-white shadow-sm text-xs ${sentiment.className}`}
        >
          {sentiment.text}
        </Badge>
      </CardFooter>

      {/* Action Buttons - Always Side by Side */}
      <CardFooter className="flex flex-row justify-between items-stretch gap-2 border-t pt-3">
        <Button
          onClick={handleViewSummary}
          variant="outline"
          size="sm"
          className="flex-1 transition-all hover:scale-105 text-xs sm:text-sm"
        >
          Summary
        </Button>

        <Button
          onClick={() => setIsChatOpen(true)}
          variant="secondary"
          size="sm"
          className="flex-1 transition-all hover:scale-105 text-xs sm:text-sm text-primary gap-1 border border-primary/20 bg-primary/10 hover:bg-primary/20 px-0"
        >
          <Sparkles className="w-3 h-3" />
          Ask AI
        </Button>

        <Button
          asChild
          size="sm"
          className="flex-1 transition-all hover:scale-105 text-xs sm:text-sm px-0"
        >
          <a href={article.url} target="_blank" rel="noopener noreferrer">
            Read Full
          </a>
        </Button>
      </CardFooter>
      <ArticleChatModal 
        article={article} 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
      />
    </Card>
  );
}