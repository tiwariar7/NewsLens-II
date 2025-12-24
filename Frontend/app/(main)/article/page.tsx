  "use client";

  import { useArticleStore } from "@/lib/articleStore";
  import { useRouter } from "next/navigation";
  import { useEffect } from "react";
  import Image from "next/image";
  import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
  import { Button } from "@/components/ui/button";
  import { ExternalLink, Sparkles, ArrowLeft } from "lucide-react";

  export default function ArticleDetailsPage() {
    const router = useRouter();
    const article = useArticleStore((state) => state.selectedArticle);

    useEffect(() => {
      if (!article) {
        router.replace("/dashboard");
      }
    }, [article, router]);

    if (!article) {
      return (
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] py-12">
          <p className="text-muted-foreground">Loading article or redirecting...</p>
        </div>
      );
    }

    const imageUrl = article.urlToImage && article.urlToImage.startsWith('http')
      ? article.urlToImage
      : '/placeholder-news.jpg';

    const publishedDate = new Date(article.publishedAt).toLocaleDateString(
      "en-US",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    );

    const handleViewSummary = () => {
      if(article) {
          router.push('/summarize');
      } else {
          router.push('/dashboard');
      }
    };

    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {/* Article Header */}
        <article className="space-y-6">
          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight">
              {article.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="font-medium">{article.source.name}</span>
              <span className="hidden sm:inline">&bull;</span>
              <time dateTime={article.publishedAt}>{publishedDate}</time>
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
                target.srcset = '';
                target.src = '/placeholder-news.jpg';
              }}
            />
          </div>

          {/* Description Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl md:text-2xl">Article Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base md:text-lg leading-relaxed text-foreground/90">
                {article.description || "No description available."}
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
            <Button 
              onClick={handleViewSummary} 
              variant="outline" 
              size="lg" 
              className="flex-1 gap-2"
            >
              <Sparkles className="h-4 w-4" />
              View AI Summary
            </Button>
          </div>
        </article>
      </div>
    );
  }