import { getDatabase, ref, set, update, remove, get } from 'firebase/database';

export type AttendanceStatus = 'P' | 'A' | 'T' | null;

//save all attendance for a date
export const saveAttendanceForDate = async (date: string, attendanceData: Record<string, AttendanceStatus>) => {
    try {
        const db = getDatabase();
        await set(ref(db, `attendance/${date}`), attendanceData);
    } catch (error) {
        console.error('Error saving attendance:', error);
        throw error;
    }
};

//get attendance
export const getAttendanceForDate = async (date: string) => {
    try {
        const db = getDatabase();
        const snapshot = await get(ref(db, `attendance/${date}`));

        if (!snapshot.exists()) return null;

        return snapshot.val();
    } catch (error) {
        console.error('Error fetching attendance:', error);
        return null;
    }
};

//update single student attendance
export const updateStudentAttendance = async (date: string, studentID: string, status: AttendanceStatus) => {
    try {
        const db = getDatabase();
        await update(ref(db, `attendance/${date}`), {
            [studentID]: status,
        });
    } catch (error) {
        console.error('Error updating student attendance:', error);
        throw error;
    }
};

//clear attendance for a date
export const clearAttendanceForDate = async (date: string) => {
    try {
        const db = getDatabase();
        await remove(ref(db, `attendance/${date}`));
    } catch (error) {
        console.error('Error clearing attendance:', error);
        throw error;
    }
};
