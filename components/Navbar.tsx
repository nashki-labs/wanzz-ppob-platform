
import React from 'react';
import { User } from '../types';

interface NavbarProps {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ user, onLogin, onLogout }) => {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);

  return (
    <nav className="sticky top-0 z-50 glass-card px-3 md:px-4 py-2.5 md:py-3 flex justify-between items-center shadow-lg border-b border-slate-800">
      <div className="flex items-center gap-2">
        <div className="bg-blue-600 p-1.5 md:p-2 rounded-lg shadow-lg shadow-blue-500/20">
          <i className="fas fa-crown text-white text-xs md:text-base"></i>
        </div>
        <span className="text-base md:text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 tracking-tight truncate max-w-[120px] md:max-w-none">
          Wanzz PPOB
        </span>
      </div>

      <div className="flex items-center gap-4">
        {user ? (
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Saldo Anda</span>
              <span className="text-sm font-black text-blue-400">
                Rp {user.balance.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="relative">
              <img
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.name}`}
                alt="Avatar"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-10 h-10 rounded-full border-2 border-blue-500 cursor-pointer hover:scale-105 transition-transform"
              />
              {isDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                  <div className="absolute right-0 top-12 w-48 glass-card rounded-2xl p-2 animate-fade-in shadow-2xl border border-slate-700 z-20">
                    <div className="p-3 border-b border-slate-700 mb-2">
                      <p className="text-sm font-bold truncate text-white">{user.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => { setIsDropdownOpen(false); onLogout(); }}
                      className="w-full text-left p-3 text-sm text-red-400 hover:bg-red-500/10 rounded-xl transition-colors font-semibold"
                    >
                      <i className="fas fa-sign-out-alt mr-2"></i> Keluar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={onLogin}
            className="primary-gradient px-6 py-2.5 rounded-full text-xs font-black hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95"
          >
            <i className="fab fa-google"></i>
            LOGIN / DAFTAR
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
