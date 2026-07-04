export type { ReminderInterval } from './appointment-notification.service';

/** @deprecated Use dispatchAppointmentNotification from appointment-notification-engine.service */
export { dispatchAppointmentNotification as dispatchDualChannelNotification } from './appointment-notification-engine.service';
