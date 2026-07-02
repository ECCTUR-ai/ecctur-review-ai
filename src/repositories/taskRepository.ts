// src/repositories/taskRepository.ts
import { supabase } from '@/lib/supabase';
import { Task } from '@/types';

export function mapTaskRecord(item: any): Task {
  return {
    id: item.id,
    reviewId: item.review_id || item.reviewId,
    title: item.title,
    description: item.description,
    department: item.department,
    assignedTo: item.assigned_to || item.assignedTo || '',
    dueDate: item.due_date || item.dueDate || '',
    priority: item.priority || 'medium',
    status: item.status || 'open',
    createdAt: item.created_at || item.createdAt || '',
    hotelId: item.hotel_id || item.hotelId,
    organizationId: item.organization_id || item.organizationId
  };
}

export const taskRepository = {
  async getTasks(params?: {
    hotelId?: string;
    status?: string;
    priority?: string;
    department?: string;
    search?: string;
  }): Promise<Task[]> {
    const runQuery = async (useHotelFilter: boolean) => {
      let query = supabase.from('tasks').select('*');

      if (params) {
        if (useHotelFilter && params.hotelId) {
          query = query.eq('hotel_id', params.hotelId);
        }
        if (params.status) query = query.eq('status', params.status);
        if (params.priority) query = query.eq('priority', params.priority);
        if (params.department) query = query.eq('department', params.department);
        if (params.search) {
          query = query.or(`title.ilike.%${params.search}%,description.ilike.%${params.search}%`);
        }
      }

      query = query.order('created_at', { ascending: false });
      return await query;
    };

    let response = await runQuery(true);
    if (response.error && (response.error.code === '42703' || response.error.message.includes('hotel_id'))) {
      // Fallback if hotel_id does not exist in schema
      response = await runQuery(false);
    }

    if (response.error) throw response.error;
    return (response.data || []).map(mapTaskRecord);
  },

  async getTaskById(id: string): Promise<Task> {
    const { data, error } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return mapTaskRecord(data);
  },

  async createTask(task: Omit<Task, 'id' | 'createdAt'>): Promise<Task> {
    const insertObj: any = {
      review_id: task.reviewId,
      title: task.title,
      description: task.description,
      department: task.department,
      assigned_to: task.assignedTo,
      due_date: task.dueDate,
      priority: task.priority,
      status: task.status
    };

    const runInsert = async (includeHotelIds: boolean) => {
      const payload = { ...insertObj };
      if (includeHotelIds) {
        payload.hotel_id = task.hotelId;
        payload.organization_id = task.organizationId;
      }
      return await supabase.from('tasks').insert(payload).select().maybeSingle();
    };

    let response = await runInsert(true);
    if (response.error && (response.error.code === '42703' || response.error.message.includes('hotel_id'))) {
      // Fallback: retry insert without hotel_id and organization_id columns
      response = await runInsert(false);
    }

    if (response.error) throw response.error;
    return mapTaskRecord(response.data);
  },

  async updateTaskStatus(id: string, status: string): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .update({ status })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return mapTaskRecord(data);
  },

  async getDashboardTasks(hotelId?: string): Promise<{ openTasks: Task[]; overdueTasks: Task[] }> {
    const today = new Date().toISOString().split('T')[0];

    const runDashboardQueries = async (useHotelFilter: boolean) => {
      let qOpen = supabase.from('tasks').select('*').neq('status', 'completed');
      let qOverdue = supabase.from('tasks').select('*').neq('status', 'completed').lt('due_date', today);

      if (useHotelFilter && hotelId) {
        qOpen = qOpen.eq('hotel_id', hotelId);
        qOverdue = qOverdue.eq('hotel_id', hotelId);
      }

      qOpen = qOpen.order('due_date', { ascending: true });
      qOverdue = qOverdue.order('due_date', { ascending: true });

      return await Promise.all([qOpen, qOverdue]);
    };

    let [openRes, overdueRes] = await runDashboardQueries(true);
    if ((openRes.error && (openRes.error.code === '42703' || openRes.error.message.includes('hotel_id'))) ||
        (overdueRes.error && (overdueRes.error.code === '42703' || overdueRes.error.message.includes('hotel_id')))) {
      // Fallback: retry query without hotel_id filtering
      [openRes, overdueRes] = await runDashboardQueries(false);
    }

    if (openRes.error) throw openRes.error;
    if (overdueRes.error) throw overdueRes.error;

    return {
      openTasks: (openRes.data || []).map(mapTaskRecord),
      overdueTasks: (overdueRes.data || []).map(mapTaskRecord)
    };
  }
};
