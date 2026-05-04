"use client";

import { useState, useEffect, useCallback } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Trash2,
  CheckCircle2,
  MessageSquare,
  ListTodo,
  Timer,
  Activity,
  User,
  Plus,
} from "lucide-react";
import {
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  addComment,
  updateTask,
} from "@/app/actions/task-details";
import { getTaskDetails } from "@/app/actions/task-fetcher";
import { StartFocusButton } from "@/components/focus/start-focus-button";

export function TaskDetailDrawer({
  taskId,
  projectId,
  open,
  onOpenChange,
}: {
  taskId: string;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // Checklist
  const [newItem, setNewItem] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  // Comment
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);

  // Description edit
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [desc, setDesc] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    if (!navigator.onLine) {
      // Try to load from IDB
      try {
        const { getDB } = await import('@/lib/offline/db');
        const db = await getDB();
        if (db) {
          const cached = await db.get('cached_tasks', taskId);
          if (cached) {
            setData(cached.value);
            setDesc(cached.value.task.description || "");
            setLoading(false);
            return;
          }
        }
      } catch(e) {
        console.error(e)
      }
    }

    const res = await getTaskDetails(taskId);
    if (!res.error) {
      setData(res);
      setDesc(res.task.description || "");

      // Save to IDB for offline
      try {
        const { getDB } = await import('@/lib/offline/db');
        const db = await getDB();
        if (db) {
          await db.put('cached_tasks', { id: taskId, value: res, project_id: projectId });
        }
      } catch(e) {}
    }
    setLoading(false);
  }, [projectId, taskId]);

  useEffect(() => {
    if (open && taskId) {
      const fetchTimer = window.setTimeout(() => {
        void fetchData();
      }, 0);

      return () => window.clearTimeout(fetchTimer);
    }
  }, [fetchData, open, taskId]);

  if (!open) return null;

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    setAddingItem(true);

    if (!navigator.onLine) {
      const { addToSyncQueue } = await import('@/lib/offline/sync-queue');
      const tempId = crypto.randomUUID();
      await addToSyncQueue('create_checklist_item', 'checklist', taskId, { content: newItem }, data.task.workspace_id, projectId);

      // Optimistic update
      setData((prev: any) => ({
        ...prev,
        checklists: [...prev.checklists, { id: tempId, title: newItem, is_completed: false, _isPending: true }]
      }));
      setNewItem("");
      setAddingItem(false);
      return;
    }

    await addChecklistItem(taskId, newItem, projectId);
    setNewItem("");
    setAddingItem(false);
    fetchData();
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setAddingComment(true);

    if (!navigator.onLine) {
      const { addToSyncQueue } = await import('@/lib/offline/sync-queue');
      const tempId = crypto.randomUUID();
      await addToSyncQueue('create_comment', 'comment', taskId, { content: newComment }, data.task.workspace_id, projectId);

      // Optimistic update
      setData((prev: any) => ({
        ...prev,
        comments: [...prev.comments, { id: tempId, content: newComment, created_at: new Date().toISOString(), _isPending: true }]
      }));
      setNewItem("");
      setAddingComment(false);
      return;
    }

    await addComment(taskId, newComment, projectId);
    setNewItem("");
    setAddingComment(false);
    fetchData();
  };

  const handleSaveDesc = async () => {
    setSavingDesc(true);

    if (!navigator.onLine) {
      const { addToSyncQueue } = await import('@/lib/offline/sync-queue');
      await addToSyncQueue('update_task', 'task', taskId, { description: desc }, data.task.workspace_id, projectId);
      setData((prev: any) => ({ ...prev, task: { ...prev.task, description: desc } }));
      setSavingDesc(false);
      setIsEditingDesc(false);
      return;
    }

    await updateTask(taskId, { description: desc }, projectId);
    setSavingDesc(false);
    setIsEditingDesc(false);
    fetchData();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] flex flex-col rounded-t-[2rem]">
        <DrawerHeader className="px-4 md:px-8 pt-6 pb-0">
          <DrawerTitle className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 mb-1">
            {loading || !data ? "Loading Task..." : data.task.title}
          </DrawerTitle>
          <DrawerDescription className="text-sm font-bold uppercase tracking-widest text-primary">
            {loading || !data ? "" : data.task.projects?.name}
          </DrawerDescription>
        </DrawerHeader>

        {loading || !data ? (
          <div className="flex-1 flex items-center justify-center min-h-[300px]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto px-4 md:px-8 pb-10">
            {/* Header section (moved content) */}
            <div className="py-6 flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="px-2.5 py-1 uppercase tracking-wider font-bold text-[10px] bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                    {data.task.status}
                  </span>
                  <span className="px-2.5 py-1 uppercase tracking-wider font-bold text-[10px] bg-rose-50 text-rose-700 rounded-md border border-rose-200">
                    {data.task.priority} Priority
                  </span>

                  {data.task.owner_id ? (
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 ml-2">
                      <User className="w-4 h-4 text-slate-400" />
                      Assigned
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-sm font-medium text-amber-600 ml-2">
                      <User className="w-4 h-4 text-amber-500" />
                      Unassigned
                    </div>
                  )}

                  {data.task.deadline && (
                    <div className="text-sm font-medium text-slate-600 ml-2">
                      Due: {format(new Date(data.task.deadline), "MMM d, yyyy")}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <StartFocusButton
                  taskId={taskId}
                  projectId={projectId}
                  size="lg"
                  className="rounded-full h-11 px-6 shadow-sm"
                />
              </div>
            </div>

            {/* Description */}
            <div className="mb-8 p-6 bg-slate-50/50 border border-slate-100 rounded-3xl">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-800">Description</h3>
                {!isEditingDesc && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingDesc(true)}
                    className="h-8 text-xs font-semibold"
                  >
                    Edit
                  </Button>
                )}
              </div>

              {isEditingDesc ? (
                <div className="space-y-3">
                  <Textarea
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    className="min-h-[100px] border-slate-200 resize-none rounded-xl focus-visible:ring-primary/20 bg-white"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditingDesc(false);
                        setDesc(data.task.description || "");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveDesc}
                      disabled={savingDesc}
                      className="shadow-sm"
                    >
                      {savingDesc ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Save"
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">
                  {data.task.description || "No description provided."}
                </p>
              )}
            </div>

            <Tabs defaultValue="checklist" className="w-full">
              <TabsList className="w-full justify-start h-12 bg-transparent border-b border-border/50 rounded-none mb-6 p-0 gap-8">
                <TabsTrigger
                  value="checklist"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-full font-semibold text-slate-500 data-[state=active]:text-foreground"
                >
                  <ListTodo className="w-4 h-4 mr-2" />
                  Checklist
                  <span className="ml-2 bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-full">
                    {data.checklists.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="sessions"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-full font-semibold text-slate-500 data-[state=active]:text-foreground"
                >
                  <Timer className="w-4 h-4 mr-2" />
                  Focus Sessions
                  <span className="ml-2 bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-full">
                    {data.focusSessions.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="comments"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-full font-semibold text-slate-500 data-[state=active]:text-foreground"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Comments
                </TabsTrigger>
                <TabsTrigger
                  value="activity"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-full font-semibold text-slate-500 data-[state=active]:text-foreground"
                >
                  <Activity className="w-4 h-4 mr-2" />
                  Activity
                </TabsTrigger>
              </TabsList>

              {/* Checklist Tab */}
              <TabsContent
                value="checklist"
                className="space-y-6 animate-in fade-in duration-300"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-semibold mb-4">
                    <span className="text-slate-500">Progress</span>
                    <span className="text-slate-900">
                      {data.checklists.length === 0
                        ? 0
                        : Math.round(
                            (data.checklists.filter((c: any) => c.is_completed)
                              .length /
                              data.checklists.length) *
                              100,
                          )}
                      %
                    </span>
                  </div>

                  {data.checklists.length === 0 && (
                    <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-sm font-medium text-slate-500">
                        No checklist items yet.
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Break this task into smaller steps.
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {data.checklists.map((item: any) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl group hover:border-slate-300 transition-colors"
                      >
                        <Checkbox
                          id={`chk-${item.id}`}
                          checked={item.is_completed}
                          onCheckedChange={async (val) => {
                            if (!navigator.onLine) {
                              const { addToSyncQueue } = await import('@/lib/offline/sync-queue');
                              await addToSyncQueue('update_checklist_item', 'checklist', item.id, { action: 'toggle', completed: !!val }, data.task.workspace_id, projectId);
                              setData((prev: any) => ({
                                ...prev,
                                checklists: prev.checklists.map((c: any) => c.id === item.id ? { ...c, is_completed: !!val, _isPending: true } : c)
                              }));
                              return;
                            }
                            await toggleChecklistItem(
                              item.id,
                              !!val,
                              projectId,
                            );
                            fetchData();
                          }}
                          className="w-5 h-5 rounded-[4px] border-slate-300 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-none"
                        />
                        <label
                          htmlFor={`chk-${item.id}`}
                          className={`flex-1 text-sm font-medium cursor-pointer transition-colors ${item.is_completed ? "line-through text-slate-400" : "text-slate-700"} ${item._isPending ? "opacity-70" : ""}`}
                        >
                          {item.title} {item._isPending && <span className="text-[10px] bg-slate-100 text-slate-500 px-1 ml-1 rounded">Pending sync</span>}
                        </label>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={item._isPending}
                          className="w-8 h-8 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-red-50 -mr-1"
                          onClick={async () => {
                            if (!navigator.onLine) {
                              const { addToSyncQueue } = await import('@/lib/offline/sync-queue');
                              await addToSyncQueue('update_checklist_item', 'checklist', item.id, { action: 'delete' }, data.task.workspace_id, projectId);
                              setData((prev: any) => ({
                                ...prev,
                                checklists: prev.checklists.filter((c: any) => c.id !== item.id)
                              }));
                              return;
                            }
                            await deleteChecklistItem(item.id, projectId);
                            fetchData();
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleAddChecklist} className="flex gap-2">
                  <Input
                    placeholder="Add a new checklist item..."
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    disabled={addingItem}
                    className="h-11 rounded-xl shadow-sm border-slate-200 focus-visible:ring-primary/20"
                  />
                  <Button
                    type="submit"
                    disabled={addingItem || !newItem.trim()}
                    className="h-11 px-6 rounded-xl shadow-sm"
                  >
                    {addingItem ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Add"
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* Sessions Tab */}
              <TabsContent
                value="sessions"
                className="space-y-4 animate-in fade-in duration-300"
              >
                <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/10 rounded-2xl mb-6">
                  <div>
                    <p className="text-sm font-medium text-primary">
                      Pomodoros Logged
                    </p>
                    <p className="text-2xl font-bold text-slate-900 leading-none mt-1">
                      {data.task.completed_pomodoros}{" "}
                      <span className="text-sm font-semibold text-slate-500">
                        / {data.task.estimate_pomodoros || "?"} estimated
                      </span>
                    </p>
                  </div>
                  <StartFocusButton
                    taskId={taskId}
                    projectId={projectId}
                    size="sm"
                    className="rounded-full shadow-sm"
                  />
                </div>

                {data.focusSessions.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-sm font-medium text-slate-500">
                      No focus sessions recorded.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.focusSessions.map((session: any) => (
                      <div
                        key={session.id}
                        className="p-4 bg-white border border-slate-200 rounded-xl"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                session.status === "completed"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : session.status === "abandoned"
                                    ? "bg-amber-100 text-amber-700"
                                    : session.status === "cancelled"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-indigo-100 text-indigo-700"
                              }`}
                            >
                              {session.status}
                            </span>
                            <span className="text-xs font-semibold text-slate-400">
                              {session.duration_minutes}m •{" "}
                              {formatDistanceToNow(
                                new Date(session.created_at),
                                { addSuffix: true },
                              )}
                            </span>
                          </div>
                          {session.distractions_count > 0 && (
                            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                              {session.distractions_count} distractions
                            </span>
                          )}
                        </div>
                        {session.progress_note && (
                          <p className="text-sm text-slate-700 mt-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                            {session.progress_note}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Comments Tab */}
              <TabsContent
                value="comments"
                className="flex flex-col h-[400px] animate-in fade-in duration-300"
              >
                <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                  {data.comments.length === 0 ? (
                    <div className="text-center py-8 h-full flex flex-col items-center justify-center">
                      <p className="text-sm font-medium text-slate-500">
                        No comments yet. Start the conversation.
                      </p>
                    </div>
                  ) : (
                    data.comments.map((comment: any) => (
                      <div key={comment.id} className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0 mt-1">
                          U
                        </div>
                        <div>
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-sm font-bold text-slate-900">
                              Member
                            </span>
                            <span className="text-xs font-semibold text-slate-400">
                              {formatDistanceToNow(
                                new Date(comment.created_at),
                                { addSuffix: true },
                              )}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 bg-slate-50 border border-slate-100 p-3 rounded-2xl rounded-tl-none">
                            {comment.content}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <form
                  onSubmit={handleAddComment}
                  className="flex gap-2 shrink-0"
                >
                  <Textarea
                    placeholder="Write a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    disabled={addingComment}
                    className="min-h-[44px] h-[44px] py-3 resize-none rounded-2xl shadow-sm border-slate-200 focus-visible:ring-primary/20"
                  />
                  <Button
                    type="submit"
                    disabled={addingComment || !newComment.trim()}
                    className="h-[44px] px-6 rounded-2xl shadow-sm"
                  >
                    {addingComment ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Send"
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* Activity Tab */}
              <TabsContent
                value="activity"
                className="space-y-4 animate-in fade-in duration-300"
              >
                {data.activityLogs.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-500 font-medium">
                    No activity recorded yet.
                  </div>
                ) : (
                  <div className="relative pl-4 space-y-6 before:absolute before:inset-0 before:ml-[23px] before:w-[2px] before:bg-slate-100">
                    {data.activityLogs.map((log: any) => (
                      <div key={log.id} className="relative flex gap-4">
                        <div className="w-5 h-5 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center shrink-0 mt-0.5 z-10" />
                        <div>
                          <p className="text-sm font-medium text-slate-700">
                            {log.action}
                          </p>
                          <p className="text-xs font-semibold text-slate-400 mt-0.5">
                            {formatDistanceToNow(new Date(log.created_at), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
