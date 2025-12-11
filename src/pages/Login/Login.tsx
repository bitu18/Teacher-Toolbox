import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import routesConfig from '../../config/routes';
import { auth } from '../../firebase/firebaseConfig';
import { toast } from 'react-toastify';
import '../../components/layout/LoginOrSignupLayout/LoginOrSignupLayout.scss';

function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async () => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            if (!user.emailVerified) {
                toast.warning('Please verify your email by checking your mailbox before logging in.', {
                    position: 'bottom-right',
                    autoClose: 3000,
                });
                await auth.signOut();
                return;
            }
            navigate(routesConfig.home, { replace: true });
            toast.success('Logged in successfully!', { position: 'bottom-right', autoClose: 3000 });
        } catch (error) {
            console.error('Error logging in user: ', error);
            toast.error('Failed to log in. Please check your email or password and try again.', {
                position: 'bottom-right',
                autoClose: 3000,
            });
        }
    };

    const handleResetPassword = async () => {
        if (!email) {
            toast.warning('Please enter your email address to reset your password.', {
                position: 'bottom-right',
                autoClose: 3000,
            });
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            toast.success('Password reset email sent! Please check your inbox.', {
                position: 'bottom-right',
                autoClose: 3000,
            });
        } catch (error) {
            console.error('Error sending password reset email:', error);
            toast.error('Failed to send reset email. Please check your email address.', {
                position: 'bottom-right',
                autoClose: 3000,
            });
        }
    };
    return (
        <>
            <h2 className="login__title">Login</h2>

            <div className="form-group">
                <label htmlFor="email" style={{ fontSize: '1.6rem' }}>
                    Email
                </label>
                <input
                    value={email}
                    type="type"
                    className="form-control"
                    id="email"
                    onChange={(e) => setEmail(e.target.value)}
                />
            </div>

            <div className="form-group">
                <label htmlFor="password" style={{ fontSize: '1.6rem' }}>
                    Password
                </label>
                <input
                    value={password}
                    type="password"
                    className="form-control"
                    id="password"
                    onChange={(e) => setPassword(e.target.value)}
                />
            </div>

            <div className="login__btn login__forgot">
                <button type="button" className="btn btn--forgot" onClick={handleResetPassword}>
                    Forgot password?
                </button>
            </div>

            <div className="login__wrapper--btn">
                <button type="submit" className="btn--submit" onClick={handleSubmit}>
                    Submit
                </button>
            </div>

            <div className="login__btn login__switch-register">
                <NavLink to={routesConfig.register} className="btn btn--register">
                    Don't have an account? <span>Register</span>
                </NavLink>
            </div>
        </>
    );
}

export default Login;
