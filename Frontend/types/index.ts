// types/index.ts

// The user object returned from your /login endpoint
export interface BackendUser {
  name: string;
  email: string;
  preferred_domains: string[];
  country?: string;
  language?: string;
  news_scope?: string;
}

// The response from your /login endpoint
export interface LoginResponse {
  token: string;
  user: BackendUser;
}

// A standard API error from your Flask app
export interface ApiError {
  error: string;
  details?: string;
}

// Named entity extracted by spaCy
export interface NamedEntity {
  text: string;
  label: string; // e.g. PERSON, ORG, GPE, MONEY, DATE
  start: number;
  end: number;
}

// The article object from your /news and /search endpoints
export interface BackendArticle {
  id: number;
  title: string;
  source: {
    id: string | null;
    name: string;
  };
  url: string;
  urlToImage: string | null;
  publishedAt: string; // ISO string
  description: string;
  content: string | null;
  sentiment: {
    raw_polarity: number;
    raw_subjectivity: number;
  } | null;
  category?: string | null;
  entities?: Record<string, NamedEntity[]> | null;
  grouped_sources?: { title: string; source: string; url: string }[];
}

// The response from your /news and /search endpoints
export interface NewsApiResponse {
  articles: BackendArticle[];
  totalResults: number;
  page: number;
  status?: string;
  task_id?: string;
  message?: string;
}

// The response from your /summarize endpoint
export interface SummarizeInfo {
  title: string;
  url: string;
}

export interface SummaryArticle {
  title: "Summary";
  description: string;
  info: SummarizeInfo[];
}

export interface SummarizeResponse {
  articles: SummaryArticle[];
}

// ==================== ANALYTICS TYPES ====================

export interface WeeklyReadingDay {
  day: string;
  minutes: number;
}

export interface CategoryStat {
  name: string;
  value: number;
}

export interface SentimentStat {
  label: string;
  value: number;
}

export interface AnalyticsResponse {
  weekly_reading_time: WeeklyReadingDay[];
  top_categories: CategoryStat[];
  sentiment_bias: SentimentStat[];
  total_articles_read: number;
}