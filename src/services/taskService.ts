// src/services/taskService.ts
import { Task } from '@/types';
import { taskRepository } from '@/repositories/taskRepository';

export const taskService = {
  async getTasks(params?: {
    hotelId?: string;
    status?: string;
    priority?: string;
    department?: string;
    search?: string;
  }): Promise<Task[]> {
    return await taskRepository.getTasks(params);
  },

  async getTaskById(id: string): Promise<Task> {
    return await taskRepository.getTaskById(id);
  },

  async createTask(task: Omit<Task, 'id' | 'createdAt'>): Promise<Task> {
    const createdTask = await taskRepository.createTask(task);

    try {
      const { notificationService } = await import('./notificationService');
      await notificationService.createNotification({
        type: 'task_assigned',
        title: 'New Task Assigned',
        message: `Task "${createdTask.title}" has been assigned to ${createdTask.assignedTo || 'staff'} in the ${createdTask.department} department.`,
        hotelId: createdTask.hotelId
      });
    } catch (e) {
      console.warn('Realtime notification trigger failed:', e);
    }

    return createdTask;
  },

  async updateTaskStatus(id: string, status: string): Promise<Task> {
    const updatedTask = await taskRepository.updateTaskStatus(id, status);

    if (status === 'completed') {
      try {
        const { notificationService } = await import('./notificationService');
        await notificationService.createNotification({
          type: 'task_completed',
          title: 'Task Completed',
          message: `Task "${updatedTask.title}" has been completed by ${updatedTask.assignedTo || 'staff'}.`,
          hotelId: updatedTask.hotelId
        });
      } catch (e) {
        console.warn('Realtime notification trigger failed:', e);
      }
    }

    return updatedTask;
  },

  async completeTask(id: string, status: string, resolutionNote: string, completedBy?: string, description?: string): Promise<Task> {
    const updatedTask = await taskRepository.completeTask(id, status, resolutionNote, completedBy, description);

    try {
      const { notificationService } = await import('./notificationService');
      await notificationService.createNotification({
        type: 'task_completed',
        title: 'Task Completed',
        message: `Task "${updatedTask.title}" has been completed by ${updatedTask.assignedTo || 'staff'}.`,
        hotelId: updatedTask.hotelId
      });
    } catch (e) {
      console.warn('Realtime notification trigger failed:', e);
    }

    return updatedTask;
  },

  async getDashboardTasks(hotelId?: string): Promise<{ openTasks: Task[]; overdueTasks: Task[] }> {
    return await taskRepository.getDashboardTasks(hotelId);
  }
};
