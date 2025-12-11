import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { NavLink, useNavigate } from 'react-router-dom';
import routesConfig from '../../config/routes';
import { ChangeEvent, useState } from 'react';
import { auth, db } from '../../firebase/firebaseConfig';
import { setDoc, doc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import '../../components/layout/LoginOrSignupLayout/LoginOrSignupLayout.scss';

function Register() {
    const navigate = useNavigate();
    const [userData, setUserData] = useState({
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        password: '',
        confirmPassword: '',
    });

    const handleFillForm = (e: ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setUserData((prev) => ({ ...prev, [id]: value }));
    };

    const handleSubmit = async () => {
        const { username, email, firstName, lastName, password, confirmPassword } = userData;

        for (const [key, value] of Object.entries(userData)) {
            if (!value.trim()) {
                toast.error(`Please fill out the ${key} field!`, { position: 'bottom-right', autoClose: 3000 });
                return;
            }
        }

        if (password !== confirmPassword) {
            alert('Passwords do not match!');
            return;
        }

        try {
            // 1. Create user in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Send verification email
            try {
                await sendEmailVerification(user);
                toast.info('Verification email sent! Please check your email before login.', {
                    position: 'bottom-right',
                    autoClose: 4000,
                });
            } catch (emailError) {
                console.error('Failed to send verification email:', emailError);
                toast.error('Failed to send verification email. Try again later.', {
                    position: 'bottom-right',
                    autoClose: 4000,
                });
            }

            // 3. Save to Firestore (optional, non-blocking)
            try {
                await setDoc(doc(db, 'account', user.uid), {
                    username,
                    email: user.email,
                    firstName,
                    lastName,
                    uid: user.uid,
                    createdAt: new Date(),
                });
            } catch (dbError) {
                console.error('Failed to save user in Firestore:', dbError);
                // Don't throw; the user can still verify email and login
            }

            // 4️⃣ Redirect to login
            navigate(routesConfig.login, { replace: true });
        } catch (error: any) {
            if (error.code === 'auth/email-already-in-use') {
                toast.error('This email is already registered. Please login instead.', {
                    position: 'bottom-right',
                    autoClose: 4000,
                });
            } else {
                console.error('Error registering user:', error);
                toast.error('Failed to register user. Please try again.', {
                    position: 'bottom-right',
                    autoClose: 3000,
                });
            }
        }
    };
    return (
        <>
            <h2 className="login__title">Register</h2>

            <div className="form-group">
                <label htmlFor="username" style={{ fontSize: '1.6rem' }}>
                    Username
                </label>
                <input
                    value={userData.username}
                    type="text"
                    className="form-control"
                    id="username"
                    onChange={handleFillForm}
                />
            </div>

            <div className="form-group">
                <label htmlFor="email" style={{ fontSize: '1.6rem' }}>
                    Email
                </label>
                <input
                    value={userData.email}
                    type="email"
                    className="form-control"
                    id="email"
                    onChange={handleFillForm}
                />
            </div>

            <div className="form-group">
                <label htmlFor="firstName" style={{ fontSize: '1.6rem' }}>
                    First Name
                </label>
                <input
                    value={userData.firstName}
                    type="text"
                    className="form-control"
                    id="firstName"
                    onChange={handleFillForm}
                />
            </div>

            <div className="form-group">
                <label htmlFor="lastName" style={{ fontSize: '1.6rem' }}>
                    Last Name
                </label>
                <input
                    value={userData.lastName}
                    type="text"
                    className="form-control"
                    id="lastName"
                    onChange={handleFillForm}
                />
            </div>

            <div className="form-group">
                <label htmlFor="password" style={{ fontSize: '1.6rem' }}>
                    Password
                </label>
                <input
                    value={userData.password}
                    type="password"
                    className="form-control"
                    id="password"
                    onChange={handleFillForm}
                />
            </div>
            <div className="form-group">
                <label htmlFor="confirmPassword" style={{ fontSize: '1.6rem' }}>
                    Confirm Password
                </label>
                <input
                    value={userData.confirmPassword}
                    type="password"
                    className="form-control"
                    id="confirmPassword"
                    onChange={handleFillForm}
                />
            </div>

            <div className="login__wrapper--btn">
                <button type="submit" className="btn--submit" onClick={handleSubmit}>
                    Register
                </button>
            </div>

            <div className="login__btn login__switch-login">
                <NavLink to={routesConfig.login} className="btn btn--register">
                    Already have an account? <span>Login</span>
                </NavLink>
            </div>
        </>
    );
}

export default Register;
