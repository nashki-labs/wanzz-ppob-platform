
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { DepositMethod, User, Deposit } from '../types';
import { api } from '../services/api';
import DepositInvoice from '../components/DepositInvoice';
import Skeleton from '../components/Skeleton';


interface DepositPageProps {
  user: User | null;
  onRefreshUser: () => Promise<void>;
}

const DepositPage: React.FC<DepositPageProps> = ({ user, onRefreshUser }) => {
  const [methods, setMethods] = useState<DepositMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<DepositMethod | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [activeDeposit, setActiveDeposit] = useState<Deposit | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isChangingMethod, setIsChangingMethod] = useState(false);

  const location = useLocation();

  useEffect(() => {
    const fetchMethods = async () => {
      setLoading(true);
      try {
        const json = await api.transaction.getDepositMethods();
        setMethods(json.data || []);
      } catch (err) {
        console.error("Gagal memuat metode deposit:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMethods();
  }, []);

  useEffect(() => {
    if (location.state?.existingDeposit) {
      const dep = location.state.existingDeposit;
      setActiveDeposit(dep);
      setIsChangingMethod(true);
      setAmount(dep.nominal);
      // Clean up state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleCreateDeposit = async () => {
    if (!user || !selectedMethod) return;
    if (!isChangingMethod && amount < 10000) {
      alert('Nominal minimal Rp 10.000.');
      return;
    }

    setIsProcessing(true);
    try {
      const data = await api.transaction.createDeposit({
        nominal: isChangingMethod ? activeDeposit?.nominal : amount,
        method: selectedMethod.metode,
        existing_deposit_id: isChangingMethod ? activeDeposit?.id : undefined
      });

      if (data.status === 'success') {
        setActiveDeposit(data.data);
        setIsChangingMethod(false);
        await onRefreshUser();
      }
    } catch (err: any) {
      alert(err.message || 'Gagal memproses deposit.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelDeposit = async () => {
    if (!activeDeposit) return;
    if (!confirm('Apakah Anda yakin ingin membatalkan deposit ini?')) return;

    setIsProcessing(true);
    try {
      const res = await api.transaction.cancelDeposit(activeDeposit.id);
      if (res.status === 'success') {
        setActiveDeposit(null);
        alert('Deposit berhasil dibatalkan.');
      }
    } catch (err: any) {
      alert(err.message || 'Gagal membatalkan deposit.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in space-y-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>

          <div className="grid lg:grid-cols-12 gap-10">
            <div className="lg:col-span-8">
              <div className="glass-card p-8 rounded-[2.5rem] border border-slate-800 space-y-8">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <Skeleton className="h-6 w-48" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
                </div>
              </div>
            </div>
            <div className="lg:col-span-4">
              <Skeleton className="h-[400px] w-full rounded-[2.5rem]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeDeposit && !isChangingMethod) {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <div className="glass-card p-4 md:p-10 rounded-[2.5rem] border border-blue-500/30 shadow-2xl bg-slate-900/40">
          <DepositInvoice
            deposit={activeDeposit}
            methodName={selectedMethod?.name || activeDeposit.method}
            onClose={() => setActiveDeposit(null)}
            onCancel={handleCancelDeposit}
            onChangeMethod={() => setIsChangingMethod(true)}
            isProcessing={isProcessing}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-32">
      {isChangingMethod && (
        <div className="max-w-4xl mx-auto mb-6 p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-blue-400 font-black text-[10px] uppercase tracking-widest">Mode Ganti Metode</p>
            <p className="text-white text-xs font-bold mt-0.5">Deposit Rp {activeDeposit?.nominal.toLocaleString('id-ID')}</p>
          </div>
          <button
            onClick={() => setIsChangingMethod(false)}
            className="text-[10px] text-slate-400 hover:text-white font-black uppercase tracking-widest"
          >
            Batal
          </button>
        </div>
      )}

      {!isChangingMethod && (
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Top Up Saldo</h1>
          <p className="text-slate-400 text-sm">Isi saldo akun Anda untuk kemudahan transaksi kapanpun.</p>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-6 pb-32">
          <div className="glass-card p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-slate-800 w-full">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center text-blue-500">
                <i className="fas fa-credit-card"></i>
              </div>
              <h3 className="text-lg font-black uppercase">
                {isChangingMethod ? 'Pilih Metode Baru' : '1. Pilih Cara Bayar'}
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {methods.length > 0 ? methods.map(m => (
                <button
                  key={m.metode}
                  onClick={() => setSelectedMethod(m)}
                  className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center group relative overflow-hidden h-28 ${selectedMethod?.metode === m.metode
                    ? 'border-blue-500 bg-blue-500/10 scale-[1.02]'
                    : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
                    }`}
                >
                  <div className="h-10 w-full flex items-center justify-center mb-2">
                    {m.logo_image_url ? (
                      <img
                        src={m.logo_image_url}
                        className={`h-8 max-w-full object-contain transition-all ${selectedMethod?.metode === m.metode ? 'grayscale-0' : 'grayscale group-hover:grayscale-0'}`}
                        alt={m.name}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          const parent = (e.target as HTMLImageElement).parentElement;
                          if (parent && !parent.querySelector('.fa-fallback')) {
                            const icon = document.createElement('i');
                            icon.className = `fas ${m.type === 'bank' ? 'fa-university' : 'fa-wallet'} text-xl text-slate-700 group-hover:text-blue-500/50 fa-fallback`;
                            parent.appendChild(icon);
                          }
                        }}
                      />
                    ) : (
                      <i className={`fas ${m.type === 'bank' ? 'fa-university' : 'fa-wallet'} text-xl text-slate-700 group-hover:text-blue-500/50`}></i>
                    )}
                  </div>
                  <p className={`text-[9px] font-black uppercase text-center truncate w-full px-2 ${selectedMethod?.metode === m.metode ? 'text-blue-400' : 'text-slate-300 group-hover:text-blue-400'}`}>{m.name}</p>
                  {selectedMethod?.metode === m.metode && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
                </button>
              )) : (
                <div className="col-span-full py-10 text-center text-slate-600 text-xs italic">
                  Tidak ada metode pembayaran yang tersedia saat ini.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="glass-card p-8 rounded-[2.5rem] border border-slate-800 lg:sticky lg:top-24 shadow-2xl">
            {!isChangingMethod && (
              <div className="space-y-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 bg-green-600/10 rounded-xl flex items-center justify-center text-green-500">
                    <i className="fas fa-money-bill-wave"></i>
                  </div>
                  <h3 className="text-lg font-black uppercase">2. Nominal</h3>
                </div>

                <div className="relative group">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl font-black text-slate-400 group-focus-within:text-blue-500 transition-colors">Rp</span>
                  <input
                    type="number"
                    value={amount || ''}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-slate-950 p-5 pl-14 rounded-2xl border border-slate-800 outline-none font-black text-3xl focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[20000, 50000, 100000, 250000].map(val => (
                    <button
                      key={val}
                      onClick={() => setAmount(val)}
                      className={`py-3 bg-slate-900 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${amount === val ? 'border-blue-500 text-white' : 'border-slate-800 text-slate-500 hover:border-slate-700'}`}
                    >
                      + {val.toLocaleString('id-ID')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className={`pt-6 ${!isChangingMethod ? 'mt-6 border-t border-slate-800' : ''}`}>
              <button
                onClick={handleCreateDeposit}
                disabled={isProcessing || !selectedMethod || (!isChangingMethod && amount < 10000)}
                className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-xl transition-all active:scale-95 ${isProcessing || !selectedMethod || (!isChangingMethod && amount < 10000)
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50'
                  : 'primary-gradient text-white shadow-blue-600/20'
                  }`}
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-3">
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    Memproses...
                  </span>
                ) : (isChangingMethod ? 'Konfirmasi Ganti' : 'Bayar Sekarang')}
              </button>
              <p className="text-[9px] text-slate-500 text-center mt-4 font-medium italic">
                <i className="fas fa-shield-halved mr-2"></i> Transaksi Anda diproses secara aman & otomatis.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


export default DepositPage;
