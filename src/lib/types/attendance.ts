export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface AttendanceRecord {
  studentId: string;
  date: string; // Format: YYYY-MM-DD
  status: AttendanceStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAttendanceDTO {
  studentId: string;
  date: string;
  status: AttendanceStatus;
  notes?: string;
}

export interface AuthSignUpDTO {
  email: string;
  password: string;
  name?: string;
}

export interface AuthSignInDTO {
  email: string;
  password: string;
}
