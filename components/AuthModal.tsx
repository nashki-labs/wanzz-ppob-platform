
import React, { useState } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: User, token: string) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const body = mode === 'login'
        ? { email, password }
        : { name, email, phone, password };

      const data = mode === 'login'
        ? await api.auth.login(body)
        : await api.auth.register(body);

      if (data.status === 'success') {
        onAuthSuccess(data.user, data.token);
        onClose();
      } else {
        setError(data.message || 'Terjadi kesalahan.');
      }
    } catch (err: any) {
      setError(err.message || 'Gagal terhubung ke server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
      <div className="glass-card w-full max-w-md rounded-[2.5rem] p-10 border border-blue-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl"></div>

        {!isLoading ? (
          <>
            <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors">
              <i className="fas fa-times text-lg"></i>
            </button>

            <div className="text-center relative z-10">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
                <i className="fas fa-shield-halved text-2xl text-white"></i>
              </div>
              <h2 className="text-2xl font-black mb-1 tracking-tighter">
                {mode === 'login' ? 'Selamat Datang' : 'Mulai Sekarang'}
              </h2>
              <p className="text-slate-400 text-xs mb-8 font-medium">
                {mode === 'login' ? 'Masuk ke akun Wanzz PPOB Anda' : 'Lengkapi data untuk daftar akun baru'}
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[10px] font-bold uppercase tracking-widest">
                  <i className="fas fa-circle-exclamation mr-2"></i> {error}
                </div>
              )}

              <form className="space-y-4 text-left" onSubmit={handleAuthAction}>
                {mode === 'register' && (
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Nama Lengkap</label>
                    <input
                      type="text" required value={name} onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-5 py-3.5 focus:border-blue-500 outline-none text-xs transition-all"
                      placeholder="Contoh: Budi Santoso"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Email Address</label>
                  <input
                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-5 py-3.5 focus:border-blue-500 outline-none text-xs transition-all"
                    placeholder="nama@email.com"
                  />
                </div>

                {mode === 'register' && (
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Nomor Handphone</label>
                    <input
                      type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-5 py-3.5 focus:border-blue-500 outline-none text-xs transition-all"
                      placeholder="0812xxxxxx"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Password</label>
                  <input
                    type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-5 py-3.5 focus:border-blue-500 outline-none text-xs transition-all"
                    placeholder="••••••••"
                  />
                </div>

                <button className="w-full primary-gradient py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-blue-600/20 active:scale-95 transition-all mt-4">
                  {mode === 'login' ? 'Masuk ke Akun' : 'Daftar Sekarang'}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-slate-800">
                <p className="text-xs text-slate-400 font-medium">
                  {mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}
                  <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} className="text-blue-400 font-black ml-1 hover:underline">
                    {mode === 'login' ? 'Daftar' : 'Login'}
                  </button>
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 animate-fade-in">
            <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-6"></div>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] animate-pulse">Verifikasi Data...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthModal;
