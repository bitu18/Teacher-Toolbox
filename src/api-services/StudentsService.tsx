import { getDatabase, ref, remove, update, set } from 'firebase/database';
import * as httpRequest from '../untils/httpResquest';

export const getStudents = async () => {
    try {
        const res = await httpRequest.get('/.json');
        return res;
    } catch (error) {
        console.error('Error fetching students:', error);
        return null;
    }
};

export const createStudent = async (id: string, data: any) => {
    try {
        const db = getDatabase();

        await set(ref(db, `students/${id}`), data);
    } catch (error) {
        console.error('Error creating student:', error);
        throw error;
    }
};

export const deleteStudent = async (id: string) => {
    const db = getDatabase();
    await remove(ref(db, `students/${id}`));
};

export const updateStudent = async (id: string, data: any) => {
    const db = getDatabase();
    await update(ref(db, `students/${id}`), data);
};
