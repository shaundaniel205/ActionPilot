'use client';

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  deadline: string;
  available_hours: number;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  scheduled_start?: string;
  scheduled_end?: string;
  deadline_risk?: 'low' | 'medium' | 'high';
}

export interface InsightRecommendation {
  type: 'danger' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
}

export interface Insights {
  total_tasks: number;
  completed_count: number;
  uncompleted_count: number;
  total_uncompleted_hours: number;
  high_risk_count: number;
  medium_risk_count: number;
  first_free_slot: string;
  recommendations: InsightRecommendation[];
}
