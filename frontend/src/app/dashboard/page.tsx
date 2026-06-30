'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers';
import { useTaskStore } from '../taskStore';
import { RiskBadge } from '../../components/RiskBadge';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  LogOut, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  Flame, 
  TrendingUp, 
  Database,
  CalendarDays,
  ListTodo,
  Layers,
  ArrowRight,
  Loader2,
  Sparkles,
  X,
  Menu
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import confetti from 'canvas-confetti';

import type { Task, Insights } from '../../app/types';

export default function Dashboard() {
  const { user, token, mockMode, signOut, toggleMockMode, isLoading } = useAuth();
  const {
    tasks,
    insights,
    activeTaskId,
    isOfflineMode,
    isLoading: taskLoading,
    fetchTasks,
    addTask,
    updateTask,
    deleteTask,
    toggleComplete,
    recalculateSchedule,
    optimizeTask,
    setActiveTaskId,
    setStorageKey,
  } = useTaskStore();
  const router = useRouter();

  // UI state
  const [activeTab, setActiveTab] = useState<'pending' | 'completed' | 'all'>('pending');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBehindModal, setShowBehindModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [formDeadline, setFormDeadline] = useState('');
  const [formHours, setFormHours] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);

  // Behind config state
  const [lowFactor, setLowFactor] = useState(0.70);
  const [medFactor, setMedFactor] = useState(0.85);

  // Sidebar & Canvas layout states
  const [sidebarTab, setSidebarTab] = useState<'dashboard' | 'calendar' | 'insights' | 'settings'>('dashboard');
  const [canvasTab, setCanvasTab] = useState<'timeline' | 'tasks'>('timeline');
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;
    setStorageKey(user.id);
    fetchTasks(token, mockMode);
  }, [user, token, mockMode, fetchTasks, setStorageKey]);


  const parseDeadlineInput = (value: string): string | null => {
    const cleaned = value.trim();
    if (!cleaned) return null;

    const normalizeParts = (year: string, month: string, day: string, hour = '09', minute = '00') => {
      const iso = `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00.000Z`;
      const parsed = new Date(iso);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    };

    const mmddyyyy = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
    if (mmddyyyy) {
      return normalizeParts(mmddyyyy[3], mmddyyyy[1], mmddyyyy[2], mmddyyyy[4] || '09', mmddyyyy[5] || '00');
    }

    const yyyymmdd = cleaned.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/);
    if (yyyymmdd) {
      return normalizeParts(yyyymmdd[1], yyyymmdd[2], yyyymmdd[3], yyyymmdd[4] || '09', yyyymmdd[5] || '00');
    }

    const direct = new Date(cleaned);
    if (!Number.isNaN(direct.getTime())) {
      return direct.toISOString();
    }

    return null;
  };

  const formatDeadlineForInput = (deadline: string) => {
    const date = new Date(deadline);
    if (Number.isNaN(date.getTime())) return '';
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${mm}/${dd}/${yyyy} ${hh}:${min}`;
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formTitle.trim() || !formDeadline.trim()) {
      setFormError('Title and deadline are required.');
      return;
    }

    const normalizedDeadline = parseDeadlineInput(formDeadline);
    if (!normalizedDeadline) {
      setFormError('Enter a valid deadline like MM/DD/YYYY or MM/DD/YYYY HH:MM.');
      return;
    }

    try {
      await addTask({
        title: formTitle,
        description: formDescription,
        priority: formPriority,
        deadline: normalizedDeadline,
        available_hours: Number(formHours),
      }, token, mockMode);
      setShowAddModal(false);
      setFormTitle('');
      setFormDescription('');
      setFormPriority('medium');
      setFormDeadline('');
      setFormHours(1);
      setFormError(null);
    } catch {
      // Error handled by TaskProvider
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedTask || !formTitle.trim() || !formDeadline.trim()) {
      setFormError('Title and deadline are required.');
      return;
    }

    const normalizedDeadline = parseDeadlineInput(formDeadline);
    if (!normalizedDeadline) {
      setFormError('Enter a valid deadline like MM/DD/YYYY or MM/DD/YYYY HH:MM.');
      return;
    }

    try {
      await updateTask(selectedTask.id, {
        title: formTitle,
        description: formDescription,
        priority: formPriority,
        deadline: normalizedDeadline,
        available_hours: Number(formHours),
      }, token, mockMode);
      setShowEditModal(false);
      setSelectedTask(null);
      setFormError(null);
    } catch {
      // Error handled by TaskProvider
    }
  };

  const handleToggleComplete = async (task: Task) => {
    const nextCompleted = !task.completed;
    if (nextCompleted) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    try {
      await toggleComplete(task.id, token, mockMode);
    } catch {
      // Error handled by TaskProvider
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await deleteTask(taskId, token, mockMode);
    } catch {
      // Error handled by TaskProvider
    }
  };

  const handleBehindCompression = async () => {
    try {
      await recalculateSchedule(lowFactor, medFactor, token, mockMode);
      setShowBehindModal(false);

      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });
    } catch {
      // Error handled by TaskProvider
    }
  };

  const openAddModal = () => {
    setFormTitle('');
    setFormDescription('');
    setFormPriority('medium');
    setFormDeadline('');
    setFormHours(1);
    setFormError(null);
    setShowAddModal(true);
  };

  const openEditModal = (task: Task) => {
    setSelectedTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description || '');
    setFormPriority(task.priority);
    setFormDeadline(formatDeadlineForInput(task.deadline));
    setFormHours(task.available_hours);
    setFormError(null);
    setShowEditModal(true);
  };

  // Helper date formatter
  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  const formatTimeOnly = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  // Filter tasks based on activeTab
  const filteredTasks = tasks.filter(t => {
    if (activeTab === 'pending') return !t.completed;
    if (activeTab === 'completed') return t.completed;
    return true;
  });

  // Calculate stats for charts
  const priorityHoursData = [
    { name: 'High', value: tasks.filter(t => !t.completed && t.priority === 'high').reduce((a, b) => a + b.available_hours, 0) },
    { name: 'Medium', value: tasks.filter(t => !t.completed && t.priority === 'medium').reduce((a, b) => a + b.available_hours, 0) },
    { name: 'Low', value: tasks.filter(t => !t.completed && t.priority === 'low').reduce((a, b) => a + b.available_hours, 0) },
  ].filter(d => d.value > 0);

  const PRIORITY_COLORS = {
    High: '#f87171',   // Red-400
    Medium: '#fbbf24', // Amber-400
    Low: '#34d399',    // Emerald-400
  };

  const renderTimelineTab = () => {
    const scheduledTasks = tasks.filter(t => !t.completed && t.scheduled_start && t.scheduled_end);

    if (scheduledTasks.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-900/10 border border-slate-900 rounded-2xl p-8">
          <CalendarDays className="w-12 h-12 text-slate-700 mb-3" />
          <p className="font-semibold text-sm text-slate-400">No scheduled tasks on the timeline.</p>
          <p className="text-xs text-slate-500 mt-1 max-w-[280px]">
            Create a pending task with duration to populate your 9-to-5 schedule timeline.
          </p>
          <button
            onClick={openAddModal}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold rounded-lg transition"
          >
            <Plus className="w-3.5 h-3.5" /> Create Your First Task
          </button>
        </div>
      );
    }

    return (
      <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-slate-350 uppercase tracking-wider mb-6 flex items-center gap-1.5">
          <CalendarDays className="w-4 h-4 text-violet-400" /> Chronological Timeline
        </h3>

        <div className="relative border-l-2 border-slate-800 pl-6 ml-3 space-y-6 pt-2">
          {scheduledTasks.map((task, idx) => {
            const isHighRisk = task.deadline_risk === 'high';
            const isMedRisk = task.deadline_risk === 'medium';
            return (
              <div key={task.id} className="relative group bg-slate-900/40 border border-slate-900 hover:border-slate-800 rounded-xl p-4 transition-all duration-200">
                {/* Bullet indicator */}
                <div className={`absolute left-[-33px] top-6 w-3 h-3 rounded-full border-2 ${
                  isHighRisk 
                    ? 'bg-rose-500 border-slate-950 ring-4 ring-rose-950/40 animate-pulse' 
                    : isMedRisk
                    ? 'bg-amber-400 border-slate-950 ring-4 ring-amber-950/40'
                    : 'bg-emerald-400 border-slate-950'
                }`} />

                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">
                        Block {idx + 1} ({task.available_hours}h)
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        task.priority === 'high' 
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                          : task.priority === 'medium'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {task.priority}
                      </span>
                      <RiskBadge risk={task.deadline_risk} />
                    </div>

                    <h4 className="font-semibold text-sm text-slate-200 mt-2 leading-snug">
                      {task.title}
                    </h4>

                    {task.description && (
                      <p className="text-xs text-slate-400 mt-1 max-w-xl line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    <div className="text-[10px] text-slate-500 mt-3 flex flex-wrap gap-x-4 gap-y-1.5 font-mono">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-600" />
                        <span>Start: <strong>{formatDate(task.scheduled_start!)}</strong></span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-650" />
                        <span>End: <strong>{formatDate(task.scheduled_end!)}</strong></span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-650" />
                        <span>Due: <strong>{formatDate(task.deadline)}</strong></span>
                      </span>
                    </div>
                  </div>

                  {/* Actions Panel */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={() => handleToggleComplete(task)}
                      className="p-1.5 rounded bg-slate-900 hover:bg-slate-805 border border-slate-800 text-slate-400 hover:text-emerald-400 transition"
                      title="Mark as complete"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => openEditModal(task)}
                      className="p-1.5 rounded bg-slate-900 hover:bg-slate-805 border border-slate-800 text-slate-400 hover:text-white transition"
                      title="Edit task"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-1.5 rounded bg-slate-900 hover:bg-rose-950 border border-slate-800 hover:border-rose-900 text-slate-400 hover:text-rose-450 transition"
                      title="Delete task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTasksTab = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Task List */}
        <div className="lg:col-span-8 bg-slate-900/20 border border-slate-900 rounded-2xl flex flex-col min-h-[400px]">
          {/* Filter Tabs */}
          <div className="bg-slate-900/60 border-b border-slate-900 px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex gap-1.5">
              {(['pending', 'completed', 'all'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                    activeTab === tab 
                      ? 'bg-slate-800 text-white border border-slate-700' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab === 'pending' ? 'Active Tasks' : tab}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider bg-slate-900 px-2.5 py-1 rounded">
              Total: {filteredTasks.length}
            </span>
          </div>

          {/* List Body */}
          <div className="p-6 divide-y divide-slate-900/60 overflow-y-auto max-h-[600px] flex-1">
            {filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-center">
                <ListTodo className="w-12 h-12 text-slate-750 mb-3" />
                <p className="font-semibold text-sm">No tasks in this filter.</p>
                <p className="text-xs text-slate-600 mt-1 max-w-[250px]">
                  Create a task or change filters to see items.
                </p>
              </div>
            ) : (
              filteredTasks.map(task => (
                <div 
                  key={task.id} 
                  className="py-4 first:pt-0 last:pb-0 flex items-start gap-4 hover:bg-slate-900/10 transition group"
                >
                  {/* Checkbox wrapper */}
                  <button 
                    onClick={() => handleToggleComplete(task)}
                    className={`w-5.5 h-5.5 rounded-md border flex items-center justify-center cursor-pointer transition shrink-0 mt-0.5 ${
                      task.completed 
                        ? 'bg-emerald-500 border-emerald-400 text-white' 
                        : 'border-slate-700 hover:border-sky-500 bg-slate-950'
                    }`}
                  >
                    {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>

                  {/* Task Title & Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`font-semibold text-sm truncate ${task.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                        {task.title}
                      </h3>
                      
                      {/* Priority Badge */}
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        task.priority === 'high' 
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                          : task.priority === 'medium'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {task.priority}
                      </span>

                      {/* Deadline Risk Badge */}
                      {!task.completed && task.deadline_risk && (
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded flex items-center gap-0.5 ${
                          task.deadline_risk === 'high' 
                            ? 'bg-red-650 text-white' 
                            : task.deadline_risk === 'medium'
                            ? 'bg-amber-650 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {task.deadline_risk === 'high' && <AlertTriangle className="w-2.5 h-2.5" />}
                          Risk: {task.deadline_risk}
                        </span>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    {/* Timeline scheduling metadata */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2.5 text-[11px] text-slate-500 items-center">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-600" />
                        <span>Duration: <strong>{task.available_hours}h</strong></span>
                      </span>
                      
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-600" />
                        <span>Due: <strong>{formatDate(task.deadline)}</strong></span>
                      </span>

                      {/* Scheduled time block */}
                      {!task.completed && task.scheduled_start && task.scheduled_end && (
                        <span className="flex items-center gap-1 text-sky-400 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          Scheduled: {formatDate(task.scheduled_start)} - {formatTimeOnly(task.scheduled_end)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Panel */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0">
                    {task.deadline_risk === 'high' && !task.completed && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          optimizeTask(task.id, token, mockMode);
                        }}
                        className="p-1.5 rounded bg-amber-500/10 hover:bg-amber-500 border border-amber-500/20 text-amber-300 hover:text-white transition-all duration-200"
                        title="Optimize task"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button 
                      onClick={() => openEditModal(task)}
                      className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-all duration-200"
                      title="Edit task"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-1.5 rounded bg-slate-900 hover:bg-rose-955 border border-slate-800 hover:border-rose-900 text-slate-400 hover:text-rose-400 transition-all duration-200"
                      title="Delete task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Stats breakdown */}
        <div className="lg:col-span-4 bg-slate-900/20 border border-slate-900 rounded-2xl p-6 space-y-6 shrink-0">
          <h3 className="text-sm font-bold text-slate-350 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-400" /> Work Load Distribution
          </h3>
          
          {priorityHoursData.length > 0 ? (
            <div className="h-44 w-full flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityHoursData}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {priorityHoursData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[entry.name as keyof typeof PRIORITY_COLORS]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                    itemStyle={{ color: '#cbd5e1' }}
                  />
                  <Legend verticalAlign="bottom" height={24} iconSize={10} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
              
              <div className="absolute top-[34%] left-[50%] translate-x-[-50%] translate-y-[-50%] text-center pointer-events-none">
                <span className="block text-md font-extrabold text-white leading-none">
                  {insights.total_uncompleted_hours.toFixed(1)}h
                </span>
                <span className="text-[9px] uppercase font-bold text-slate-500">Remaining</span>
              </div>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-slate-600 text-xs italic">
              No active workload priorities found.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDashboardView = () => {
    if (tasks.length === 0 && !taskLoading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[500px] text-center max-w-lg mx-auto">
          <div className="w-20 h-20 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-6 shadow-lg shadow-sky-500/5">
            <Sparkles className="w-10 h-10 text-sky-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Create Your First Task</h3>
          <p className="text-sm text-slate-400 mb-8 leading-relaxed">
            Welcome to ActionPilot! Let's get started. Create your first task to see the chronological 9-to-5 workday scheduling, priority metrics, and deadline risk calculations come to life.
          </p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-sky-500/10 hover:shadow-sky-500/20 text-sm transition"
          >
            <Plus className="w-5 h-5" /> Create Your First Task
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Switcher & Actions bar */}
        <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-900">
            <button
              onClick={() => setCanvasTab('timeline')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                canvasTab === 'timeline'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" /> Chronological Timeline
            </button>
            <button
              onClick={() => setCanvasTab('tasks')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                canvasTab === 'tasks'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ListTodo className="w-3.5 h-3.5" /> All Task Manager
            </button>
          </div>

          <div className="flex items-center gap-2">
            {insights.high_risk_count > 0 && (
              <button 
                onClick={() => {
                  setLowFactor(0.70);
                  setMedFactor(0.85);
                  setShowBehindModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg shadow-lg hover:shadow-rose-600/15 text-xs transition duration-150 animate-pulse animate-duration-1000"
              >
                <Flame className="w-3.5 h-3.5" /> I&apos;m Behind
              </button>
            )}
            <button 
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white font-bold rounded-lg shadow-md text-xs transition"
            >
              <Plus className="w-4 h-4" /> Add Task
            </button>
          </div>
        </div>

        {canvasTab === 'timeline' ? renderTimelineTab() : renderTasksTab()}
      </div>
    );
  };

  const renderCalendarView = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    
    // First day of current month
    const firstDay = new Date(year, month, 1).getDay();
    // Total days in current month
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    // Create arrays
    const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);
    const paddingArray = Array.from({ length: firstDay }, () => null);
    const allDays = [...paddingArray, ...daysArray];

    const getTasksForDay = (day: number) => {
      return tasks.filter(t => {
        if (t.completed || !t.scheduled_start) return false;
        const tDate = new Date(t.scheduled_start);
        return tDate.getFullYear() === year && tDate.getMonth() === month && tDate.getDate() === day;
      });
    };

    const monthName = today.toLocaleString('default', { month: 'long' });

    return (
      <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-indigo-400" /> Work Calendar — {monthName} {year}
          </h2>
          <p className="text-xs text-slate-400 mt-1">Check scheduled task blocks inside the monthly calendar grid.</p>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-900 pb-2">
          <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {allDays.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="h-24 bg-slate-950/20 rounded-xl border border-transparent" />;
            }

            const dayTasks = getTasksForDay(day);
            const isToday = day === today.getDate();
            
            return (
              <div 
                key={`day-${day}`} 
                className={`h-24 p-2 bg-slate-950/60 border rounded-xl flex flex-col justify-between transition-all ${
                  isToday 
                    ? 'border-sky-500 shadow-md shadow-sky-500/5' 
                    : 'border-slate-850 hover:border-slate-800'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-bold ${isToday ? 'text-sky-400' : 'text-slate-450'}`}>
                    {day}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                  )}
                </div>
                
                <div className="flex-1 overflow-hidden mt-1 space-y-1">
                  {dayTasks.slice(0, 2).map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setActiveTaskId(t.id); }}
                      className={`text-[9px] w-full text-left px-1 py-0.5 rounded border text-slate-400 truncate transition-all duration-200 ${
                        activeTaskId === t.id
                          ? 'ring-2 ring-indigo-500 bg-sky-500/15 border-sky-500 text-sky-100' 
                          : 'bg-slate-900 border-slate-800 hover:bg-slate-850 hover:text-white'
                      }`}
                      title={t.title}
                    >
                      {t.title}
                    </button>
                  ))}
                  {dayTasks.length > 2 && (
                    <div className="text-[8px] text-slate-550 text-center font-bold">
                      +{dayTasks.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderInsightsView = () => {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <div className="bg-slate-900/20 border border-slate-900 rounded-3xl p-6">
            <h2 className="text-xl font-bold text-white">Insights Overview</h2>
            <p className="text-sm text-slate-400 mt-2">Review current workload health, deadline risk, and productivity recommendations.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="bg-slate-900/20 border border-slate-900 rounded-3xl p-5 text-center">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-3">Completed</p>
              <p className="text-3xl font-bold text-sky-300">{insights.completed_count}</p>
            </div>
            <div className="bg-slate-900/20 border border-slate-900 rounded-3xl p-5 text-center">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-3">Pending</p>
              <p className="text-3xl font-bold text-white">{insights.uncompleted_count}</p>
            </div>
            <div className="bg-slate-900/20 border border-slate-900 rounded-3xl p-5 text-center">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-3">Load</p>
              <p className="text-3xl font-bold text-emerald-300">{insights.total_uncompleted_hours.toFixed(1)}h</p>
            </div>
          </div>

          <div className="bg-slate-900/20 border border-slate-900 rounded-3xl p-6">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-[0.2em] mb-4">Risk Breakdown</h3>
            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-4">
                <span>High risk tasks</span>
                <span className="font-semibold text-rose-400">{insights.high_risk_count}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Medium risk tasks</span>
                <span className="font-semibold text-amber-300">{insights.medium_risk_count}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Total tasks</span>
                <span className="font-semibold text-slate-200">{insights.total_tasks}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900/20 border border-slate-900 rounded-3xl p-6 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white uppercase tracking-[0.2em]">AI Recommendations</h3>
              </div>
              <div className="space-y-4 text-sm text-slate-300">
                {insights.recommendations.length > 0 ? (
                  insights.recommendations.map((rec, index) => (
                    <div key={index} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-1">{rec.type}</p>
                      <p className="font-semibold text-white">{rec.title}</p>
                      <p className="mt-2 text-slate-400">{rec.message}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400">All systems go. Your current schedule is healthy.</p>
                )}
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-500">
              <p className="font-semibold text-slate-200 mb-2">Goal</p>
              <p>Keep risk low by staying within available hours and adapting tasks when deadlines tighten.</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSettingsView = () => {
    return (
      <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-6 space-y-8 max-w-2xl">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" /> Workspace Settings
          </h2>
          <p className="text-xs text-slate-400 mt-1">Configure schedule metrics, toggle storage engines, and view account states.</p>
        </div>

        <div className="space-y-6 divide-y divide-slate-900/60">
          
          {/* Storage Toggle */}
          <div className="space-y-4 pt-4 first:pt-0">
            <h3 className="text-sm font-bold text-slate-350">Storage Engine & Sandbox Mode</h3>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-950/80 rounded-xl border border-slate-850">
              <div>
                <span className="font-semibold text-sm text-slate-200 block">Database Storage Mode</span>
                <span className="text-xs text-slate-450 leading-relaxed block mt-0.5">
                  Select where you want your workload stored. Supabase connects to the cloud backend, while Sandbox relies on local storage.
                </span>
              </div>
              <button 
                onClick={() => toggleMockMode(!mockMode)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition shrink-0 ${
                  mockMode 
                    ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20' 
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                }`}
              >
                {mockMode ? 'Switch to Cloud' : 'Switch to Local Sandbox'}
              </button>
            </div>
          </div>

          {/* Compress factors */}
          <div className="space-y-4 pt-6">
            <h3 className="text-sm font-bold text-slate-350">Compression Scheduling Multipliers</h3>
            <p className="text-xs text-slate-450 leading-relaxed">
              Define the remaining duration parameters utilized by the &quot;I&apos;m Behind&quot; rule recalculation engine.
            </p>
            <div className="space-y-4 p-4 bg-slate-950/80 rounded-xl border border-slate-850">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1.5">
                  <span className="text-slate-450">Low Priority Tasks Factor</span>
                  <span className="text-emerald-400">{(lowFactor * 100).toFixed(0)}%</span>
                </div>
                <input 
                  type="range"
                  min="0.5" 
                  max="1.0" 
                  step="0.05"
                  value={lowFactor}
                  onChange={(e) => setLowFactor(Number(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1.5">
                  <span className="text-slate-450">Medium Priority Tasks Factor</span>
                  <span className="text-amber-400">{(medFactor * 100).toFixed(0)}%</span>
                </div>
                <input 
                  type="range"
                  min="0.5" 
                  max="1.0" 
                  step="0.05"
                  value={medFactor}
                  onChange={(e) => setMedFactor(Number(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Account Profile block */}
          <div className="space-y-4 pt-6">
            <h3 className="text-sm font-bold text-slate-350">Account Profile</h3>
            <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-855 flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Signed In As</span>
                <span className="text-sm font-semibold text-slate-200 mt-1 block truncate max-w-[250px]">{user?.email}</span>
              </div>
              <button 
                onClick={signOut}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-xs font-bold transition shrink-0"
              >
                Sign Out Account
              </button>
            </div>
          </div>

        </div>
      </div>
    );
  };

  if (isLoading || taskLoading || !user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-100 min-h-screen">
        <Loader2 className="w-12 h-12 text-sky-400 animate-spin mb-4" />
        <p className="text-slate-400 text-sm tracking-wide">Syncing workspace dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      
      {/* Sidebar (Left) - Desktop view */}
      <aside className="w-80 bg-slate-900 border-r border-slate-800 hidden md:flex flex-col justify-between h-full shrink-0 z-20">
        <div className="p-6 space-y-8 flex-1 flex flex-col min-h-0 overflow-y-auto">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/10">
              <Sparkles className="w-5.5 h-5.5 text-white" />
            </div>
            <div>
              <span className="font-extrabold tracking-tight text-white text-lg block leading-none">ActionPilot</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold block mt-1">AI Companion MVP</span>
            </div>
          </div>

          {/* Navigation links */}
          <nav className="space-y-1.5 shrink-0">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: ListTodo },
              { id: 'calendar', label: 'Calendar', icon: CalendarDays },
              { id: 'insights', label: 'Insights', icon: TrendingUp },
              { id: 'settings', label: 'Settings', icon: Layers },
            ].map(item => {
              const Icon = item.icon;
              const isActive = sidebarTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSidebarTab(item.id as any)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
                    isActive 
                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' 
                      : 'text-slate-450 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-sky-400' : 'text-slate-450'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex-grow" />

          {/* Persistent Sidebar Footer */}
          <div className="space-y-6 pt-4 border-t border-slate-800/60 shrink-0">
            {/* Mini-stats widget */}
            <div className="space-y-2.5">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Workspace Health</span>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-950/80 border border-slate-800/60 rounded-lg py-2 px-1">
                  <span className="block text-sm font-bold text-white leading-none mb-1">
                    {insights.completed_count}
                  </span>
                  <span className="text-[9px] text-slate-500 font-semibold block">Done</span>
                </div>
                <div className="bg-slate-950/80 border border-slate-800/60 rounded-lg py-2 px-1">
                  <span className="block text-sm font-bold text-white leading-none mb-1">
                    {insights.uncompleted_count}
                  </span>
                  <span className="text-[9px] text-slate-500 font-semibold block">Pending</span>
                </div>
                <div className="bg-slate-950/80 border border-slate-800/60 rounded-lg py-2 px-1">
                  <span className="block text-sm font-bold text-sky-400 leading-none mb-1">
                    {insights.total_uncompleted_hours.toFixed(1)}h
                  </span>
                  <span className="text-[9px] text-slate-500 font-semibold block">Load</span>
                </div>
              </div>
            </div>

            {/* AI Inspired panel */}
            <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">AI Recommendation</span>
              </div>
              {insights.recommendations && insights.recommendations.length > 0 ? (
                <div className="text-[11px] text-slate-450 leading-relaxed line-clamp-3">
                  <strong className="text-slate-350 block mb-0.5">{insights.recommendations[0].title}</strong>
                  {insights.recommendations[0].message}
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 italic">
                  Schedules are in optimal order!
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile drawer sidebar backdrop & overlay */}
      {showMobileSidebar && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setShowMobileSidebar(false)}
          />
          <div className="relative w-80 bg-slate-900 border-r border-slate-800 flex flex-col justify-between h-full p-6 z-10">
            <div className="space-y-8 flex-1 flex flex-col min-h-0 overflow-y-auto">
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg">
                    <Sparkles className="w-5.5 h-5.5 text-white" />
                  </div>
                  <div>
                    <span className="font-extrabold tracking-tight text-white text-lg block leading-none">ActionPilot</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold block mt-1">AI Companion MVP</span>
                  </div>
                </div>
                <button 
                  onClick={() => setShowMobileSidebar(false)}
                  className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Navigation links */}
              <nav className="space-y-1.5 shrink-0">
                {[
                  { id: 'dashboard', label: 'Dashboard', icon: ListTodo },
                  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
                  { id: 'insights', label: 'Insights', icon: TrendingUp },
                  { id: 'settings', label: 'Settings', icon: Layers },
                ].map(item => {
                  const Icon = item.icon;
                  const isActive = sidebarTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSidebarTab(item.id as any);
                        setShowMobileSidebar(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
                        isActive 
                          ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' 
                          : 'text-slate-450 hover:text-white hover:bg-slate-800/40'
                      }`}
                    >
                      <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-sky-400' : 'text-slate-450'}`} />
                      {item.label}
                    </button>
                  );
                })}
              </nav>

              <div className="flex-grow" />

              {/* Mobile Persistent Footer */}
              <div className="space-y-6 pt-4 border-t border-slate-800/60 shrink-0">
                <div className="space-y-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Workspace Health</span>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-950/80 border border-slate-800/60 rounded-lg py-2">
                      <span className="block text-sm font-bold text-white">{insights.completed_count}</span>
                      <span className="text-[9px] text-slate-500 font-semibold block">Done</span>
                    </div>
                    <div className="bg-slate-950/80 border border-slate-800/60 rounded-lg py-2">
                      <span className="block text-sm font-bold text-white">{insights.uncompleted_count}</span>
                      <span className="text-[9px] text-slate-500 font-semibold block">Pending</span>
                    </div>
                    <div className="bg-slate-950/80 border border-slate-800/60 rounded-lg py-2">
                      <span className="block text-sm font-bold text-sky-400">{insights.total_uncompleted_hours.toFixed(1)}h</span>
                      <span className="text-[9px] text-slate-500 font-semibold block">Load</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">AI Recommendation</span>
                  </div>
                  {insights.recommendations && insights.recommendations.length > 0 ? (
                    <div className="text-[11px] text-slate-450 leading-relaxed line-clamp-3">
                      <strong className="text-slate-355 block mb-0.5">{insights.recommendations[0].title}</strong>
                      {insights.recommendations[0].message}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 italic">
                      Schedules are in optimal order!
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col h-full overflow-hidden">
        
        {/* Top Header Bar */}
        <header className="h-16 border-b border-slate-900 bg-slate-900/20 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile Sidebar Hamburger Toggle */}
            <button 
              onClick={() => setShowMobileSidebar(true)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-md font-bold text-white capitalize tracking-tight flex items-center gap-2">
              {sidebarTab === 'dashboard' && 'Work Canvas'}
              {sidebarTab === 'calendar' && 'Work Calendar'}
              {sidebarTab === 'insights' && 'Insights'}
              {sidebarTab === 'settings' && 'Workspace Settings'}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Database status badge */}
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-800 bg-slate-950/80 text-xs">
              <Database className={`w-3.5 h-3.5 ${mockMode ? 'text-amber-400' : 'text-emerald-400'}`} />
              <span className="text-slate-450">DB:</span>
              <span className={`font-semibold ${mockMode ? 'text-amber-400' : 'text-emerald-400'}`}>
                {mockMode ? 'Sandbox' : 'Supabase'}
              </span>
            </div>

            <span className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg max-w-[150px] truncate hidden md:inline-block">
              {user.email}
            </span>

            <button 
              onClick={signOut}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold"
            >
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Dynamic stage rendering */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-950">
          
          {isOfflineMode && (
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-200 text-xs font-semibold shadow-sm shadow-amber-500/10">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              Local Sandbox Mode
            </div>
          )}

          {sidebarTab === 'dashboard' && renderDashboardView()}
          {sidebarTab === 'calendar' && renderCalendarView()}
          {sidebarTab === 'insights' && renderInsightsView()}
          {sidebarTab === 'settings' && renderSettingsView()}
        </div>

        {/* Global Footer */}
        <footer className="py-4 border-t border-slate-900 text-center text-[11px] text-slate-650 shrink-0 bg-slate-900/10">
          ActionPilot &copy; {new Date().getFullYear()} — Secure Rule Engine Running
        </footer>
      </div>

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-sky-400" /> Create Task Block
            </h3>
            
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Title
                </label>
                <input 
                  type="text" 
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Review schema integration"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-600 outline-none text-sm transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Description
                </label>
                <textarea 
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Tasks, references and implementation rules..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-600 outline-none text-sm transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Priority
                  </label>
                  <select 
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-slate-200 outline-none text-sm transition"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Est. Duration (Hours)
                  </label>
                  <input 
                    type="number" 
                    required
                    min={0.1}
                    max={100}
                    step={0.1}
                    value={formHours}
                    onChange={(e) => setFormHours(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-slate-200 outline-none text-sm transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-450 mb-1">
                  Task Deadline
                </label>
                <input 
                  type="text" 
                  required
                  value={formDeadline}
                  onChange={(e) => setFormDeadline(e.target.value)}
                  placeholder="MM/DD/YYYY or MM/DD/YYYY HH:MM"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-slate-200 outline-none text-sm transition text-slate-400"
                />
                {formError && (
                  <p className="mt-2 text-[11px] text-rose-400">{formError}</p>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 font-semibold text-xs transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white font-semibold rounded-lg text-xs shadow-md transition"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {showEditModal && selectedTask && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-sky-400" /> Edit Task Block
            </h3>
            
            <form onSubmit={handleUpdateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Title
                </label>
                <input 
                  type="text" 
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-slate-200 outline-none text-sm transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Description
                </label>
                <textarea 
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-slate-200 outline-none text-sm transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Priority
                  </label>
                  <select 
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-slate-200 outline-none text-sm transition"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Est. Duration (Hours)
                  </label>
                  <input 
                    type="number" 
                    required
                    min={0.1}
                    max={100}
                    step={0.1}
                    value={formHours}
                    onChange={(e) => setFormHours(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-slate-200 outline-none text-sm transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Task Deadline
                </label>
                <input 
                  type="text" 
                  required
                  value={formDeadline}
                  onChange={(e) => setFormDeadline(e.target.value)}
                  placeholder="MM/DD/YYYY or MM/DD/YYYY HH:MM"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-slate-200 outline-none text-sm transition text-slate-450"
                />
                {formError && (
                  <p className="mt-2 text-[11px] text-rose-400">{formError}</p>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedTask(null);
                  }}
                  className="px-4 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 font-semibold text-xs transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white font-semibold rounded-lg text-xs shadow-md transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recalculate Compression Modal ("I'm Behind") */}
      {showBehindModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-rose-450 flex items-center gap-2">
              <Flame className="w-5 h-5 text-rose-500 animate-pulse" /> Recalculate & Compress Schedule
            </h3>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              If your current schedule overflows your deadlines, you can compress estimated task hours to fit them in. Specify the compression factors:
            </p>

            <div className="space-y-4 pt-2">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-slate-450">Low Priority Tasks Duration</span>
                  <span className="text-emerald-400">{(lowFactor * 100).toFixed(0)}%</span>
                </div>
                <input 
                  type="range"
                  min="0.5" 
                  max="1.0" 
                  step="0.05"
                  value={lowFactor}
                  onChange={(e) => setLowFactor(Number(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-slate-455">Medium Priority Tasks Duration</span>
                  <span className="text-amber-400">{(medFactor * 100).toFixed(0)}%</span>
                </div>
                <input 
                  type="range"
                  min="0.5" 
                  max="1.0" 
                  step="0.05"
                  value={medFactor}
                  onChange={(e) => setMedFactor(Number(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              <div className="p-3 bg-slate-950 border border-slate-850 rounded-lg text-[10px] text-slate-500 flex gap-2">
                <Info className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Note: High priority tasks are never compressed to protect critical deliverables. Recalculation is saved automatically.</span>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button 
                type="button" 
                onClick={() => setShowBehindModal(false)}
                className="px-4 py-2 bg-slate-855 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 font-semibold text-xs transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleBehindCompression}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs shadow-md transition"
              >
                Compress & Update
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
