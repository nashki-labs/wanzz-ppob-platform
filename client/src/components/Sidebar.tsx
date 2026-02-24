
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SUPPORT_WA } from '../constants';

interface SidebarProps {
  isAdmin?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isAdmin }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const menuItems = [
    { id: 'home', path: '/', icon: 'fa-house-chimney', label: 'Dashboard' },
    { id: 'pterodactyl', path: '/pterodactyl', icon: 'fa-server', label: 'Panel Hosting' },
    { id: 'price-list', path: '/price-list', icon: 'fa-tags', label: 'Daftar Harga' },
    { id: 'deposit', path: '/deposit', icon: 'fa-wallet', label: 'Isi Saldo' },
    { id: 'profile', path: '/profile', icon: 'fa-user-circle', label: 'Akun Saya' }
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 h-[calc(100vh-64px)] p-6 border-r border-slate-900 sticky top-16 bg-[#020617]">
      <div className="space-y-1.5">
        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-4 ml-4">Navigasi Utama</p>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(item.path)}
            className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all ${currentPath === item.path
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'
              }`}
          >
            <i className={`fas ${item.icon} text-sm w-5 text-center`}></i>
            <span className="font-bold text-xs">{item.label}</span>
          </button>
        ))}

        {isAdmin && (
          <>
            <p className="text-[10px] text-red-500 font-black uppercase tracking-widest mt-10 mb-4 ml-4">Administrator</p>
            <button
              onClick={() => navigate('/admin')}
              className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all ${currentPath === '/admin'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                : 'text-slate-500 hover:bg-red-500/10 hover:text-red-400'
                }`}
            >
              <i className="fas fa-user-shield text-sm w-5 text-center"></i>
              <span className="font-bold text-xs">Admin Panel</span>
            </button>
          </>
        )}
      </div>

      <div className="mt-10 pt-10 border-t border-slate-900">
        <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-slate-800">
          <p className="text-[9px] text-blue-500 font-black mb-1 uppercase tracking-widest">Layanan CS</p>
          <p className="text-[10px] text-slate-400 font-medium mb-4 leading-relaxed">Kendala transaksi? Tim kami siap membantu.</p>
          <a
            href={`https://wa.me/${SUPPORT_WA}`}
            target="_blank"
            className="block w-full py-3 bg-slate-800 hover:bg-slate-700 text-center rounded-xl text-[9px] font-black uppercase text-white transition-all shadow-xl"
          >
            WhatsApp Support
          </a>
        </div>
      </div>

      <div className="mt-auto pt-6 text-center">
        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-[0.3em]">Wanzz PPOB v1.1.0</p>
      </div>
    </aside>
  );
};

export default Sidebar;
