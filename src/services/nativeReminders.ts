import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { Task } from '../types';

const REMINDER_SOURCE = 'lists-task-reminder';
export const TASK_REMINDER_ACTION_TYPE = 'task-reminder';
let reconciliationQueue: Promise<void> = Promise.resolve();

export function isAndroidNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function requestReminderPermission(): Promise<boolean> {
  if (!isAndroidNative()) return true;

  const current = await LocalNotifications.checkPermissions();
  const displayPermission =
    current.display === 'granted'
      ? current
      : await LocalNotifications.requestPermissions();
  if (displayPermission.display !== 'granted') return false;

  const exactAlarmPermission = await LocalNotifications.checkExactNotificationSetting();
  if (exactAlarmPermission.exact_alarm === 'granted') return true;

  await LocalNotifications.changeExactNotificationSetting();
  const updatedExactAlarmPermission = await LocalNotifications.checkExactNotificationSetting();
  return updatedExactAlarmPermission.exact_alarm === 'granted';
}

function notificationId(taskId: string, usedIds: Set<number>): number {
  let hash = 2166136261;
  for (let index = 0; index < taskId.length; index++) {
    hash ^= taskId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  let id = (hash >>> 0) & 0x7fffffff;
  while (usedIds.has(id)) id = (id + 1) & 0x7fffffff;
  usedIds.add(id);
  return id;
}

async function reconcileTaskReminders(tasks: Task[]): Promise<boolean> {
  if (!isAndroidNative()) return true;

  const pending = await LocalNotifications.getPending();
  const managedNotifications = pending.notifications.filter(
    (notification) => notification.extra?.source === REMINDER_SOURCE
  );
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') {
    if (managedNotifications.length) {
      await LocalNotifications.cancel({
        notifications: managedNotifications.map(({ id }) => ({ id })),
      });
    }
    return false;
  }

  const exactAlarmPermission = await LocalNotifications.checkExactNotificationSetting();
  const canScheduleExactAlarms = exactAlarmPermission.exact_alarm === 'granted';
  const now = Date.now();
  const reminders = tasks
    .filter((task) => !task.completed && !task.isSubheading && !task.reminderFired && task.reminderAt)
    .map((task) => ({ task, at: new Date(task.reminderAt!).getTime() }))
    .filter(({ at }) => Number.isFinite(at) && at > now)
    .sort((a, b) => a.task.id.localeCompare(b.task.id));
  const usedIds = new Set<number>();

  const notifications: LocalNotificationSchema[] = reminders.map(({ task, at }) => ({
    id: notificationId(task.id, usedIds),
    title: `Reminder: ${task.name}`,
    body: `${task.dueDate ? `Due ${task.dueDate} • ` : ''}Importance ${task.importance}/5`,
    schedule: {
      at: new Date(at),
      allowWhileIdle: true,
      isExactNotification: canScheduleExactAlarms,
    },
    actionTypeId: TASK_REMINDER_ACTION_TYPE,
    extra: { source: REMINDER_SOURCE, taskId: task.id },
  }));

  const notificationsByTaskId = new Map(
    notifications.map((notification) => [notification.extra.taskId as string, notification])
  );
  const retainedTaskIds = new Set<string>();
  const obsoleteNotifications = managedNotifications.filter((pendingNotification) => {
    const taskId = pendingNotification.extra?.taskId;
    const desired = typeof taskId === 'string' ? notificationsByTaskId.get(taskId) : undefined;
    const matchesDesired =
      desired &&
      !retainedTaskIds.has(taskId) &&
      desired.id === pendingNotification.id &&
      desired.title === pendingNotification.title &&
      desired.body === pendingNotification.body &&
      desired.schedule?.at?.getTime() ===
        (pendingNotification.schedule?.at
          ? new Date(pendingNotification.schedule.at).getTime()
          : undefined);
    if (matchesDesired) {
      retainedTaskIds.add(taskId);
      return false;
    }
    return true;
  });

  if (obsoleteNotifications.length) {
    await LocalNotifications.cancel({
      notifications: obsoleteNotifications.map(({ id }) => ({ id })),
    });
  }

  const notificationsToSchedule = notifications.filter(
    (notification) => !retainedTaskIds.has(notification.extra.taskId)
  );
  if (notificationsToSchedule.length) {
    const result = await LocalNotifications.schedule({ notifications: notificationsToSchedule });
    if (result.warning) {
      console.warn('Android reminders may be delayed:', result.warning.message);
    }
  }
  if (!canScheduleExactAlarms && notifications.length) {
    console.warn(
      'Android exact-alarm permission is disabled; reminders may be delayed. Enable Alarms & reminders for Lists in Android settings.'
    );
  }
  return canScheduleExactAlarms || notifications.length === 0;
}

export function synchronizeAndroidReminders(tasks: Task[]): Promise<boolean> {
  const next = reconciliationQueue.then(() => reconcileTaskReminders(tasks));
  reconciliationQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}
