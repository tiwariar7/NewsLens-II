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

// The article object from your /news and /search endpoints
export interface BackendArticle {
  id?: number;
  title: string;
  source: {
    id: string | null;
    name: string;
  };
  url: string;
  urlToImage: string | null;
  publishedAt: string; // ISO string
  description: string;
  content: string | null; // This is your scraped content
  sentiment: {
    raw_polarity: number;
    raw_subjectivity: number;
  } | null;
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
  description: string; // The summary text
  info: SummarizeInfo[];
}

export interface SummarizeResponse {
  articles: SummaryArticle[];
}