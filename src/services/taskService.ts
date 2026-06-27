import { supabase } from '@/lib/supabase';
import { Task } from '@/types';

function mapTaskRecord(item: any): Task {
  return {
    id: item.id,
    reviewId: item.review_id,
    title: item.title,
    description: item.description,
    department: item.department,
    assignedTo: item.assigned_to,
    dueDate: item.due_date,
    priority: item.priority,
    status: item.status,
    createdAt: item.created_at,
    hotelId: item.hotel_id,
    organizationId: item.organization_id
  };
}

export const taskService = {
  async getTasks(params?: {
    hotelId?: string;
    status?: string;
    priority?: string;
    department?: string;
    search?: string;
  }): Promise<Task[]> {
    let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });

    if (params) {
      if (params.hotelId) query = query.eq('hotel_id', params.hotelId);
      if (params.status) query = query.eq('status', params.status);
      if (params.priority) query = query.eq('priority', params.priority);
      if (params.department) query = query.eq('department', params.department);
      if (params.search) {
        query = query.or(`title.ilike.%${params.search}%,description.ilike.%${params.search}%`);
      }
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data || []).map(mapTaskRecord);
  },

  async getTaskById(id: string): Promise<Task> {
    const { data, error } = await supabase.from('tasks').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return mapTaskRecord(data);
  },

  async createTask(task: Omit<Task, 'id' | 'createdAt'>): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        review_id: task.reviewId,
        title: task.title,
        description: task.description,
        department: task.department,
        assigned_to: task.assignedTo,
        due_date: task.dueDate,
        priority: task.priority,
        status: task.status,
        hotel_id: task.hotelId,
        organization_id: task.organizationId
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    const createdTask = mapTaskRecord(data);

    try {
      const { notificationService } = await import('./notificationService');
      await notificationService.createNotification({
        type: 'task_assigned',
        title: 'New Task Assigned',
        message: `Task "${createdTask.title}" has been assigned to ${createdTask.assignedTo || 'staff'} in the ${createdTask.department} department.`
      });
    } catch (e) {
      console.warn('Realtime notification trigger failed:', e);
    }

    return createdTask;
  },

  async updateTaskStatus(id: string, status: string): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    const updatedTask = mapTaskRecord(data);

    if (status === 'completed') {
      try {
        const { notificationService } = await import('./notificationService');
        await notificationService.createNotification({
          type: 'task_completed',
          title: 'Task Completed',
          message: `Task "${updatedTask.title}" has been completed by ${updatedTask.assignedTo || 'staff'}.`
        });
      } catch (e) {
        console.warn('Realtime notification trigger failed:', e);
      }
    }

    return updatedTask;
  },

  async getDashboardTasks(hotelId?: string): Promise<{ openTasks: Task[]; overdueTasks: Task[] }> {
    const today = new Date().toISOString().split('T')[0];

    let qOpen = supabase.from('tasks').select('*').neq('status', 'completed').order('due_date', { ascending: true });
    let qOverdue = supabase.from('tasks').select('*').neq('status', 'completed').lt('due_date', today).order('due_date', { ascending: true });

    if (hotelId) {
      qOpen = qOpen.eq('hotel_id', hotelId);
      qOverdue = qOverdue.eq('hotel_id', hotelId);
    }

    const [openRes, overdueRes] = await Promise.all([qOpen, qOverdue]);

    if (openRes.error) throw new Error(openRes.error.message);
    if (overdueRes.error) throw new Error(overdueRes.error.message);

    return {
      openTasks: (openRes.data || []).map(mapTaskRecord),
      overdueTasks: (overdueRes.data || []).map(mapTaskRecord)
    };
  }
};
