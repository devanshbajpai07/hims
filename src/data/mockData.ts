import { Patient, Appointment, Doctor, StaffMember } from '../types';

// Deprecated: Aura HIMS is 100% database-driven. All operational data is fetched from the connected PostgreSQL database via authenticated APIs.
export const initialStaff: StaffMember[] = [];
export const initialDoctors: Doctor[] = [];
export const initialPatients: Patient[] = [];
export const initialAppointments: Appointment[] = [];
