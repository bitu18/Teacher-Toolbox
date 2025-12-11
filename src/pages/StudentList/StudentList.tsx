import { useEffect, useState } from 'react';
import { getStudents, deleteStudent, updateStudent } from '../../api-services/StudentsService';
import './StudentList.scss';
import { toast } from 'react-toastify';

const StudentList = () => {
    type Student = {
        id: string;
        firstname: string;
        lastname: string;
        email: string;
        age: number;
        gender: string;
        major: string;
    };
    const [studentdata, setStudentData] = useState<Student[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newStudent, setNewStudent] = useState<Student>({
        id: '',
        firstname: '',
        lastname: '',
        email: '',
        age: 18,
        gender: '',
        major: '',
    });

    useEffect(() => {
        const fetchAPI = async () => {
            const data = await getStudents();

            if (data) {
                const results = Object.entries(data.students).map(([id, student]) => ({
                    id,
                    ...(student as Omit<Student, 'id'>),
                }));

                setStudentData(results);
                console.log(results);
            }
        };

        fetchAPI();
    }, []);

    const handleDelete = async (id: string) => {
        try {
            if (!window.confirm('Are you sure you want to delete this student?')) return;
            await deleteStudent(id);

            // Refresh UI
            setStudentData(studentdata.filter((s) => s.id !== id));
            toast.success('Student deleted successfully.', { position: 'bottom-right', autoClose: 3000 });
        } catch (error) {
            console.error('Error delete user: ', error);
            toast.error('Failed to delete student. Please try again.', {
                position: 'bottom-right',
                autoClose: 3000,
            });
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        try {
            e.preventDefault();
            if (!currentStudent) return;

            await updateStudent(currentStudent.id, {
                firstname: currentStudent.firstname,
                lastname: currentStudent.lastname,
                email: currentStudent.email,
                gender: currentStudent.gender,
                major: currentStudent.major,
            });

            // Refresh list
            setStudentData(studentdata.map((s) => (s.id === currentStudent.id ? currentStudent : s)));

            closeEdit();
            toast.success('Student updated successfully.', { position: 'bottom-right', autoClose: 3000 });
        } catch (error) {
            console.error('Error update user: ', error);
            toast.error('Failed to update student. Please try again.', {
                position: 'bottom-right',
                autoClose: 3000,
            });
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateStudent(newStudent.id, newStudent);
            setStudentData([...studentdata, newStudent]);

            closeCreate();
            toast.success('Student created successfully.', {
                position: 'bottom-right',
                autoClose: 3000,
            });
        } catch (error) {
            console.error('Error creating student:', error);
            toast.error('Failed to create student.', {
                position: 'bottom-right',
                autoClose: 3000,
            });
        }
    };

    const openEdit = (student: Student) => {
        setCurrentStudent(student);
        setIsEditing(true);
    };

    const closeEdit = () => {
        setIsEditing(false);
        setCurrentStudent(null);
    };

    const openCreate = () => {
        setIsCreating(true);
    };

    const closeCreate = () => {
        setIsCreating(false);
        setNewStudent({
            id: '',
            firstname: '',
            lastname: '',
            email: '',
            age: 18,
            gender: '',
            major: '',
        });
    };
    return (
        <div className="studentList__container">
            <h2 className="studentList__title">List of Students</h2>
            <button className="btn btn-lg me-3 btn--custom" onClick={openCreate}>
                Create a new student
            </button>

            {isEditing && currentStudent && (
                <div className="overlay">
                    <div className="editModal">
                        <h3 className="studentList__title">Edit Student</h3>

                        <form onSubmit={handleUpdate} className="editForm">
                            <label>First Name</label>
                            <input
                                type="text"
                                value={currentStudent.firstname}
                                onChange={(e) => setCurrentStudent({ ...currentStudent, firstname: e.target.value })}
                                required
                            />

                            <label>Last Name</label>
                            <input
                                type="text"
                                value={currentStudent.lastname}
                                onChange={(e) => setCurrentStudent({ ...currentStudent, lastname: e.target.value })}
                                required
                            />

                            <label>Email</label>
                            <input
                                type="email"
                                value={currentStudent.email}
                                onChange={(e) => setCurrentStudent({ ...currentStudent, email: e.target.value })}
                                required
                            />

                            <label>Gender</label>
                            <input
                                type="text"
                                value={currentStudent.gender}
                                onChange={(e) => setCurrentStudent({ ...currentStudent, gender: e.target.value })}
                                required
                            />

                            <label>Major</label>
                            <input
                                type="text"
                                value={currentStudent.major}
                                onChange={(e) => setCurrentStudent({ ...currentStudent, major: e.target.value })}
                                required
                            />

                            <div className="modalButtons">
                                <button type="submit" className="btn btn-success btn-lg">
                                    Save
                                </button>
                                <button type="button" onClick={closeEdit} className="btn btn-secondary btn-lg ms-3">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isCreating && (
                <div className="overlay">
                    <div className="editModal">
                        <h3 className="studentList__title">Create New Student</h3>

                        <form onSubmit={handleCreate} className="editForm">
                            <label>Student ID</label>
                            <input
                                type="text"
                                value={newStudent.id}
                                onChange={(e) => setNewStudent({ ...newStudent, id: e.target.value })}
                                required
                            />

                            <label>First Name</label>
                            <input
                                type="text"
                                value={newStudent.firstname}
                                onChange={(e) => setNewStudent({ ...newStudent, firstname: e.target.value })}
                                required
                            />

                            <label>Last Name</label>
                            <input
                                type="text"
                                value={newStudent.lastname}
                                onChange={(e) => setNewStudent({ ...newStudent, lastname: e.target.value })}
                                required
                            />

                            <label>Email</label>
                            <input
                                type="email"
                                value={newStudent.email}
                                onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                                required
                            />

                            <label>Age</label>
                            <input
                                type="number"
                                value={newStudent.age}
                                onChange={(e) => setNewStudent({ ...newStudent, age: Number(e.target.value) })}
                                required
                            />

                            <label>Gender</label>
                            <input
                                type="text"
                                value={newStudent.gender}
                                onChange={(e) => setNewStudent({ ...newStudent, gender: e.target.value })}
                                required
                            />

                            <label>Major</label>
                            <input
                                type="text"
                                value={newStudent.major}
                                onChange={(e) => setNewStudent({ ...newStudent, major: e.target.value })}
                                required
                            />

                            <div className="modalButtons">
                                <button type="submit" className="btn btn-success btn-lg">
                                    Create
                                </button>
                                <button type="button" onClick={closeCreate} className="btn btn-secondary btn-lg ms-3">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <table className="table table-striped">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Email</th>
                        <th>Firstname</th>
                        <th>Lastname</th>
                        <th>Gender</th>
                        <th>Major</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {studentdata.map((student) => (
                        <tr key={student.id} className="py-3">
                            <td>{student.id}</td>
                            <td>{student.email}</td>
                            <td>{student.firstname}</td>
                            <td>{student.lastname}</td>
                            <td>{student.gender}</td>
                            <td>{student.major}</td>
                            <td className="studentList__action">
                                <button
                                    className="btn btn-success btn-lg me-3 btn--edit"
                                    onClick={() => openEdit(student)}
                                >
                                    Edit
                                </button>
                                <button
                                    className="btn btn-danger btn-lg btn--delete"
                                    onClick={() => handleDelete(student.id)}
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default StudentList;
