import { Link, NavLink, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun as sunLight } from '@fortawesome/free-regular-svg-icons';
import { faUser, faSun as sunDark } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState } from 'react';
import { auth, db } from '../../../../firebase/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import Tippy from '@tippyjs/react/headless';

import './Header.scss';
import images from '../../../../assets/images';
import routesConfig from '../../../../config/routes';

function Header() {
    const navigate = useNavigate();
    const [darkMode, setDarkMode] = useState(false);
    const [showUsername, setShowUsername] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            const user = auth.currentUser;
            console.log('Current user:', user);
            if (!user) {
                setShowUsername('');
                setIsLoading(false);
                return;
            }

            try {
                const docRef = doc(db, 'account', user.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const dataUser = docSnap.data();
                    setShowUsername(dataUser.username || 'No username');
                }
            } catch (error) {
                console.log('Error fetching user:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUser();

        const unsubscribe = auth.onAuthStateChanged(fetchUser);
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (darkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }, [darkMode]);

    const handleToggleTheme = () => {
        setDarkMode((prev) => !prev);
    };

    const handleLogout = async () => {
        try {
            await auth.signOut();
            navigate(routesConfig.login, { replace: true });
        } catch (error) {
            console.error('Error logging out user: ', error);
        }
    };

    return (
        <header className="header">
            <div className="container content">
                <Link className="navbar-brand" to={routesConfig.home}>
                    <img src={images.logo} alt="logo" className="logo" />
                </Link>

                <nav className="navbar-nav mb-2 mb-lg-0 d-flex flex-row header__list">
                    <li className="header__item">
                        <NavLink className="nav-link" to={routesConfig.note}>
                            Notes
                        </NavLink>
                    </li>
                    <li className="header__item">
                        <NavLink className="nav-link" to={routesConfig.studentPicker}>
                            Student Picker
                        </NavLink>
                    </li>
                    <li className="header__item">
                        <NavLink className="nav-link" to={routesConfig.teamGenerator}>
                            Team Generator
                        </NavLink>
                    </li>
                    <li className="header__item">
                        <NavLink className="nav-link" to={routesConfig.calendar}>
                            Calendar
                        </NavLink>
                    </li>
                    <li className="header__item">
                        <NavLink className="nav-link" to={routesConfig.autoemail}>
                            Auto-email
                        </NavLink>
                    </li>
                    <li className="header__item">
                        <NavLink className="nav-link" to={routesConfig.studentList}>
                            Student List
                        </NavLink>
                    </li>
                    <li className="header__item">
                        <NavLink className="nav-link" to={routesConfig.attendance}>
                            Attendance
                        </NavLink>
                    </li>

                </nav>

                <div className="header__right">
                    <div className="header__login">
                        {isLoading ? (
                            <div className="loading-placeholder">Loading...</div> // optional
                        ) : showUsername ? (
                            <div className="d-flex flex-row align-items-center header__user-info">
                                <Tippy
                                    interactive
                                    placement="top"
                                    delay={[0, 700]}
                                    offset={[0, 0]}
                                    render={(attrs) => (
                                        <div className="tippy-box" tabIndex={-1} {...attrs}>
                                            <NavLink to={routesConfig.profile} className="tippy-item">
                                                Profile
                                            </NavLink>
                                            <button className="tippy-item" onClick={handleLogout}>
                                                Logout
                                            </button>
                                        </div>
                                    )}
                                >
                                    <div className="d-flex flex-row align-items-center header__user-info">
                                        <FontAwesomeIcon icon={faUser} className="header__icon-user" />
                                        <h3 className="header__name">{showUsername}</h3>
                                    </div>
                                </Tippy>
                            </div>
                        ) : (
                            <>
                                <NavLink to={routesConfig.login} className="btn btn--login">
                                    Login
                                </NavLink>
                                <NavLink to={routesConfig.register} className="btn btn--register">
                                    Register
                                </NavLink>
                            </>
                        )}
                    </div>

                    <button className="btn" onClick={handleToggleTheme}>
                        <FontAwesomeIcon icon={darkMode ? sunDark : sunLight} className="btn--switch" />
                    </button>
                </div>
            </div>
        </header>
    );
}

export default Header;
