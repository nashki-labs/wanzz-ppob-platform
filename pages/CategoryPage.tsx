
import React, { useState, useEffect } from 'react';
import { Product, User } from '../types';
import { api } from '../services/api';
import Skeleton from '../components/Skeleton';


interface CategoryPageProps {
  category: string;
  user: User | null;
  onBack: () => void;
  onRefreshUser: () => Promise<void>;
}

const CategoryPage: React.FC<CategoryPageProps> = ({ category, user, onBack, onRefreshUser }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [targetId, setTargetId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('All');

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const json = await api.transaction.getProducts();
        const allProducts = json.data || [];
        const filtered = allProducts.filter((p: Product) => {
          if (category === 'All') return true;
          const cat = category.toLowerCase();
          const pCat = (p.category || '').toLowerCase();
          const pType = (p.type || '').toLowerCase();
          const pProv = (p.provider || '').toLowerCase();
          const pName = (p.name || '').toLowerCase();

          // Match logic
          const isMatch = pCat.includes(cat) || pType.includes(cat) || pProv.includes(cat) || pName.includes(cat);

          // Special alias for E-Wallet (handle 'ewallet' or 'emoney')
          if (!isMatch && cat === 'e-wallet') {
            return pCat.includes('ewallet') || pType.includes('ewallet') || pName.includes('ewallet') ||
              pCat.includes('e-money') || pCat.includes('emoney') || pType.includes('emoney') || pName.includes('saldo');
          }

          return isMatch;
        });
        setProducts(filtered);
        setSelectedProvider('All'); // Reset provider when category changes
      } catch (err) {
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [category]);

  const providers = ['All', ...Array.from(new Set(products.map(p => p.provider)))].filter(Boolean);

  const handlePurchase = async () => {
    if (!user || !selectedProduct || !targetId) return;

    setIsProcessing(true);
    setStatusMessage(null);

    try {
      const data = await api.transaction.create({
        product_code: selectedProduct.code,
        product_name: selectedProduct.name,
        target: targetId,
        price: selectedProduct.price
      });

      if (data.status === 'success') {
        await onRefreshUser();
        setStatusMessage({ type: 'success', text: `Berhasil! Ref: ${data.reff_id}` });
        setTargetId('');
        setSelectedProduct(null);
      } else {
        setStatusMessage({ type: 'error', text: data.message || 'Gagal memproses transaksi.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Gagal terhubung ke server.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredBySearchAndProvider = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.provider.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProvider = selectedProvider === 'All' || p.provider === selectedProvider;
    return matchesSearch && matchesProvider;
  });

  if (loading) return (
    <div className="animate-fade-in space-y-8">
      <div className="grid lg:grid-cols-12 gap-4 md:gap-8">
        <div className="lg:col-span-8 space-y-4 md:space-y-6">
          <Skeleton className="h-24 md:h-32 w-full rounded-2xl md:rounded-[2rem]" />
          <div className="glass-card p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-slate-800">
            <div className="flex justify-between items-center mb-4 md:mb-8">
              <Skeleton className="h-6 md:h-8 w-32 md:w-48" />
              <Skeleton className="h-8 md:h-10 w-48 md:w-64" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="p-4 rounded-2xl border-2 border-slate-800 bg-slate-950/50 space-y-3">
                  <Skeleton className="h-3 w-2/3" />
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-5 w-5 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="lg:col-span-4">
          <Skeleton className="h-[300px] md:h-[400px] w-full rounded-2xl md:rounded-[2rem]" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in pb-40 overflow-x-hidden">
      <button onClick={onBack} className="mt-4 ml-4 mb-6 font-black uppercase text-[11px] text-slate-300 hover:text-white group flex items-center">
        <i className="fas fa-arrow-left mr-2 group-hover:-translate-x-1 transition-transform text-xs"></i> KEMBALI
      </button>

      <div className="grid lg:grid-cols-12 gap-4 md:gap-8 overflow-x-hidden pb-32">
        <div className="lg:col-span-8 space-y-4 md:space-y-6 min-w-0">
          <div className="glass-card p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-slate-800 w-full overflow-hidden">
            <h3 className="text-lg md:text-xl font-black mb-4 md:mb-5 uppercase flex items-center gap-2 md:gap-3 text-white tracking-tight">
              <span className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs md:text-sm shadow-lg shadow-blue-500/40">1</span>
              Tujuan Transaksi
            </h3>
            <input
              type="text"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              placeholder="Masukkan ID Target / No HP Pengisian"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl md:rounded-2xl px-4 md:px-6 py-3 md:py-4 focus:border-blue-500 outline-none font-black text-lg md:text-xl placeholder:text-slate-700 transition-all"
            />
          </div>

          <div className="glass-card p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-slate-800 w-full overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8 gap-4">
              <h3 className="text-lg md:text-xl font-black uppercase flex items-center gap-2 md:gap-3 text-white tracking-tight">
                <span className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs md:text-sm shadow-lg shadow-blue-500/40">2</span>
                Pilih Layanan
              </h3>
              <div className="relative group">
                <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 text-xs py-3"></i>
                <input
                  type="text" placeholder="Cari produk..."
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full md:w-64 bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none focus:border-blue-500 transition-all text-white placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* PROVIDER FILTER CHIPS */}
            {providers.length > 2 && (
              <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide no-scrollbar">
                {providers.map(prov => (
                  <button
                    key={prov}
                    onClick={() => setSelectedProvider(prov)}
                    className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${selectedProvider === prov
                      ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20'
                      : 'bg-slate-900/50 text-slate-300 border-slate-800 hover:border-slate-700 text-slate-400'
                      }`}
                  >
                    {prov}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto overflow-x-hidden custom-scrollbar no-scrollbar min-w-0">
              {filteredBySearchAndProvider.length === 0 ? (
                <div className="col-span-full py-20 flex flex-col items-center justify-center text-center animate-fade-in">
                  <div className="w-20 h-20 bg-slate-900/50 rounded-[2rem] flex items-center justify-center mb-6 border border-slate-800">
                    <i className="fas fa-box-open text-3xl text-slate-700"></i>
                  </div>
                  <h4 className="text-white font-black uppercase tracking-widest text-sm mb-2">Layanan Tidak Tersedia</h4>
                  <p className="text-slate-500 text-[10px] max-w-[250px] leading-relaxed font-medium uppercase tracking-widest">
                    Maaf, saat ini produk untuk kategori <span className="text-blue-500">{category}</span> sedang tidak tersedia atau dalam pemeliharaan.
                  </p>
                  <button
                    onClick={onBack}
                    className="mt-8 px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all border border-slate-700"
                  >
                    Cek Kategori Lain
                  </button>
                </div>
              ) : filteredBySearchAndProvider.map(p => (
                <button
                  key={p.code}
                  onClick={() => setSelectedProduct(p)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all group overflow-hidden relative ${selectedProduct?.code === p.code
                    ? 'border-blue-500 bg-blue-600/10'
                    : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
                    }`}
                >
                  <p className="font-bold text-[11px] text-slate-200 group-hover:text-blue-400 transition-colors line-clamp-1">{p.name}</p>
                  <div className="flex items-center justify-between mt-3">
                    <p className="font-black text-white text-sm">Rp {p.price.toLocaleString('id-ID')}</p>
                    {selectedProduct?.code === p.code && (
                      <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <i className="fas fa-check text-[10px] text-white"></i>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 min-w-0">
          <div className="glass-card p-5 md:p-8 rounded-2xl md:rounded-[2rem] border border-slate-800 sticky top-24 shadow-2xl overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-3xl pointer-events-none group-hover:bg-blue-600/10 transition-all duration-700"></div>

            <h3 className="text-lg md:text-xl font-black mb-6 md:mb-8 uppercase tracking-tighter flex items-center gap-2">
              <i className="fas fa-shopping-cart text-blue-500 text-sm"></i>
              Ringkasan
            </h3>

            {statusMessage && (
              <div className={`p-4 rounded-2xl mb-6 text-[10px] font-black uppercase tracking-widest border animate-bounce-short ${statusMessage.type === 'success'
                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                {statusMessage.text}
              </div>
            )}

            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                <span className="text-slate-500">Saldo Akun</span>
                <span className="text-blue-400">Rp {user?.balance.toLocaleString('id-ID') || 0}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                <span className="text-slate-500">Total Tagihan</span>
                <span className="text-white">Rp {selectedProduct?.price.toLocaleString('id-ID') || 0}</span>
              </div>
              <div className="h-px bg-slate-800/50 w-full my-4"></div>
              {selectedProduct ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Detail Item:</p>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <p className="text-xs font-bold text-white mb-1">{selectedProduct.name}</p>
                    <p className="text-[10px] text-blue-500 font-black">{selectedProduct.code}</p>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center border-2 border-dashed border-slate-800 rounded-2xl">
                  <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Pilih Produk</p>
                </div>
              )}
            </div>

            <button
              onClick={handlePurchase}
              disabled={isProcessing || !selectedProduct || !targetId}
              className="w-full py-5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 shadow-xl shadow-blue-600/20 text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-30 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  Memproses...
                </>
              ) : (
                <>Konfirmasi Bayar</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryPage;
