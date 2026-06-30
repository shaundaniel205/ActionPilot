'use client';

import { create } from 'zustand';
import { Task, Insights } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

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

const normalizeDate = (value: string) => new Date(value).toISOString();
const isValidDate = (value: string) => !Number.isNaN(Date.parse(value));

const calculateRisk = (task: Task) => {
  const deadline = new Date(task.deadline);
  const hoursUntilDeadline = Math.max((deadline.getTime() - Date.now()) / 1000 / 3600, 0.001);
  const estimatedHoursRemaining = task.completed ? 0 : task.available_hours;
  const score = estimatedHoursRemaining / hoursUntilDeadline;
  if (score >= 1.2) return 'high' as const;
  if (score >= 0.8) return 'medium' as const;
  return 'low' as const;
};

const createInsights = (tasks: Task[]): Insights => {
  const uncompletedTasks = tasks.filter((task) => !task.completed);
  const highRiskCount = uncompletedTasks.filter((task) => task.deadline_risk === 'high').length;
  const mediumRiskCount = uncompletedTasks.filter((task) => task.deadline_risk === 'medium').length;
  const totalHours = uncompletedTasks.reduce((sum, task) => sum + task.available_hours, 0);
  const overdueTask = uncompletedTasks.find((task) => new Date(task.deadline).getTime() < Date.now());
  const recommendations = [] as Insights['recommendations'];

  if (highRiskCount > 0) {
    recommendations.push({
      type: 'danger',
      title: 'Deadline risk is high',
      message: `You have ${highRiskCount} task${highRiskCount > 1 ? 's' : ''} that may miss the deadline. Optimize or reschedule them.`,
    });
  } else if (mediumRiskCount > 0) {
    recommendations.push({
      type: 'warning',
      title: 'Medium risk tasks found',
      message: `Some tasks are approaching their deadline ratio. Consider trimming hours for one task.`,
    });
  } else {
    recommendations.push({
      type: 'success',
      title: 'Schedule looks healthy',
      message: 'Your current uncompleted tasks are in a safe deadline window.',
    });
  }

  if (overdueTask) {
    recommendations.unshift({
      type: 'danger',
      title: 'Overdue task detected',
      message: `Task "${overdueTask.title}" is past its deadline and needs immediate attention.`,
    });
  }

  return {
    total_tasks: tasks.length,
    completed_count: tasks.filter((task) => task.completed).length,
    uncompleted_count: uncompletedTasks.length,
    total_uncompleted_hours: totalHours,
    high_risk_count: highRiskCount,
    medium_risk_count: mediumRiskCount,
    first_free_slot: new Date().toISOString(),
    recommendations,
  };
};

const storageKeyFor = (userId?: string) => {
  return userId ? `actionpilot_tasks_${userId}` : 'actionpilot_tasks_guest';
};

const loadLocalState = (key: string) => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { tasks: Task[]; insights: Insights };
    return parsed;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
};

const saveLocalState = (key: string, tasks: Task[], insights: Insights) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify({ tasks, insights }));
};

interface TaskStoreState {
  tasks: Task[];
  insights: Insights;
  activeTaskId: string | null;
  isOfflineMode: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  storageKey: string;
  setStorageKey: (userId?: string) => void;
  setActiveTaskId: (id: string | null) => void;
  setLoading: (value: boolean) => void;
  setErrorMessage: (message: string | null) => void;
  fetchTasks: (token: string | null, mockMode: boolean) => Promise<void>;
  addTask: (task: Omit<Task, 'id' | 'completed' | 'completed_at' | 'created_at' | 'deadline_risk'>, token: string | null, mockMode: boolean) => Promise<void>;
  updateTask: (taskId: string, payload: Partial<Omit<Task, 'id' | 'created_at' | 'completed' | 'completed_at' | 'deadline_risk'>>, token: string | null, mockMode: boolean) => Promise<void>;
  deleteTask: (taskId: string, token: string | null, mockMode: boolean) => Promise<void>;
  toggleComplete: (taskId: string, token: string | null, mockMode: boolean) => Promise<void>;
  recalculateSchedule: (lowFactor: number, mediumFactor: number, token: string | null, mockMode: boolean) => Promise<void>;
  optimizeTask: (taskId: string, token: string | null, mockMode: boolean) => Promise<void>;
}

