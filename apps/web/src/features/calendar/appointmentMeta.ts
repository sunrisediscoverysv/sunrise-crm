import type { Appointment } from '@/types/database'

export type AppointmentType = Appointment['appointment_type']
export type AppointmentStatus = Appointment['status']

export const TYPE_LABEL: Record<AppointmentType, string> = {
  visit: 'Visita',
  call: 'Llamada',
  meeting: 'Reunión',
  signing: 'Firma',
  follow_up: 'Seguimiento',
  other: 'Otro',
}

// Color por tipo de cita — usado para el chip en el calendario
export const TYPE_COLOR: Record<AppointmentType, string> = {
  visit: '#03a5af', // brand-teal
  call: '#6366f1', // indigo
  meeting: '#f59e0b', // amber
  signing: '#10b981', // emerald
  follow_up: '#ec4899', // pink
  other: '#64748b', // slate
}

export const TYPE_OPTIONS = (Object.keys(TYPE_LABEL) as AppointmentType[]).map(value => ({
  value,
  label: TYPE_LABEL[value],
}))

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: 'Agendada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No asistió',
}

export const STATUS_COLOR: Record<AppointmentStatus, string> = {
  scheduled: '#03a5af',
  completed: '#10b981',
  cancelled: '#94a3b8',
  no_show: '#ef4444',
}

export const STATUS_OPTIONS = (Object.keys(STATUS_LABEL) as AppointmentStatus[]).map(value => ({
  value,
  label: STATUS_LABEL[value],
}))
