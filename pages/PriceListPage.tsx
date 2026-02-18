
import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { api } from '../services/api';

const PriceListPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const json = await api.transaction.getProducts();
        setProducts(json.data || []);
      } catch (err) {
        console.error("Gagal memuat produk:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.provider.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-slate-400 text-xs font-medium">Informasi harga produk terupdate hari ini.</p>
        </div>
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Cari produk..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 pl-10 text-xs focus:border-blue-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
        </div>
      </div>

      <div className="glass-card rounded-[2rem] border border-slate-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-slate-900/50 border-b border-slate-800">
              <tr>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Produk</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">SKU</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Harga</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-24">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                      <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.3em]">Syncing Price Data...</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.length > 0 ? (
                filtered.map(p => (
                  <tr key={p.code} className="hover:bg-blue-600/5 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">{p.name}</p>
                      <p className="text-[9px] text-slate-400 uppercase font-black">{p.provider}</p>
                    </td>
                    <td className="px-6 py-4 font-mono text-[10px] text-blue-400/70">{p.code}</td>
                    <td className="px-6 py-4 text-right font-black text-sm text-slate-100">Rp {p.price.toLocaleString('id-ID')}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase border ${p.available ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                        {p.available ? 'Ready' : 'Off'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-center py-20 text-xs text-slate-600 italic">
                    Tidak ada produk yang ditemukan dengan kata kunci "{searchTerm}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-3 p-6 bg-blue-600/5 border border-blue-500/10 rounded-2xl">
        <i className="fas fa-info-circle text-blue-500"></i>
        <p className="text-[10px] text-blue-300 font-medium">Harga di atas adalah harga real-time yang diambil langsung dari sistem pusat pusat.</p>
      </div>
    </div>
  );
};

export default PriceListPage;
