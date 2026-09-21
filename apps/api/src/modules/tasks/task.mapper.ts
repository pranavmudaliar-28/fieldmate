import {
  managesTasks,
  type EvidenceMimeType,
  type Role,
  type TaskDetail,
  type TaskListItem,
} from '@fieldmate/shared';
import type { StorageService } from '../../services/storage/storage.service.js';
import type { TaskDetailRows, TaskListRow } from './task.repository.js';

function rejection(reason: string | null, rejectedAt: Date | null) {
  return reason && rejectedAt ? { reason, rejectedAt: rejectedAt.toISOString() } : null;
}

export function toTaskListItem(row: TaskListRow, role: Role): TaskListItem {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    address: row.address,
    worker: { id: row.workerId, name: row.workerName },
    // Rejection details are for managers; workers no longer see a rejected task.
    rejection: managesTasks(role) ? rejection(row.rejectionReason, row.rejectedAt) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

export async function toTaskDetail(
  rows: TaskDetailRows,
  storage: StorageService,
): Promise<TaskDetail> {
  const { task } = rows;

  const evidence = await Promise.all(
    rows.evidence.map(async (item) => ({
      id: item.id,
      url: await storage.getSignedUrl(item.fileKey),
      fileType: item.fileType as EvidenceMimeType,
      uploadedBy: { id: item.uploadedById, name: item.uploadedByName },
      createdAt: item.createdAt.toISOString(),
    })),
  );

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    location: {
      address: task.address,
      addressDetails: task.addressDetails,
      latitude: task.latitude,
      longitude: task.longitude,
    },
    assignment: {
      worker: { id: task.workerId, name: task.workerName },
      assignedAt: task.assignedAt.toISOString(),
      rejection: rejection(task.rejectionReason, task.rejectedAt),
    },
    progress: {
      acceptedAt: task.acceptedAt?.toISOString() ?? null,
      departedAt: task.departedAt?.toISOString() ?? null,
      arrivedAt: task.arrivedAt?.toISOString() ?? null,
      startedAt: task.startedAt?.toISOString() ?? null,
    },
    evidence,
    notes: rows.notes.map((note) => ({
      id: note.id,
      content: note.content,
      createdBy: { id: note.createdById, name: note.createdByName },
      createdAt: note.createdAt.toISOString(),
    })),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    completedAt: task.completedAt?.toISOString() ?? null,
  };
}
