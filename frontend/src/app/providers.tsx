'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

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

interface InsightRecommendation {
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

const defaultInsights: Insights = {
  total_tasks: 0,
  completed_count: 0,
  uncompleted_count: 0,
  total_uncompleted_hours: 0,
  high_risk_count: 0,
  medium_risk_count: 0,
  first_free_slot: new Date().toISOString(),
  recommendations: [],
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

const buildTaskStorageKey = (userId?: string) => {
  return userId ? `actionpilot_tasks_${userId}` : 'actionpilot_tasks_guest';
};

const loadStoredTaskState = (key: string) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as { tasks: Task[]; insights: Insights };
  } catch {
    localStorage.removeItem(key);
    return null;
  }
};

const persistTaskState = (key: string, tasks: Task[], insights: Insights) => {
  localStorage.setItem(key, JSON.stringify({ tasks, insights }));
};

const calculateLocalInsights = (tasks: Task[]): Insights => {
  const completed = tasks.filter((task) => task.completed).length;
  const uncompleted = tasks.filter((task) => !task.completed);
  const totalUncompletedHours = uncompleted.reduce((total, task) => total + task.available_hours, 0);

  return {
    total_tasks: tasks.length,
    completed_count: completed,
    uncompleted_count: uncompleted.length,
    total_uncompleted_hours: totalUncompletedHours,
    high_risk_count: 0,
    medium_risk_count: 0,
    first_free_slot: new Date().toISOString(),
    recommendations: [],
  };
};

