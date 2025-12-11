import LoginOrSignupLayout from '../components/layout/LoginOrSignupLayout/LoginOrSignupLayout';
import Assignment from '../pages/Assignment/Assignment';
import CreatePoll from '../pages/CreatePoll/CreatePoll';
import Home from '../pages/Home/Home';
import Login from '../pages/Login/Login';
import Register from '../pages/Register/Register';
import Attendance from '../pages/Attendance/Attendance';
import StudentPicker from '../pages/StudentPicker/StudentPicker';
import TeamGenerator from '../pages/TeamGenerator/TeamGenerator';
import StudentList from '../pages/StudentList/StudentList';
import routesConfig from '../config/routes';
import Profile from '../pages/Profile/Profile';
import Calendar from '../pages/Calendar/Calendar';
import Autoemail from '../pages/AutoEmail/AutoEmail';
import Note from '../pages/Notes/Notes';

// The layout can  see without login
export const publicRoutes = [
    { path: routesConfig.note, component: Note},
    { path: routesConfig.home, component: Home },
    { path: routesConfig.attendance, component: Attendance },
    { path: routesConfig.studentPicker, component: StudentPicker },
    { path: routesConfig.teamGenerator, component: TeamGenerator },
    { path: routesConfig.calendar, component: Calendar },
    { path: routesConfig.createPoll, component: CreatePoll },
    { path: routesConfig.autoemail, component: Autoemail },
    { path: routesConfig.studentList, component: StudentList },
    { path: routesConfig.assignment, component: Assignment },
    { path: routesConfig.login, component: Login, layout: LoginOrSignupLayout },
    { path: routesConfig.register, component: Register, layout: LoginOrSignupLayout },
    { path: routesConfig.profile, component: Profile },
];

// Need to login to see the layout and use the feautures
export const privateRoutes = [];