export const useTaskStore = create<TaskStoreState>((set, get) => ({
  tasks: [],
  insights: defaultInsights,
  activeTaskId: null,
  isOfflineMode: false,
  isLoading: false,
  errorMessage: null,
  storageKey: storageKeyFor(undefined),

  setStorageKey: (userId?: string) => {
    const key = storageKeyFor(userId);
    const stored = loadLocalState(key);
    if (stored) {
      set({ storageKey: key, tasks: stored.tasks, insights: stored.insights, isOfflineMode: true });
    } else {
      set({ storageKey: key, tasks: [], insights: defaultInsights, isOfflineMode: true });
    }
  },

  setActiveTaskId: (id) => set({ activeTaskId: id }),
  setLoading: (value) => set({ isLoading: value }),
  setErrorMessage: (message) => set({ errorMessage: message }),

  fetchTasks: async (token, mockMode) => {
    const { storageKey } = get();
    set({ isLoading: true, errorMessage: null });
    if (!token || mockMode) {
      const stored = loadLocalState(storageKey);
      if (stored) {
        set({ tasks: stored.tasks, insights: stored.insights, isOfflineMode: true, isLoading: false, errorMessage: 'Local Sandbox Mode enabled.' });
      } else {
        set({ isLoading: false, errorMessage: 'Local Sandbox Mode enabled.' });
      }
      return;
    }

    try {
      const localISO = new Date().toISOString();
      const res = await fetch(`${API_BASE_URL}/api/tasks?current_time=${encodeURIComponent(localISO)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load tasks');
      const data = await res.json();
      const tasksWithRisk = (data.tasks as Task[]).map((task) => ({
        ...task,
        deadline: normalizeDate(task.deadline),
        deadline_risk: calculateRisk({ ...task, deadline: normalizeDate(task.deadline), completed: task.completed, available_hours: task.available_hours, description: task.description, title: task.title, id: task.id, completed_at: task.completed_at, created_at: task.created_at }),
      }));
      const insights = createInsights(tasksWithRisk);
      set({ tasks: tasksWithRisk, insights, isOfflineMode: false });
      saveLocalState(storageKey, tasksWithRisk, insights);
    } catch {
      const stored = loadLocalState(storageKey);
      if (stored) {
        set({ tasks: stored.tasks, insights: stored.insights, isOfflineMode: true });
      } else {
        set({ isOfflineMode: true });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  addTask: async (taskPayload, token, mockMode) => {
    const { storageKey } = get();
    if (!isValidDate(taskPayload.deadline)) {
      set({ errorMessage: 'Invalid task deadline detected.' });
      return;
    }
    const localTask: Task = {
      id: `local-${Date.now()}`,
      title: taskPayload.title,
      description: taskPayload.description,
      priority: taskPayload.priority,
      deadline: normalizeDate(taskPayload.deadline),
      available_hours: taskPayload.available_hours,
      completed: false,
      completed_at: null,
      created_at: new Date().toISOString(),
    };

    if (!token || mockMode) {
      const tasks = [ { ...localTask, deadline_risk: calculateRisk(localTask) }, ...get().tasks ];
      const insights = createInsights(tasks);
      set({ tasks, insights, isOfflineMode: true });
      saveLocalState(storageKey, tasks, insights);
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
        body: JSON.stringify(taskPayload),
      });
      if (!res.ok) throw new Error('Failed to create task');
      const data = await res.json();
      const tasks = (data.tasks as Task[]).map((task) => ({
        ...task,
        deadline: normalizeDate(task.deadline),
        deadline_risk: calculateRisk(task),
      }));
      const insights = createInsights(tasks);
      set({ tasks, insights, isOfflineMode: false });
      saveLocalState(storageKey, tasks, insights);
    } catch {
      set({ errorMessage: 'Unable to sync task. Working offline.' });
      const tasks = [ { ...localTask, deadline_risk: calculateRisk(localTask) }, ...get().tasks ];
      const insights = createInsights(tasks);
      set({ tasks, insights, isOfflineMode: true });
      saveLocalState(storageKey, tasks, insights);
    }
  },

  updateTask: async (taskId, payload, token, mockMode) => {
    const { storageKey } = get();
    if (payload.deadline && !isValidDate(payload.deadline)) {
      set({ errorMessage: 'Invalid updated deadline provided.' });
      return;
    }
    const applyLocal = (tasks: Task[]) => {
      const next = tasks.map((task) => task.id === taskId ? {
        ...task,
        ...payload,
        deadline: payload.deadline ? normalizeDate(payload.deadline) : task.deadline,
      } : task);
      const updated = next.map((task) => ({ ...task, deadline_risk: calculateRisk(task) }));
      const insights = createInsights(updated);
      set({ tasks: updated, insights, isOfflineMode: true });
      saveLocalState(storageKey, updated, insights);
    };

    if (!token || mockMode) {
      applyLocal(get().tasks);
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
      if (!res.ok) throw new Error('Failed to update task');
      const data = await res.json();
      const tasks = (data.tasks as Task[]).map((task) => ({
        ...task,
        deadline: normalizeDate(task.deadline),
        deadline_risk: calculateRisk(task),
      }));
      const insights = createInsights(tasks);
      set({ tasks, insights, isOfflineMode: false });
      saveLocalState(storageKey, tasks, insights);
    } catch {
      applyLocal(get().tasks);
    }
  },

  deleteTask: async (taskId, token, mockMode) => {
    const { storageKey } = get();
    const applyLocal = (tasks: Task[]) => {
      const next = tasks.filter((task) => task.id !== taskId);
      const insights = createInsights(next);
      set({ tasks: next, insights, isOfflineMode: true });
      saveLocalState(storageKey, next, insights);
    };

    if (!token || mockMode) {
      applyLocal(get().tasks);
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
      if (!res.ok) throw new Error('Failed to delete task');
      const data = await res.json();
      const tasks = (data.tasks as Task[]).map((task) => ({
        ...task,
        deadline: normalizeDate(task.deadline),
        deadline_risk: calculateRisk(task),
      }));
      const insights = createInsights(tasks);
      set({ tasks, insights, isOfflineMode: false });
      saveLocalState(storageKey, tasks, insights);
    } catch {
      applyLocal(get().tasks);
    }
  },

  toggleComplete: async (taskId, token, mockMode) => {
    const { storageKey } = get();
    const current = get().tasks.find((task) => task.id === taskId);
    if (!current) return;
    const nextCompleted = !current.completed;
    const applyLocal = (tasks: Task[]) => {
      const updated = tasks.map((task) => task.id === taskId ? {
        ...task,
        completed: nextCompleted,
        completed_at: nextCompleted ? new Date().toISOString() : null,
        deadline_risk: calculateRisk({ ...task, completed: nextCompleted }),
      } : task);
      const insights = createInsights(updated);
      set({ tasks: updated, insights, isOfflineMode: true });
      saveLocalState(storageKey, updated, insights);
    };

    if (!token || mockMode) {
      applyLocal(get().tasks);
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
        body: JSON.stringify({ completed: nextCompleted }),
      });
      if (!res.ok) throw new Error('Failed to change task status');
      const data = await res.json();
      const tasks = (data.tasks as Task[]).map((task) => ({
        ...task,
        deadline: normalizeDate(task.deadline),
        deadline_risk: calculateRisk(task),
      }));
      const insights = createInsights(tasks);
      set({ tasks, insights, isOfflineMode: false });
      saveLocalState(storageKey, tasks, insights);
    } catch {
      applyLocal(get().tasks);
    }
  },

  recalculateSchedule: async (lowFactor, mediumFactor, token, mockMode) => {
    const { storageKey } = get();
    if (!token || mockMode) {
      set({ isOfflineMode: true });
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
      if (!res.ok) throw new Error('Failed to recalculate schedule');
      const data = await res.json();
      const tasks = (data.tasks as Task[]).map((task) => ({
        ...task,
        deadline: normalizeDate(task.deadline),
        deadline_risk: calculateRisk(task),
      }));
      const insights = createInsights(tasks);
      set({ tasks, insights, isOfflineMode: false });
      saveLocalState(storageKey, tasks, insights);
    } catch {
      set({ isOfflineMode: true, errorMessage: 'Recalculation unavailable. Local mode active.' });
    }
  },

  optimizeTask: async (taskId, token, mockMode) => {
    const current = get().tasks.find((task) => task.id === taskId);
    if (!current) return;
    const optimizedHours = Math.max(0.5, Math.round(current.available_hours * 0.8 * 10) / 10);
    await get().updateTask(taskId, { available_hours: optimizedHours }, token, mockMode);
  },
}));
