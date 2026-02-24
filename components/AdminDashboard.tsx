
import React, { useState, useEffect } from 'react';
import { User, Product, DepositMethod } from '../types';
import { api } from '../services/api';
import JSZip from 'jszip';

const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [apiProducts, setApiProducts] = useState<Product[]>([]);
  const [apiMethods, setApiMethods] = useState<DepositMethod[]>([]);

  const [isMaintenance, setIsMaintenance] = useState(false);
  const [activeDepositMethod, setActiveDepositMethod] = useState('ciaatopup');
  const [activeAdminTab, setActiveAdminTab] = useState<'users' | 'transactions' | 'deposits' | 'api-products' | 'api-methods' | 'gateway' | 'settings' | 'pterodactyl'>('users');
  const [isLoading, setIsLoading] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [profitMargin, setProfitMargin] = useState<number | string>(0);
  const [pteroSettings, setPteroSettings] = useState<any>({ domain: '', apiKey: '', packages: null });
  const [pteroJson, setPteroJson] = useState('');

  useEffect(() => {
    // Load data from server API
    fetchServerData();

    if (activeAdminTab === 'api-products' || activeAdminTab === 'api-methods') {
      fetchApiData();
    }
    if (activeAdminTab === 'pterodactyl') {
      fetchPteroSettings();
    }
  }, [activeAdminTab]);

  const fetchServerData = async () => {
    try {
      const [usersData, txData, depoData, settingsData] = await Promise.all([
        api.admin.getUsers(),
        api.admin.getTransactions(),
        api.admin.getDeposits(),
        api.admin.getSettings()
      ]);

      if (usersData.status === 'success') setUsers(usersData.data);
      if (txData.status === 'success') setTransactions(txData.data);
      if (depoData.status === 'success') setDeposits(depoData.data);
      if (settingsData.status === 'success') {
        setIsMaintenance(settingsData.data.maintenance);
        setActiveDepositMethod(settingsData.data.activeDepositMethod || 'ciaatopup');
        setProfitMargin(parseInt(settingsData.data.profitPercent) || 0);
      }
    } catch (err) {
      console.error('Gagal load data admin:', err);
    }
  };

  const fetchApiData = async () => {
    setIsLoading(true);
    try {
      const [prodsJson, methsJson] = await Promise.all([
        api.transaction.getProducts(),
        api.transaction.getDepositMethods()
      ]);
      setApiProducts(prodsJson.data || []);
      setApiMethods(methsJson.data || []);
    } catch (err) {
      console.error("Gagal mengambil data API:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const [prodsJson, methsJson] = await Promise.all([
        api.transaction.getProducts(),
        api.transaction.getDepositMethods()
      ]);
      const prods = prodsJson.data || [];
      const meths = methsJson.data || [];

      const zip = new JSZip();
      const dbData = {
        users,
        transactions,
        deposits,
        api_snapshot: {
          products: prods,
          methods: meths
        },
        settings: { isMaintenance },
        backup_date: new Date().toISOString()
      };

      zip.file("wanzz_full_database_backup.json", JSON.stringify(dbData, null, 2));

      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Wanzz_Full_Backup_${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Gagal membuat backup ZIP. Pastikan koneksi internet stabil.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const toggleMaintenance = async () => {
    const newVal = !isMaintenance;
    try {
      const data = await api.admin.updateMaintenance(newVal);
      if (data.status === 'success') {
        setIsMaintenance(data.maintenance);
      }
    } catch (err) {
      console.error('Gagal toggle maintenance:', err);
    }
  };

  const changeDepositMethod = async (method: string) => {
    try {
      const data = await api.admin.updateDepositMethod(method);
      if (data.status === 'success') {
        setActiveDepositMethod(method);
      }
    } catch (err) {
      console.error('Gagal ganti metode deposit:', err);
    }
  };

  const handleUpdateProfit = async () => {
    try {
      const numericMargin = typeof profitMargin === 'string' ? parseInt(profitMargin) || 0 : profitMargin;
      const data = await api.admin.updateProfitMargin(numericMargin);
      if (data.status === 'success') {
        alert('Profit margin berhasil diperbarui!');
        fetchServerData();
      }
    } catch (err) {
      console.error('Gagal update profit margin:', err);
    }
  };

  const fetchPteroSettings = async () => {
    setIsLoading(true);
    try {
      const resp = await api.admin.getPteroSettings();
      if (resp.status === 'success') {
        setPteroSettings(resp.data);
        // Convert packages object to array for easy editing
        if (resp.data.packages) {
          const pkgArray = Object.entries(resp.data.packages).map(([key, val]: [string, any]) => ({
            id: key,
            label: val.label || key,
            price: val.price || 0,
            memo: val.memo || 0,
            cpu: val.cpu || 0,
            disk: val.disk || 0,
          }));
          setPteroJson(JSON.stringify(pkgArray));
        }
      }
    } catch (err) {
      console.error('Gagal fetch ptero settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePkgFieldChange = (pkgId: string, field: string, value: string) => {
    if (!pteroSettings.packages) return;
    const updated = { ...pteroSettings.packages };
    if (updated[pkgId]) {
      updated[pkgId] = { ...updated[pkgId], [field]: field === 'label' ? value : Number(value) || 0 };
      setPteroSettings({ ...pteroSettings, packages: updated });
    }
  };

  const handleAddPackage = () => {
    const newId = prompt('Masukkan ID paket baru (contoh: 12gb, custom1):');
    if (!newId || newId.trim() === '') return;
    const id = newId.trim().toLowerCase().replace(/\s+/g, '');

    const existing = pteroSettings.packages || {};
    if (existing[id]) {
      alert(`Paket "${id}" sudah ada!`);
      return;
    }

    const updated = {
      ...existing,
      [id]: { memo: 1024, cpu: 30, disk: 1024, price: 5000, label: id.toUpperCase() }
    };
    setPteroSettings({ ...pteroSettings, packages: updated });
  };

  const handleDeletePackage = (pkgId: string) => {
    if (!confirm(`Hapus paket "${pkgId}"? Pastikan tidak ada user yang sudah pakai paket ini.`)) return;
    const updated = { ...pteroSettings.packages };
    delete updated[pkgId];
    setPteroSettings({ ...pteroSettings, packages: updated });
  };

  const handleSaveConnection = async () => {
    try {
      const resp = await api.admin.updatePteroSettings({
        domain: pteroSettings.domain,
        apiKey: pteroSettings.apiKey,
      });
      if (resp.status === 'success') {
        alert('Koneksi panel berhasil disimpan!');
      }
    } catch (err: any) {
      alert(`Gagal simpan koneksi: ${err.message}`);
    }
  };

  const handleSavePackages = async () => {
    try {
      const resp = await api.admin.updatePteroSettings({
        packages: pteroSettings.packages
      });
      if (resp.status === 'success') {
        alert('Daftar harga paket berhasil disimpan!');
        fetchPteroSettings();
      }
    } catch (err: any) {
      alert(`Gagal simpan paket: ${err.message}`);
    }
  };

  const filteredProducts = apiProducts.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.provider.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.code.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Admin Control Center</h1>
          <p className="text-slate-500 text-xs">Pusat manajemen data Wanzz PPOB & Monitoring API.</p>
        </div>
        <div className="w-full lg:w-auto overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex flex-nowrap lg:flex-wrap gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 w-max lg:w-auto mt-2 md:mt-0">
            {[
              { id: 'users', label: 'User' },
              { id: 'transactions', label: 'Transaksi' },
              { id: 'deposits', label: 'Deposit' },
              { id: 'api-products', label: 'Produk API' },
              { id: 'api-methods', label: 'Metode API' },
              { id: 'gateway', label: 'Gateway' },
              { id: 'settings', label: 'Sistem' },
              { id: 'pterodactyl', label: 'Pterodactyl' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveAdminTab(tab.id as any)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeAdminTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeAdminTab === 'users' && (
        <div className="glass-card rounded-[2rem] border border-slate-800 overflow-hidden shadow-2xl">
          <div className="px-8 py-5 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
            <h3 className="font-black text-xs uppercase tracking-widest">Daftar Pengguna ({users.length})</h3>
          </div>
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left min-w-[700px]">
              <thead className="bg-slate-950/50 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase">User Info</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase">Kontak</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase">Saldo</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {users.length === 0 ? (
                  <tr><td colSpan={4} className="p-20 text-center text-slate-600 italic">Belum ada pengguna terdaftar.</td></tr>
                ) : (
                  users.map(u => (
                    <tr key={u.id} className="text-xs hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={u.photoURL} className="w-8 h-8 rounded-full" alt="" />
                          <div>
                            <p className="font-bold text-white">{u.name}</p>
                            <p className="text-[10px] text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-400 font-mono">{u.phone || '-'}</td>
                      <td className="px-6 py-4 font-black text-blue-400">Rp {u.balance.toLocaleString('id-ID')}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${u.role === 'admin' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'}`}>
                          {u.role}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeAdminTab === 'transactions' && (
        <div className="glass-card rounded-[2rem] border border-slate-800 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-950/50 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase">Waktu</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase">Produk & Harga</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase">User & Target</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {transactions.length === 0 ? (
                <tr><td colSpan={4} className="p-20 text-center text-slate-600 italic">Belum ada riwayat transaksi.</td></tr>
              ) : (
                transactions.map((t, i) => (
                  <tr key={i} className="text-xs hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-[10px] text-slate-500">{new Date(t.created_at).toLocaleString('id-ID')}</td>
                    <td className="px-6 py-4">
                      <p className="font-bold">{t.product_name}</p>
                      <p className="text-blue-500 font-black">Rp {t.price?.toLocaleString('id-ID')}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-200">{t.user_name}</p>
                      <p className="text-slate-500 font-mono text-[10px]">{t.target}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded uppercase font-black text-[9px] ${t.status === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                        }`}>
                        {t.status?.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeAdminTab === 'deposits' && (
        <div className="glass-card rounded-[2rem] border border-slate-800 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-950/50 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase">Waktu</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase">User</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase">Nominal</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase">Metode</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {deposits.length === 0 ? (
                <tr><td colSpan={5} className="p-20 text-center text-slate-600 italic">Belum ada riwayat deposit.</td></tr>
              ) : (
                deposits.map((d, i) => (
                  <tr key={i} className="text-xs hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-[10px] text-slate-500">{new Date(d.created_at).toLocaleString('id-ID')}</td>
                    <td className="px-6 py-4 text-slate-200">{d.user_name}</td>
                    <td className="px-6 py-4 font-black text-blue-400">Rp {d.nominal?.toLocaleString('id-ID')}</td>
                    <td className="px-6 py-4 text-slate-400">{d.method}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded uppercase font-black text-[9px] ${d.status === 'success' ? 'bg-green-500/10 text-green-500' :
                        d.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'
                        }`}>
                        {d.status?.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeAdminTab === 'api-products' && (
        <div className="glass-card rounded-[2rem] border border-slate-800 overflow-hidden">
          <div className="px-8 py-5 border-b border-slate-800 bg-slate-900/50 flex flex-col md:flex-row justify-between items-center gap-4">
            <h3 className="font-black text-xs uppercase tracking-widest">Live API Products ({apiProducts.length})</h3>
            <div className="relative w-full md:w-64">
              <input
                type="text" placeholder="Cari produk API..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs outline-none focus:border-blue-500"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
              <i className="fas fa-search absolute right-3 top-1/2 -translate-y-1/2 text-slate-700 text-[10px]"></i>
            </div>
          </div>
          <div className="overflow-x-auto no-scrollbar max-h-[600px]">
            {isLoading ? (
              <div className="p-20 text-center flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Fetching Live Data...</p>
              </div>
            ) : (
              <table className="w-full text-left min-w-[900px]">
                <thead className="bg-slate-950/50 border-b border-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase">SKU / Code</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase">Provider & Nama</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase">Harga Modal</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase text-right">Harga Jual</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase text-right">Profit</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredProducts.map(p => (
                    <tr key={p.code} className="text-xs hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-mono text-slate-500 text-[10px]">{p.code}</td>
                      <td className="px-6 py-4">
                        <p className="text-[9px] text-slate-500 uppercase font-black">{p.provider}</p>
                        <p className="font-bold">{p.name}</p>
                      </td>
                      <td className="px-6 py-4 font-black text-blue-400">Rp {parseInt(p.original_price || '0').toLocaleString('id-ID')}</td>
                      <td className="px-6 py-4 font-black text-right text-white">Rp {p.price.toLocaleString('id-ID')}</td>
                      <td className="px-6 py-4 font-black text-right text-green-500">
                        +Rp {parseInt(p.profit || '0').toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${p.available ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                          {p.available ? 'Active' : 'Offline'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeAdminTab === 'api-methods' && (
        <div className="glass-card rounded-[2rem] border border-slate-800 overflow-hidden shadow-2xl">
          <div className="px-8 py-5 border-b border-slate-800 bg-slate-900/50">
            <h3 className="font-black text-xs uppercase tracking-widest">Live Deposit Methods ({apiMethods.length})</h3>
          </div>
          {isLoading ? (
            <div className="p-20 text-center flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Syncing Gateways...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-8">
              {apiMethods.map(m => (
                <div key={m.metode} className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 flex items-center gap-4">
                  <img src={m.logo_image_url} className="w-12 h-12 object-contain bg-white rounded-xl p-2" alt="" />
                  <div className="flex-1">
                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">{m.type}</p>
                    <h4 className="font-bold text-sm text-white">{m.name}</h4>
                    <p className="text-[10px] text-slate-500 font-medium">Min: Rp {parseInt(m.minimum || '0').toLocaleString('id-ID')}</p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${m.status === 'active' ? 'bg-green-500' : 'bg-red-500'} shadow-lg`}></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeAdminTab === 'gateway' && (
        <div className="glass-card p-8 rounded-[2rem] border border-slate-800 space-y-6 animate-fade-in">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 text-xl">
              <i className="fas fa-credit-card"></i>
            </div>
            <div>
              <h3 className="font-black uppercase text-base tracking-tight">Manajemen Gateway Deposit</h3>
              <p className="text-[10px] text-slate-500 font-medium">Pilih gateway aktif untuk memproses pembayaran user.</p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { id: 'ciaatopup', name: 'CiaaTopUp', desc: 'Gateway utama dengan metode terlengkap via API H2H.', logo: 'https://ciaatopup.my.id/logo/logo.png' },
              { id: 'pakasir', name: 'Pakasir', desc: 'Gateway alternatif, mendukung QRIS dan berbagai Virtual Account.', logo: 'https://app.pakasir.com/assets/img/logo.png' }
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => changeDepositMethod(m.id)}
                className={`p-6 rounded-[2rem] border-2 text-left transition-all relative overflow-hidden group ${activeDepositMethod === m.id ? 'bg-blue-600/10 border-blue-500 shadow-2xl shadow-blue-500/20' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeDepositMethod === m.id ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                    <i className={`fas ${m.id === 'ciaatopup' ? 'fa-bolt' : 'fa-wallet'}`}></i>
                  </div>
                  {activeDepositMethod === m.id && (
                    <span className="bg-blue-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">
                      Active Now
                    </span>
                  )}
                </div>
                <h4 className="font-black text-lg text-white mb-1">{m.name}</h4>
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{m.desc}</p>
                {activeDepositMethod === m.id && (
                  <div className="absolute -right-4 -bottom-4 opacity-5 text-8xl rotate-12">
                    <i className="fas fa-check-circle"></i>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeAdminTab === 'settings' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass-card p-8 rounded-[2rem] border border-slate-800 space-y-6">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center text-red-500">
                <i className="fas fa-hammer"></i>
              </div>
              <h3 className="font-black uppercase text-sm">Pemeliharaan Sistem</h3>
            </div>
            <div className="flex justify-between items-center p-4 bg-slate-950 rounded-2xl border border-slate-800">
              <div>
                <span className="text-xs text-slate-200 font-bold block">Maintenance Mode</span>
                <span className="text-[10px] text-slate-600">Mencegah user biasa bertransaksi</span>
              </div>
              <button onClick={toggleMaintenance} className={`w-12 h-6 rounded-full relative transition-all ${isMaintenance ? 'bg-red-500 shadow-lg shadow-red-500/50' : 'bg-slate-700'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isMaintenance ? 'left-7' : 'left-1'}`}></div>
              </button>
            </div>
          </div>
          <div className="glass-card p-8 rounded-[2rem] border border-slate-800 space-y-6">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-10 h-10 bg-yellow-600/10 rounded-xl flex items-center justify-center text-yellow-500">
                <i className="fas fa-percent"></i>
              </div>
              <h3 className="font-black uppercase text-sm">Profit Margin (H2H)</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <input
                    type="number"
                    value={profitMargin}
                    onChange={(e) => setProfitMargin(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white font-black text-xl pr-16"
                  />
                  <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 font-black text-xl">%</span>
                </div>
                <button
                  onClick={handleUpdateProfit}
                  className="px-8 py-4 bg-yellow-600 hover:bg-yellow-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
                >
                  Update
                </button>
              </div>
              <p className="text-[9px] text-slate-600 leading-relaxed font-medium uppercase tracking-widest">
                * Keuntungan otomatis ditambahkan ke harga modal API CiaaTopUp.
              </p>
            </div>
          </div>

          <div className="glass-card p-8 rounded-[2rem] border border-slate-800 space-y-6">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center text-blue-500">
                <i className="fas fa-cloud-arrow-down"></i>
              </div>
              <h3 className="font-black uppercase text-sm">Backup & Keamanan</h3>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
              Unduh seluruh database (User, Transaksi, Deposit) dan Snapshot Produk API ke dalam file ZIP terkompresi.
            </p>
            <button
              onClick={handleBackup}
              disabled={isBackingUp}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 active:scale-95"
            >
              {isBackingUp ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                  Mengompres Data...
                </span>
              ) : (
                <><i className="fas fa-file-zipper mr-2"></i> Download Full Backup ZIP</>
              )}
            </button>
          </div>
        </div>
      )}

      {activeAdminTab === 'pterodactyl' && (
        <div className="space-y-6 animate-fade-in">
          {/* Connection Settings */}
          <div className="glass-card p-8 rounded-[2rem] border border-slate-800 space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 text-xl">
                <i className="fas fa-server"></i>
              </div>
              <div>
                <h3 className="font-black uppercase text-base tracking-tight">Koneksi Panel</h3>
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">Domain dan API Key panel Pterodactyl.</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 ml-1">Domain Panel</label>
                <input
                  type="text"
                  value={pteroSettings.domain}
                  onChange={(e) => setPteroSettings({ ...pteroSettings, domain: e.target.value })}
                  placeholder="https://panel.example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-white font-bold text-sm focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 ml-1">Application API Key</label>
                <input
                  type="password"
                  value={pteroSettings.apiKey}
                  onChange={(e) => setPteroSettings({ ...pteroSettings, apiKey: e.target.value })}
                  placeholder="ptla_xxxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-white font-bold text-sm focus:border-blue-500 outline-none transition-all font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveConnection}
                className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-600/20"
              >
                <i className="fas fa-plug mr-2"></i>
                Simpan Koneksi
              </button>
            </div>
          </div>

          {/* Package Pricing Table */}
          <div className="glass-card rounded-[2rem] border border-slate-800 overflow-hidden">
            <div className="px-8 py-5 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <i className="fas fa-tags text-blue-500"></i>
                <h3 className="font-black text-xs uppercase tracking-widest">Daftar Harga Paket ({pteroSettings.packages ? Object.keys(pteroSettings.packages).length : 0})</h3>
              </div>
              <button
                onClick={handleAddPackage}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-600/20"
              >
                <i className="fas fa-plus text-[8px]"></i>
                Tambah Paket
              </button>
            </div>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left min-w-[900px]">
                <thead className="bg-slate-950/50 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase">Paket ID</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase">Label</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase text-right">Harga (Rp)</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase text-right">RAM (MB)</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase text-right">CPU (%)</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase text-right">Disk (MB)</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {pteroSettings.packages && Object.entries(pteroSettings.packages).map(([pkgId, pkg]: [string, any]) => (
                    <tr key={pkgId} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-3">
                        <span className="text-[10px] font-black text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg uppercase tracking-wider">{pkgId}</span>
                      </td>
                      <td className="px-6 py-3">
                        <input
                          type="text"
                          value={pkg.label || ''}
                          onChange={(e) => handlePkgFieldChange(pkgId, 'label', e.target.value)}
                          className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-blue-500 outline-none text-white text-xs font-bold py-1 px-1 w-24 transition-all"
                        />
                      </td>
                      <td className="px-6 py-3 text-right">
                        <input
                          type="number"
                          value={pkg.price || 0}
                          onChange={(e) => handlePkgFieldChange(pkgId, 'price', e.target.value)}
                          className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-blue-500 outline-none text-green-400 text-xs font-black py-1 px-1 w-24 text-right transition-all"
                        />
                      </td>
                      <td className="px-6 py-3 text-right">
                        <input
                          type="number"
                          value={pkg.memo || 0}
                          onChange={(e) => handlePkgFieldChange(pkgId, 'memo', e.target.value)}
                          className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-blue-500 outline-none text-slate-300 text-xs font-bold py-1 px-1 w-20 text-right transition-all"
                        />
                      </td>
                      <td className="px-6 py-3 text-right">
                        <input
                          type="number"
                          value={pkg.cpu || 0}
                          onChange={(e) => handlePkgFieldChange(pkgId, 'cpu', e.target.value)}
                          className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-blue-500 outline-none text-slate-300 text-xs font-bold py-1 px-1 w-20 text-right transition-all"
                        />
                      </td>
                      <td className="px-6 py-3 text-right">
                        <input
                          type="number"
                          value={pkg.disk || 0}
                          onChange={(e) => handlePkgFieldChange(pkgId, 'disk', e.target.value)}
                          className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-blue-500 outline-none text-slate-300 text-xs font-bold py-1 px-1 w-20 text-right transition-all"
                        />
                      </td>
                      <td className="px-6 py-3 text-center">
                        <button
                          onClick={() => handleDeletePackage(pkgId)}
                          className="w-8 h-8 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 text-[10px]"
                          title={`Hapus paket ${pkgId}`}
                        >
                          <i className="fas fa-trash-can"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!pteroSettings.packages || Object.keys(pteroSettings.packages).length === 0) && (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-600 text-xs">
                        <i className="fas fa-box-open text-2xl mb-3 block text-slate-700"></i>
                        Belum ada paket. Klik <b>"Tambah Paket"</b> di atas untuk mulai.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSavePackages}
              className="px-12 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-600/30 transition-all active:scale-95"
            >
              <i className="fas fa-save mr-2"></i>
              Simpan Harga Paket
            </button>
          </div>
        </div>
      )}



    </div>
  );
};

export default AdminDashboard;
