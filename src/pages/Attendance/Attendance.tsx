import React, { useEffect, useState } from 'react';
import { getStudents } from '../../api-services/StudentsService';
import './Attendance.scss';
import { toast } from 'react-toastify'; //toast notifications
import { saveAttendanceForDate, getAttendanceForDate, clearAttendanceForDate, AttendanceStatus, } from '../../api-services/AttendanceService';

type Student = {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
};

export default function Attendance() {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    //selected date and attendance status for each student
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});

    useEffect(() => {
        const fetchStudents = async () => {
            try {
                setLoading(true);
                setError(null);

                const data = await getStudents();
                const studentsObj = data?.students || {};

                const list: Student[] = Object.entries(studentsObj).map(([id, value]: [string, any]) => ({
                    id,
                    firstname: value.firstname,
                    lastname: value.lastname,
                    email: value.email,
                }));

                setStudents(list);
            } catch (err) {
                console.error('Error loading students:', err);
                setError('Failed to load students.');
                toast.error('Failed to load students');
            } finally {
                setLoading(false);
            }
        };

        fetchStudents();
    }, []);

    //when date changes, load previously saved attendance from firebase
    useEffect(() => {
        if (!selectedDate) {
            setAttendance({});
            return;
        }

        const loadAttendance = async() => {
            try {
                const data = await getAttendanceForDate(selectedDate);
                if (data) {
                    setAttendance(data);
                } else {
                    setAttendance({});
                }
            } catch (err) {
                console.error('Error loadiung attendance for date:', err);
                toast.error('Failed to load attendance for this date.');
            }
        };

        loadAttendance();
    }, [selectedDate]);

    //change statuts
    const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
        if (!selectedDate) {
            toast.warn('Please select a date before taking attendance.');
            return;
        }

        setAttendance((prev) => ({
            ...prev,
            [studentId]: status,
        }));
    };

    //save current attendance for selected date to firebase
    const handleSaveAttendance = async () => {
        if (!selectedDate) {
            toast.error('Please select a date before saving attendance.');
            return;
        }

        const hasAnyStatus = Object.values(attendance).some((s) => s !== null && s !== undefined);

        if (!hasAnyStatus) {
            toast.error('Set at least one student status before saving.');
            return;
        }

        try {
            await saveAttendanceForDate(selectedDate, attendance);
            toast.success(`attendance saved for ${selectedDate}.`);
        } catch (err) {
            console.error('Error saving attendance:', err);
            toast.error('Failed to save attendance.');
        }
    };

    //clear current attendance and remove from firebase for this date
    const handleClearAttendance = async () => {
        if (!selectedDate) {
            setAttendance({});
            toast.warn('Selecte a date before clearing attednance.');
            return;
        }

        try {
            await clearAttendanceForDate(selectedDate);
            setAttendance({});
            toast.info('attendance cleared for this date');
        } catch (err) {
            console.error('Error clearing attendance:', err);
            toast.error('Failed to clear attendance.');
        }
    };

    const dateSelected = Boolean(selectedDate);

    return (
        <div className="attendance-container">
            <h2 className="attendance-title">Attendance</h2>

            {/*date selector and buttons row*/}
            <div className="attendance-top-row">
                <div className="attendance-date-group">
                    <label className="attendance-date-label" htmlFor="attendance-date">
                        Date
                    </label>
                    <input
                        id="attendance-date"
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="attendance-date-input"
                    />
                </div>

                {/* save / clear actions */}
                <div className="attendance-buttons">
                    <button
                        type="button"
                        className="btn btn-success btn-lg"
                        onClick={handleSaveAttendance}
                        disabled={!dateSelected}
                    >
                        Save Attendance
                    </button>
                    <button
                        type="button"
                        className="btn btn-danger btn-lg"
                        onClick={handleClearAttendance}
                        disabled={!dateSelected}
                    >
                        Clear
                    </button>
                </div>
            </div>

            {loading && <p>Loading students...</p>}
            {error && <p className="attendance-error">{error}</p>}

            {!loading && !error && students.length === 0 && (
                <p>No students found. Add students before taking attendance.</p>
            )}

            {!loading && !error && students.length > 0 && (
                <div className="attendance-table-wrapper">
                    <table className="table table-striped attendance-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.map((s) => {
                                const status = attendance[s.id] ?? null;

                                return (
                                    <tr key={s.id}>
                                        <td>
                                            {s.firstname} {s.lastname}
                                        </td>
                                        <td>{s.email}</td>
                                        <td className="attendance-status-cell">
                                            {/*Present*/}
                                            <button
                                                type="button"
                                                className={`status-btn present ${status === 'P' ? 'active' : ''}`}
                                                onClick={() => handleStatusChange(s.id, 'P')}
                                                disabled={!dateSelected}
                                            >
                                                Present
                                            </button>

                                            {/*Absent*/}
                                            <button
                                                type="button"
                                                className={`status-btn absent ${status === 'A' ? 'active' : ''}`}
                                                onClick={() => handleStatusChange(s.id, 'A')}
                                                disabled={!dateSelected}
                                            >
                                                Absent
                                            </button>

                                            {/*Tardy*/}
                                            <button
                                                type="button"
                                                className={`status-btn tardy ${status === 'T' ? 'active' : ''}`}
                                                onClick={() => handleStatusChange(s.id, 'T')}
                                                disabled={!dateSelected}
                                            >
                                                Tardy
                                            </button>

                                            {/*button label*/}
                                            <span className="attendance-selected-text">
                                                {status === 'P' && 'Selected: Present'}
                                                {status === 'A' && 'Selected: Absent'}
                                                {status === 'T' && 'Selected: Tardy'}
                                                {status === null && 'Not set'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}