interface TaskContextType {
  tasks: Task[];
  insights: Insights;
  activeTaskId: string | null;
  apiLoading: boolean;
  errorMsg: string | null;
  fetchTasks: () => Promise<void>;
  addTask: (payload: { title: string; description: string; priority: 'low' | 'medium' | 'high'; deadline: string; available_hours: number }) => Promise<void>;
  updateTask: (taskId: string, payload: { title: string; description: string; priority: 'low' | 'medium' | 'high'; deadline: string; available_hours: number }) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  toggleComplete: (task: Task) => Promise<void>;
  recalculateSchedule: (lowFactor: number, mediumFactor: number) => Promise<void>;
  setActiveTaskId: (taskId: string | null) => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

const defaultTaskPayload = {
  title: '',
  description: '',
  priority: 'medium' as 'low' | 'medium' | 'high',
  deadline: new Date().toISOString(),
  available_hours: 1,
};

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const { token, user, mockMode } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [insights, setInsights] = useState<Insights>(defaultInsights);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [apiLoading, setApiLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const storageKey = useMemo(() => buildTaskStorageKey(user?.id), [user]);

  const syncState = useCallback((nextTasks: Task[], nextInsights: Insights) => {
    setTasks(nextTasks);
    setInsights(nextInsights);
    persistTaskState(storageKey, nextTasks, nextInsights);
  }, [storageKey]);

  const loadLocalState = useCallback(() => {
    const stored = loadStoredTaskState(storageKey);
    if (stored) {
      setTasks(stored.tasks);
      setInsights(stored.insights || defaultInsights);
      return true;
    }
    setTasks([]);
    setInsights(defaultInsights);
    return false;
  }, [storageKey]);

  const handleApiError = useCallback((error: unknown, fallback = true) => {
    console.warn(error);
    if (fallback) {
      const loaded = loadLocalState();
      setErrorMsg(loaded ? 'Backend unavailable. Loaded saved local tasks.' : 'Backend unavailable. No saved tasks found.');
    } else {
      setErrorMsg((error as Error)?.message || 'Task operation failed.');
    }
  }, [loadLocalState]);

  const fetchTasks = useCallback(async () => {
    setApiLoading(true);
    setErrorMsg(null);
    if (!user || mockMode || !token) {
      loadLocalState();
      setApiLoading(false);
      return;
    }

    try {
      const localISO = new Date().toISOString();
      const res = await fetch(`${API_BASE_URL}/api/tasks?current_time=${encodeURIComponent(localISO)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to load tasks.');
      const data = await res.json();
      const nextInsights = data.insights || calculateLocalInsights(data.tasks);
      syncState(data.tasks, nextInsights);
    } catch (error) {
      handleApiError(error);
    } finally {
      setApiLoading(false);
    }
  }, [handleApiError, loadLocalState, mockMode, syncState, token, user]);

  const addTask = useCallback(async (payload: { title: string; description: string; priority: 'low' | 'medium' | 'high'; deadline: string; available_hours: number; }) => {
    setErrorMsg(null);
    if (!user || mockMode || !token) {
      const nextTask: Task = {
        id: `local-${Date.now()}`,
        title: payload.title,
        description: payload.description,
        priority: payload.priority,
        deadline: payload.deadline,
        available_hours: payload.available_hours,
        completed: false,
        completed_at: null,
        created_at: new Date().toISOString(),
      };
      setTasks((prev) => {
        const nextTasks = [nextTask, ...prev];
        setInsights(calculateLocalInsights(nextTasks));
        persistTaskState(storageKey, nextTasks, calculateLocalInsights(nextTasks));
        return nextTasks;
      });
      return;
    }

    try {
      const localISO = new Date().toISOString();
      const res = await fetch(`${API_BASE_URL}/api/tasks?current_time=${encodeURIComponent(localISO)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create task.');
      const data = await res.json();
      const nextInsights = data.insights || calculateLocalInsights(data.tasks);
      syncState(data.tasks, nextInsights);
    } catch (error) {
      handleApiError(error, false);
      const nextTask: Task = {
        id: `local-${Date.now()}`,
        title: payload.title,
        description: payload.description,
        priority: payload.priority,
        deadline: payload.deadline,
        available_hours: payload.available_hours,
        completed: false,
        completed_at: null,
        created_at: new Date().toISOString(),
      };
      setTasks((prev) => {
        const nextTasks = [nextTask, ...prev];
        const nextInsights = calculateLocalInsights(nextTasks);
        persistTaskState(storageKey, nextTasks, nextInsights);
        setInsights(nextInsights);
        return nextTasks;
      });
    }
  }, [handleApiError, mockMode, storageKey, syncState, token, user]);

  const updateTask = useCallback(async (taskId: string, payload: { title: string; description: string; priority: 'low' | 'medium' | 'high'; deadline: string; available_hours: number; }) => {
    setErrorMsg(null);
    if (!user || mockMode || !token) {
      setTasks((prev) => {
        const nextTasks = prev.map((task) => task.id === taskId ? { ...task, ...payload } : task);
        const nextInsights = calculateLocalInsights(nextTasks);
        persistTaskState(storageKey, nextTasks, nextInsights);
        setInsights(nextInsights);
        return nextTasks;
      });
      return;
    }

    try {
      const localISO = new Date().toISOString();
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}?current_time=${encodeURIComponent(localISO)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update task.');
      const data = await res.json();
      const nextInsights = data.insights || calculateLocalInsights(data.tasks);
      syncState(data.tasks, nextInsights);
    } catch (error) {
      handleApiError(error, false);
      setTasks((prev) => {
        const nextTasks = prev.map((task) => task.id === taskId ? { ...task, ...payload } : task);
        const nextInsights = calculateLocalInsights(nextTasks);
        persistTaskState(storageKey, nextTasks, nextInsights);
        setInsights(nextInsights);
        return nextTasks;
      });
    }
  }, [handleApiError, mockMode, storageKey, syncState, token, user]);

  const deleteTask = useCallback(async (taskId: string) => {
    setErrorMsg(null);
    if (!user || mockMode || !token) {
      setTasks((prev) => {
        const nextTasks = prev.filter((task) => task.id !== taskId);
        const nextInsights = calculateLocalInsights(nextTasks);
        persistTaskState(storageKey, nextTasks, nextInsights);
        setInsights(nextInsights);
        return nextTasks;
      });
      return;
    }

    try {
      const localISO = new Date().toISOString();
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}?current_time=${encodeURIComponent(localISO)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to delete task.');
      const data = await res.json();
      const nextInsights = data.insights || calculateLocalInsights(data.tasks);
      syncState(data.tasks, nextInsights);
    } catch (error) {
      handleApiError(error, false);
      setTasks((prev) => {
        const nextTasks = prev.filter((task) => task.id !== taskId);
        const nextInsights = calculateLocalInsights(nextTasks);
        persistTaskState(storageKey, nextTasks, nextInsights);
        setInsights(nextInsights);
        return nextTasks;
      });
    }
  }, [handleApiError, mockMode, storageKey, syncState, token, user]);

  const toggleComplete = useCallback(async (task: Task) => {
    setErrorMsg(null);
    const nextCompleted = !task.completed;
    if (!user || mockMode || !token) {
      setTasks((prev) => {
        const nextTasks = prev.map((item) => item.id === task.id ? { ...item, completed: nextCompleted, completed_at: nextCompleted ? new Date().toISOString() : null } : item);
        const nextInsights = calculateLocalInsights(nextTasks);
        persistTaskState(storageKey, nextTasks, nextInsights);
        setInsights(nextInsights);
        return nextTasks;
      });
      return;
    }

    try {
      const localISO = new Date().toISOString();
      const res = await fetch(`${API_BASE_URL}/api/tasks/${task.id}?current_time=${encodeURIComponent(localISO)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ completed: nextCompleted }),
      });
      if (!res.ok) throw new Error('Failed to update task status.');
      const data = await res.json();
      const nextInsights = data.insights || calculateLocalInsights(data.tasks);
      syncState(data.tasks, nextInsights);
    } catch (error) {
      handleApiError(error, false);
      setTasks((prev) => {
        const nextTasks = prev.map((item) => item.id === task.id ? { ...item, completed: nextCompleted, completed_at: nextCompleted ? new Date().toISOString() : null } : item);
        const nextInsights = calculateLocalInsights(nextTasks);
        persistTaskState(storageKey, nextTasks, nextInsights);
        setInsights(nextInsights);
        return nextTasks;
      });
    }
  }, [handleApiError, mockMode, storageKey, syncState, token, user]);

  const recalculateSchedule = useCallback(async (lowFactor: number, mediumFactor: number) => {
    setErrorMsg(null);
    if (!user || mockMode || !token) {
      setErrorMsg('Recalculation requires online backend sync.');
      return;
    }
    try {
      const localISO = new Date().toISOString();
      const res = await fetch(`${API_BASE_URL}/api/tasks/recalculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_time: localISO,
          low_priority_factor: Number(lowFactor),
          medium_priority_factor: Number(mediumFactor),
        }),
      });
      if (!res.ok) throw new Error('Failed to recalculate schedule.');
      const data = await res.json();
      const nextInsights = data.insights || calculateLocalInsights(data.tasks);
      syncState(data.tasks, nextInsights);
    } catch (error) {
      handleApiError(error, false);
    }
  }, [handleApiError, mockMode, syncState, token, user]);

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [fetchTasks, user]);

  return (
    <TaskContext.Provider
      value={{
        tasks,
        insights,
        activeTaskId,
        apiLoading,
        errorMsg,
        fetchTasks,
        addTask,
        updateTask,
        deleteTask,
        toggleComplete,
        recalculateSchedule,
        setActiveTaskId,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Safely initialize Supabase
export const supabase: SupabaseClient | null = 
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

interface CustomUser {
  id: string;
  email: string;
}

interface AuthContextType {
  user: CustomUser | null;
  token: string | null;
  isLoading: boolean;
  mockMode: boolean;
  error: string | null;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  toggleMockMode: (enable: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mockMode, setMockMode] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial session
  useEffect(() => {
    // If Supabase is available, we check if there's a setting in localStorage that forces mock mode
    const storedMock = localStorage.getItem('actionpilot_mock_mode');
    const isMock = storedMock !== 'false' && (!supabase || storedMock === 'true');
    setMockMode(isMock);

    if (isMock) {
      // Mock mode initialization
      const mockSession = localStorage.getItem('actionpilot_mock_session');
      if (mockSession) {
        try {
          const parsed = JSON.parse(mockSession);
          setUser({ id: parsed.id, email: parsed.email });
          setToken(parsed.token);
        } catch {
          localStorage.removeItem('actionpilot_mock_session');
        }
      }
      setIsLoading(false);
    } else if (supabase) {
      // Supabase initialization
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setUser({ id: session.user.id, email: session.user.email || '' });
          setToken(session.access_token);
        }
        setIsLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          setUser({ id: session.user.id, email: session.user.email || '' });
          setToken(session.access_token);
        } else {
          setUser(null);
          setToken(null);
        }
        setIsLoading(false);
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      setIsLoading(false);
    }
  }, []);

  const signInWithEmail = async (email: string, pass: string) => {
    setError(null);
    setIsLoading(true);
    try {
      if (mockMode) {
        // Simulated Login
        const mockId = `mock-${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const session = { id: mockId, email, token: mockId };
        localStorage.setItem('actionpilot_mock_session', JSON.stringify(session));
        setUser({ id: mockId, email });
        setToken(mockId);
      } else if (supabase) {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (err) throw err;
        if (data.session) {
          setUser({ id: data.user.id, email: data.user.email || '' });
          setToken(data.session.access_token);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, pass: string) => {
    setError(null);
    setIsLoading(true);
    try {
      if (mockMode) {
        // Simulated Signup (acts like login)
        const mockId = `mock-${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const session = { id: mockId, email, token: mockId };
        localStorage.setItem('actionpilot_mock_session', JSON.stringify(session));
        setUser({ id: mockId, email });
        setToken(mockId);
      } else if (supabase) {
        const { data, error: err } = await supabase.auth.signUp({ email, password: pass });
        if (err) throw err;
        if (data.user) {
          // Note: depending on Supabase settings, user might need to verify email
          setError("Signup successful! Please check your email for confirmation, or try signing in if verification is disabled.");
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign up.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      if (mockMode) {
        localStorage.removeItem('actionpilot_mock_session');
        setUser(null);
        setToken(null);
      } else if (supabase) {
        await supabase.auth.signOut();
        setUser(null);
        setToken(null);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMockMode = (enable: boolean) => {
    if (enable) {
      localStorage.setItem('actionpilot_mock_mode', 'true');
      setMockMode(true);
      // Log out of supabase if logged in
      if (supabase) {
        supabase.auth.signOut();
      }
      setUser(null);
      setToken(null);
    } else {
      if (!supabase) {
        alert("Cannot disable Mock Mode: Supabase configuration is missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY first.");
        return;
      }
      localStorage.setItem('actionpilot_mock_mode', 'false');
      setMockMode(false);
      localStorage.removeItem('actionpilot_mock_session');
      setUser(null);
      setToken(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        mockMode,
        error,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        toggleMockMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
