import { API_BASE_URL } from "./config";
import { useAuthStore } from "./authStore";
import { 
  LoginResponse, 
  ApiError, 
  NewsApiResponse,
  SummarizeResponse,
  AnalyticsResponse,
} from "@/types";

async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const { token } = useAuthStore.getState();

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  if (!response.ok) {
    const errorData: ApiError = await response.json();
    throw new Error(errorData.error || 'An unknown error occurred');
  }

  return response.json();
}

// ==================== AUTH API ====================

export const loginUser = (email: string, password: string): Promise<LoginResponse> => {
  return apiFetch('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
};

export const signupUser = (name: string, email: string, password: string, location: string, country: string = 'us', language: string = 'en'): Promise<{ message: string, redirect: string }> => {
  return apiFetch('/signup', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, location, country, language }),
  });
};

// ==================== PREFERENCES API ====================

export const getPreferences = (email: string): Promise<{ preferred_domains: string[], country: string, language: string, news_scope: string }> => {
  return apiFetch('/get_preferences', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
};

export const updatePreferences = (email: string, preferred_domains: string[], country: string = 'us', language: string = 'en', news_scope: string = 'GLOBAL'): Promise<{ message: string }> => {
  return apiFetch('/update_preferences', {
    method: 'POST',
    body: JSON.stringify({ email, preferred_domains, country, language, news_scope }),
  });
};

// ==================== NEWS API ====================

export const fetchNews = (email: string, category: string | null, page: number): Promise<NewsApiResponse> => {
  return apiFetch('/news', {
    method: 'POST',
    body: JSON.stringify({ email, category, page }),
  });
};

export const fetchTopHeadlines = (page: number): Promise<NewsApiResponse> => {
  return apiFetch('/top-headlines', {
    method: 'POST',
    body: JSON.stringify({ page }),
  });
};

export const searchNews = (query: string, page: number): Promise<NewsApiResponse> => {
  return apiFetch('/search', {
    method: 'POST',
    body: JSON.stringify({ query, page }),
  });
};

// ==================== SUMMARIZE API ====================

export const fetchSummary = (article_url: string): Promise<SummarizeResponse> => {
  return apiFetch('/summarize', {
    method: 'POST',
    body: JSON.stringify({ article_url }),
  });
};

// ==================== BOOKMARKS API ====================

export const fetchBookmarks = (page: number): Promise<NewsApiResponse> => {
  return apiFetch(`/bookmarks?page=${page}`, {
    method: 'GET',
  });
};

export const addBookmark = (article_id: number): Promise<{ message: string }> => {
  return apiFetch('/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ article_id }),
  });
};

export const removeBookmark = (article_id: number): Promise<{ message: string }> => {
  return apiFetch(`/bookmarks/${article_id}`, {
    method: 'DELETE',
  });
};

// ==================== ANALYTICS API ====================

export const recordArticleRead = (article_id: number, duration_seconds: number): Promise<{ message: string }> => {
  return apiFetch('/record-read', {
    method: 'POST',
    body: JSON.stringify({ article_id, duration_seconds }),
  });
};

export const fetchAnalytics = (): Promise<AnalyticsResponse> => {
  return apiFetch('/analytics', { method: 'GET' });
};