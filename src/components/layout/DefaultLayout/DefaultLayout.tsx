import Header from '../components/Header/Header';

function DefaultLayout({ children }: { children: React.ReactNode }) {
    return (
        <div>
            <Header />
            <div className="container" style={{ margin: '20px auto 0 auto' }}>
                {children}
            </div>
        </div>
    );
}

export default DefaultLayout;
