export type ReviewSource = 'Google' | 'TripAdvisor' | 'Booking' | 'Expedia';
export type Sentiment = 'positive' | 'neutral' | 'negative';
export type ReviewPriority = 'low' | 'medium' | 'high' | 'critical';
export type ReviewStatus = 'draft' | 'waiting_approval' | 'published';

export interface AIAnalysis {
  sentiment: Sentiment;
  emotion: string;
  keyTopics: string[];
  qualityScore: number;
  sentimentScore: number;
}

export interface Review {
  id: string;
  guestName: string;
  rating: number;
  comment: string;
  date: string;
  source: ReviewSource;
  status: ReviewStatus;
  priority: ReviewPriority;
  response?: string;
  respondedAt?: string;
  sentiment: Sentiment;
  departments: string[];
  aiAnalysis?: AIAnalysis;
  hotel?: string;
  managerNotes?: string;
  internalNotes?: string;
  organizationId?: string;
  hotelId?: string;
  platformReviewId?: string;
}

export interface Department {
  id: string;
  name: string;
  averageRating: number;
  sentimentScore: number; // 0 to 100
  reviewCount: number;
  pendingCount: number;
  headOfDepartment: string;
}

export interface MetricCardData {
  title: string;
  value: string | number;
  change: string;
  changeType: 'increase' | 'decrease' | 'neutral';
}

export interface AnalyticsTrend {
  date: string;
  rating: number;
  count: number;
  positive: number;
  neutral: number;
  negative: number;
}

export interface WhatsAppLog {
  id: string;
  guestName: string;
  phoneNumber: string;
  lastMessage: string;
  timestamp: string;
  status: 'sent' | 'received' | 'failed';
  chatHistory: {
    sender: 'guest' | 'ai' | 'agent';
    text: string;
    time: string;
  }[];
}

export interface AISettings {
  tone: 'professional' | 'warm' | 'formal';
  autoRespond: boolean;
  minRatingAutoRespond: number;
  whatsappAlerts: boolean;
  googleTokenStatus: 'connected' | 'disconnected';
}

export interface AnalyticsData {
  reviewsPerDay: { date: string; count: number }[];
  reviewsByPlatform: { platform: string; count: number }[];
  ratingTrend: { date: string; rating: number }[];
  departmentDistribution: { department: string; count: number }[];
  priorityDistribution: { priority: string; count: number }[];
  sentimentDistribution: { sentiment: string; count: number }[];
}

export interface Task {
  id: string;
  reviewId: string;
  title: string;
  description: string;
  department: string;
  assignedTo: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'waiting' | 'completed';
  createdAt: string;
  hotelId?: string;
  organizationId?: string;
}

export interface AppNotification {
  id: string;
  type: 'new_review' | 'high_risk' | 'task_assigned' | 'task_completed' | 'approval_needed';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  hotelId?: string;
}

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
  logoUrl?: string;
  taxOffice?: string;
  taxNumber?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  country?: string;
  city?: string;
  currency?: string;
  defaultLanguage?: string;
}

export interface Hotel {
  id: string;
  organizationId: string;
  name: string;
  createdAt: string;
  connectionStatus?: 'connected' | 'disconnected'; // UI property for hotel management status
  googleMapsLink?: string;
  googleMapsUrl?: string;
  address?: string;
  phone?: string;
  website?: string;
  city?: string;
  country?: string;
  timezone?: string;
  defaultLanguage?: string;
  googleAccountId?: string;
  googleLocationId?: string;
  googleBusinessName?: string;
  googleBusinessConnected?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  roleId?: string;     // Primary role ID
  roleName?: string;   // Primary role name
  hotelIds?: string[];  // List of hotel IDs the user has access to
  organizationId?: string; // Parent organization assignment
  phone?: string;
  title?: string;
  department?: string;
  avatarUrl?: string;
  language?: string;
  timezone?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
}

export interface IntegrationSetting {
  id: string; // 'google_business' | 'whatsapp' | 'n8n' | 'supabase'
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  updatedAt: string;
}
