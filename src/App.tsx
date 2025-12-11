import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { publicRoutes } from './routes';
import { Fragment } from 'react/jsx-runtime';
import { ToastContainer } from 'react-toastify';
import DefaultLayout from './components/layout/DefaultLayout/DefaultLayout';
import { useEffect, useState } from 'react';
import { auth } from './firebase/firebaseConfig';
import type { User } from 'firebase/auth';

function App() {
    const [user, setUser] = useState<User | null>(null);
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
            setUser(currentUser);
        });

        return () => unsubscribe(); // cleanup on unmount
    }, []);
    return (
        <Router>
            <div className="App">
                <Routes>
                    {publicRoutes.map((route, index) => {
                        // if we have layout => we pick layout (we define it in routes)
                        // if layout = null => we use Fragment (empty tag)
                        // else we use default layout (include Header)

                        // let Layout = route.layout;
                        // if (Layout === null) {
                        //     Layout = Fragment;
                        // } else if (!Layout) {
                        //     Layout = DefaultLayout;
                        // }

                        let Layout = route.layout ? route.layout : route.layout === null ? Fragment : DefaultLayout; // This line is same above but shorter

                        const Page = route.component;

                        return (
                            <Route
                                key={index}
                                path={route.path}
                                element={
                                    <Layout>
                                        <Page />
                                    </Layout>
                                }
                            />
                        );
                    })}
                </Routes>

                <ToastContainer />
            </div>
        </Router>
    );
}

export default App;
