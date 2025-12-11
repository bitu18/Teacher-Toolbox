import { useEffect, useState } from 'react';
import './Profile.scss';
import { auth, db } from '../../firebase/firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { sendPasswordResetEmail, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import routesConfig from '../../config/routes';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare } from '@fortawesome/free-regular-svg-icons';

function Profile() {
    const [userData, setUserData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [fieldName, setFieldName] = useState('');
    const [fieldValue, setFieldValue] = useState('');

    const navigate = useNavigate();

    useEffect(() => {
        const fetchUser = async () => {
            const user = auth.currentUser;
            if (!user) return;

            try {
                const docRef = doc(db, 'account', user.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setUserData(docSnap.data());
                }
            } catch (error) {
                console.log('Error fetching user:', error);
            }

            setLoading(false);
        };

        fetchUser();
    }, []);

    const handleResetPassword = async () => {
        if (!userData.email) {
            toast.warning('No email available to reset.', { position: 'bottom-right' });
            return;
        }

        try {
            await sendPasswordResetEmail(auth, userData.email);
            toast.success('Reset email sent!', { position: 'bottom-right' });

            setTimeout(async () => {
                await auth.signOut();
                navigate(routesConfig.login, { replace: true });
            }, 10000);
        } catch (error) {
            toast.error('Failed to send reset email.');
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        navigate(routesConfig.login, { replace: true });
    };

    // Open Modal
    const openEditModal = (field: string, value: string) => {
        setFieldName(field);
        setFieldValue(value);
        setShowModal(true);
    };

    // Close Modal
    const closeEditModal = () => {
        setShowModal(false);
    };

    // Save Field
    const handleSave = async (e: any) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        try {
            const docRef = doc(db, 'account', user.uid);
            await updateDoc(docRef, { [fieldName]: fieldValue });

            setUserData({ ...userData, [fieldName]: fieldValue });

            toast.success(`Updated ${fieldName} successfully.`, { position: 'bottom-right' });
        } catch (err) {
            toast.error('Failed to update!', { position: 'bottom-right' });
        }

        setShowModal(false);
    };

    if (loading) {
        return <div className="container mt-4 text-center fs-5">Loading profile…</div>;
    }

    if (!userData) {
        return <div className="container mt-4 text-center fs-5">No user data found.</div>;
    }

    return (
        <div className="container mt-4">
            <div className="profile__container">
                <h2 className="text-center mb-4">My Profile</h2>

                {/* EDIT MODAL */}
                {showModal && (
                    <div className="overlay">
                        <div className="editModal">
                            <h3 className="profile__title">Edit {fieldName}</h3>

                            <form onSubmit={handleSave} className="editForm">
                                <label className="profile__fieldname">{fieldName}</label>

                                <input
                                    type="text"
                                    value={fieldValue}
                                    onChange={(e) => setFieldValue(e.target.value)}
                                    required
                                    className="profile__input"
                                />

                                <div className="modalButtons">
                                    <button type="submit" className="btn btn-success btn-lg">
                                        Save
                                    </button>
                                    <button
                                        type="button"
                                        onClick={closeEditModal}
                                        className="btn btn-secondary btn-lg ms-3"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                <div className="card shadow-sm">
                    <div className="card-body">
                        {/* FIRST NAME */}
                        <div className="mb-4 d-flex justify-content-between">
                            <h4 className="profile__title">First name:</h4>
                            <div className="profile__edit--container">
                                <p className="profile__des">{userData.firstName}</p>
                                <button
                                    className="profile__icon--edit"
                                    onClick={() => openEditModal('firstName', userData.firstName)}
                                >
                                    <FontAwesomeIcon icon={faPenToSquare} />
                                </button>
                            </div>
                        </div>

                        {/* LAST NAME */}
                        <div className="mb-4 d-flex justify-content-between">
                            <h4 className="profile__title">Last name:</h4>
                            <div className="profile__edit--container">
                                <p className="profile__des">{userData.lastName}</p>
                                <button
                                    className="profile__icon--edit"
                                    onClick={() => openEditModal('lastName', userData.lastName)}
                                >
                                    <FontAwesomeIcon icon={faPenToSquare} />
                                </button>
                            </div>
                        </div>

                        {/* USERNAME */}
                        <div className="mb-4 d-flex justify-content-between">
                            <h4 className="profile__title">Username:</h4>
                            <div className="profile__edit--container">
                                <p className="profile__des">{userData.username}</p>
                                <button
                                    className="profile__icon--edit"
                                    onClick={() => openEditModal('username', userData.username)}
                                >
                                    <FontAwesomeIcon icon={faPenToSquare} />
                                </button>
                            </div>
                        </div>

                        {/* EMAIL (Not editable) */}
                        <div className="mb-4 d-flex justify-content-between">
                            <h4 className="profile__title">Email:</h4>
                            <p className="profile__des">{userData.email}</p>
                        </div>

                        <div className="d-grid gap-2 mt-4">
                            <button className="btn btn_password--custom" onClick={handleResetPassword}>
                                Change Password
                            </button>
                            <button className="btn btn--custom" onClick={handleLogout}>
                                Log Out
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Profile;
