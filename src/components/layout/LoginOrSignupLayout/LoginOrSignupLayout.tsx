import { useState } from 'react';
import './LoginOrSignupLayout.scss';
import { useLocation, useNavigate } from 'react-router-dom';
import routesConfig from '../../../config/routes';
import Login from '../../../pages/Login/Login';
import Register from '../../../pages/Register/Register';

function LoginOrSignupLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const pathLogin = routesConfig.login;
    const pathRegister = routesConfig.register;
    const isLogin = location.pathname === pathLogin;

    return (
        <div className="login__wrapper">
            <form className="form" onSubmit={(e) => e.preventDefault()}>
                {isLogin ? <Login /> : <Register />}
            </form>
        </div>
    );
}

export default LoginOrSignupLayout;
