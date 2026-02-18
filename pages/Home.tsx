
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES } from '../constants';
import { Product } from '../types';
import { api } from '../services/api';
import Skeleton from '../components/Skeleton';


const Home: React.FC = () => {
  const navigate = useNavigate();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const json = await api.transaction.getProducts();
        setAllProducts(json.data || []);
      } catch (err) {
        console.error("Gagal memuat produk:", err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="animate-fade-in space-y-8 md:space-y-12 pb-40">
      {/* HERO BANNER */}
      <section className="relative overflow-hidden rounded-3xl h-48 md:h-[400px] border border-slate-800">
        <img
          src="https://files.catbox.moe/f4olg3.jpg"
          className="w-full h-full object-cover"
          alt="Banner"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/40 to-transparent flex items-center px-6 md:px-12">
          <div className="max-w-md">
            <h1 className="text-2xl md:text-5xl font-black text-white leading-tight mb-2 md:mb-4">
              PPOB <span className="text-blue-500">TERMURAH</span> INDONESIA
            </h1>
            <p className="text-[10px] md:text-sm text-slate-300 font-medium mb-4 md:mb-8">
              Top up game, pulsa, dan tagihan otomatis 24 jam dengan harga agen terpercaya.
            </p>
            <button
              onClick={() => navigate('/category/All')}
              className="px-6 py-2.5 md:px-10 md:py-4 bg-blue-600 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
            >
              Cek Produk
            </button>
          </div>
        </div>
      </section>

      {/* CATEGORIES GRID - RESPONSIVE */}
      <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight">Kategori Layanan</h2>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-6">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => navigate(`/category/${cat.id}`)}
              className="glass-card p-4 md:p-8 rounded-2xl md:rounded-[2rem] border border-slate-800 hover:border-blue-500 transition-all flex flex-col items-center group"
            >
              <div className="w-10 h-10 md:w-16 md:h-16 bg-slate-900 rounded-xl md:rounded-2xl flex items-center justify-center mb-3 md:mb-4 group-hover:scale-110 transition-transform border border-slate-800">
                <i className={`fas ${cat.icon} text-sm md:text-2xl text-blue-400`}></i>
              </div>
              <span className="text-[8px] md:text-[10px] font-black text-slate-300 group-hover:text-blue-400 tracking-wider uppercase text-center">{cat.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* TRENDING PRODUCTS */}
      <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight">Layanan Terlaris</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {isLoading ? (
            [1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="glass-card p-5 md:p-6 rounded-2xl border border-slate-800 flex flex-col justify-between h-[180px]">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <Skeleton className="w-12 h-3" />
                  </div>
                  <Skeleton className="w-full h-4" />
                </div>
                <div className="flex justify-between items-end mt-6">
                  <div className="space-y-2">
                    <Skeleton className="w-10 h-2" />
                    <Skeleton className="w-20 h-6" />
                  </div>
                  <Skeleton className="w-10 h-10 rounded-xl" />
                </div>
              </div>
            ))
          ) : (
            allProducts
              .filter(p => {
                const name = p.name.toLowerCase();
                const keywords = ['diamond', 'mlbb', 'ff', 'pubg', 'genshin', 'pulsa', 'pln', 'dana'];
                return keywords.some(k => name.includes(k));
              })
              .slice(0, 8)
              .map((p) => (
                <div key={p.code} className="glass-card p-5 md:p-6 rounded-2xl border border-slate-800 flex flex-col justify-between hover:border-blue-500/50 transition-all group h-[180px]">
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="text-[8px] font-black bg-blue-600/10 text-blue-400 px-2 py-0.5 rounded uppercase tracking-widest">{p.provider}</span>
                      {p.name.toLowerCase().includes('diamond') && <i className="fas fa-gem text-blue-400 text-[10px] animate-pulse"></i>}
                    </div>
                    <h3 className="font-bold text-slate-100 text-xs md:text-sm mt-3 line-clamp-2 leading-tight group-hover:text-blue-400 transition-colors uppercase">{p.name}</h3>
                  </div>
                  <div className="flex justify-between items-end mt-6">
                    <div>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mb-1">Mulai Dari</p>
                      <p className="text-lg font-black text-white">Rp {p.price.toLocaleString('id-ID')}</p>
                    </div>
                    <button
                      onClick={() => navigate(`/category/${p.category || 'All'}`)}
                      className="w-10 h-10 bg-slate-800/50 rounded-xl flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white transition-all shadow-lg hover:shadow-blue-600/20"
                    >
                      <i className="fas fa-arrow-right text-xs"></i>
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>

      </section>
    </div>
  );
};

export default Home;
