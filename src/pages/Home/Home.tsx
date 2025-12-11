import React from 'react';
import { useNavigate } from 'react-router-dom';
import routesConfig from '../../config/routes';
import './Home.scss';

function Home() {
    const navigate = useNavigate();
    const goTo = (path: string) => {
        navigate(path);
    };

    return (
        <div className="home-container">
            {/* Header Section */}
            <div className="home-header">
                <h1 className="home-title">Teacher Toolbox</h1>
                <p className="home-subtitle">
                    A simple toolkit to help teachers manage notes, students, groups, events, and email in one place.
                </p>
            </div>

            {/*Introduction*/}
            <div className="home-section">
                <h2 className="home-section-title">Welcome!</h2>
                <p className="home-text">
                    This is your starting page. From here, you can quickly jump to the tools - writing class notes,
                    picking students, creating groups, managing your calendar, tracking your student list, managing attendance and sending
                    emails.
                </p>
            </div>

            {/*Feature Cards*/}
            <div className="home-section">
                <h2 className="home-section-title">What You Can Do</h2>

                <div className="home-grid">
                    <div className="home-card" onClick={() => goTo(routesConfig.note)}>
                        <h3 className="home-card-title">Notes</h3>
                        <p className="home-card-text">Write and save notes for reminders or class planning.</p>
                    </div>

                    <div className="home-card" onClick={() => goTo(routesConfig.studentPicker)}>
                        <h3 className="home-card-title">Student Picker</h3>
                        <p className="home-card-text">Randomly pick students so everyone participates fairly.</p>
                    </div>

                    <div className="home-card" onClick={() => goTo(routesConfig.teamGenerator)}>
                        <h3 className="home-card-title">Team Generator</h3>
                        <p>Create project teams or discussion groups automatically.</p>
                    </div>

                    <div className="home-card" onClick={() => goTo(routesConfig.calendar)}>
                        <h3 className="home-card-title">Calendar</h3>
                        <p>Track exams, events, deadlines, and office hours.</p>
                    </div>

                    <div className="home-card" onClick={() => goTo(routesConfig.autoemail)}>
                        <h3 className="home-card-title">Auto-email</h3>
                        <p>Send helpful emails directly to your students.</p>
                    </div>

                    <div className="home-card" onClick={() => goTo(routesConfig.studentList)}>
                        <h3 className="home-card-title">Student List</h3>
                        <p>View all students in a clean, organized list.</p>
                    </div>

                    <div className="home-card" onClick={() => goTo(routesConfig.attendance)}>
                        <h3 className="home-card-title">Attendance</h3>
                        <p>Track who is present, tardy, or absent.</p>
                    </div>
                </div>
            </div>

            {/*Footer Tip*/}
            <div className="home-footer">
                <p>Tip: Start by setting up your student list!</p>
            </div>
        </div>
    );
}
export default Home;
