
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import CategoryPage from './pages/CategoryPage';
import DepositPage from './pages/DepositPage';
import PriceListPage from './pages/PriceListPage';
import AdminDashboard from './components/AdminDashboard';
import AuthModal from './components/AuthModal';
import ChatWidget from './components/ChatWidget';
import { User } from './types';
import { api } from './services/api';
import ProfilePage from './pages/ProfilePage';
import PterodactylPage from './pages/PterodactylPage';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: verify JWT token with server
  useEffect(() => {
    const verifySession = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await api.auth.me();
        if (data.status === 'success') {
          setUser(data.user);
        } else {
          localStorage.removeItem('auth_token');
        }
      } catch {
        localStorage.removeItem('auth_token');
      } finally {
        setIsLoading(false);
      }
    };
    verifySession();
  }, []);

  const handleAuthSuccess = (newUser: User, token: string) => {
    setUser(newUser);
    localStorage.setItem('auth_token', token);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('auth_token');
  };

  const refreshUser = async () => {
    try {
      const data = await api.auth.me();
      if (data.status === 'success') {
        setUser(data.user);
      }
    } catch { /* silence */ }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-6"></div>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Memuat...</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-[100dvh] flex flex-col bg-[#020617] selection:bg-blue-500 selection:text-white relative overflow-x-hidden">
        <Navbar
          user={user}
          onLogin={() => setIsAuthModalOpen(true)}
          onLogout={handleLogout}
        />

        <div className="flex flex-1 relative">
          <Sidebar isAdmin={user?.role === 'admin'} />

          <main className="flex-1 w-full overflow-x-hidden">
            <div className="max-w-7xl mx-auto p-4 md:p-8 pb-40 lg:pb-8">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/category/:categoryName" element={<CategoryPageWrapper user={user} refreshUser={refreshUser} />} />
                <Route path="/price-list" element={<PriceListPage />} />
                <Route path="/deposit" element={<DepositPage user={user} onRefreshUser={refreshUser} />} />
                <Route path="/pterodactyl" element={<PterodactylPage user={user} refreshUser={refreshUser} />} />
                <Route path="/profile" element={
                  user ? (
                    <ProfilePage
                      user={user}
                      setIsAuthModalOpen={setIsAuthModalOpen}
                      refreshUser={refreshUser}
                      onLogout={handleLogout}
                    />
                  ) : (
                    <div className="text-center py-20 glass-card rounded-[2rem] border border-slate-800">
                      <i className="fas fa-lock text-4xl text-slate-800 mb-6"></i>
                      <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Silakan login untuk melihat profil.</p>
                      <button onClick={() => setIsAuthModalOpen(true)} className="mt-6 px-10 py-4 bg-blue-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all">Login Sekarang</button>
                    </div>
                  )
                } />
                <Route path="/admin" element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </main>
        </div>

        <ChatWidget user={user} />
        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} onAuthSuccess={handleAuthSuccess} />

        {/* MOBILE BOTTOM NAVIGATION */}
        <MobileNav user={user} />
      </div>
    </Router>
  );
};

// Helper component for mobile nav to use router hooks
import { useNavigate, useLocation, useParams } from 'react-router-dom';

const CategoryPageWrapper: React.FC<{ user: User | null, refreshUser: () => Promise<void> }> = ({ user, refreshUser }) => {
  const { categoryName } = useParams<{ categoryName: string }>();
  const navigate = useNavigate();
  return <CategoryPage category={categoryName || 'All'} user={user} onBack={() => navigate('/')} onRefreshUser={refreshUser} />;
};

const MobileNav: React.FC<{ user: User | null }> = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  return (
    <div className="lg:hidden fixed bottom-2 md:bottom-4 left-2 md:left-4 right-2 md:right-4 z-50 animate-fade-in">
      <div className="glass-card border border-white/5 px-3 md:px-6 py-2.5 md:py-3 flex justify-between items-center rounded-2xl md:rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <button onClick={() => navigate('/')} className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${path === '/' ? 'text-blue-400 scale-110' : 'text-slate-100 hover:text-white'}`}>
          <i className={`fas fa-house-chimney text-xl ${path === '/' ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]' : ''}`}></i>
          <span className={`text-[9px] font-black uppercase tracking-wider ${path === '/' ? 'text-blue-400' : 'text-slate-100'}`}>Home</span>
        </button>

        {user?.role === 'admin' ? (
          <button onClick={() => navigate('/admin')} className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${path === '/admin' ? 'text-red-400 scale-110' : 'text-slate-100 hover:text-white'}`}>
            <i className={`fas fa-user-shield text-xl ${path === '/admin' ? 'drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]' : ''}`}></i>
            <span className={`text-[9px] font-black uppercase tracking-wider ${path === '/admin' ? 'text-red-400' : 'text-slate-100'}`}>Admin</span>
          </button>
        ) : (
          <button onClick={() => navigate('/price-list')} className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${path === '/price-list' ? 'text-blue-400 scale-110' : 'text-slate-100 hover:text-white'}`}>
            <i className={`fas fa-tags text-xl ${path === '/price-list' ? 'drop-shadow-[0_0_8_px_rgba(59,130,246,0.6)]' : ''}`}></i>
            <span className={`text-[9px] font-black uppercase tracking-wider ${path === '/price-list' ? 'text-blue-400' : 'text-slate-100'}`}>Price</span>
          </button>
        )}

        <button onClick={() => navigate('/deposit')} className="relative -mt-10 md:-mt-12 group">
          <div className={`p-3.5 md:p-4.5 rounded-xl md:rounded-2xl shadow-2xl border-4 border-[#020617] transition-all duration-500 group-hover:scale-110 group-active:scale-95 ${path === '/deposit' ? 'bg-blue-500 shadow-blue-500/50' : 'bg-blue-600 shadow-blue-600/50'}`}>
            <i className="fas fa-wallet text-white text-lg md:text-2xl"></i>
          </div>
        </button>

        <button onClick={() => navigate('/profile')} className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${path === '/profile' ? 'text-blue-400 scale-110' : 'text-slate-100 hover:text-white'}`}>
          <i className={`fas fa-user-circle text-xl ${path === '/profile' ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]' : ''}`}></i>
          <span className={`text-[9px] font-black uppercase tracking-wider ${path === '/profile' ? 'text-blue-400' : 'text-slate-100'}`}>Akun</span>
        </button>

        <button onClick={() => window.open('https://wa.me/6282320667363')} className="flex flex-col items-center gap-1.5 text-slate-100 transition-all hover:text-green-400">
          <i className="fab fa-whatsapp text-xl"></i>
          <span className="text-[9px] font-black uppercase tracking-wider">CS</span>
        </button>
      </div>
    </div>

  );
}

export default App;
