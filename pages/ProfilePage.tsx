import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Deposit } from '../types';
import { api } from '../services/api';
import DepositInvoice from '../components/DepositInvoice';
import Skeleton from '../components/Skeleton';


interface ProfilePageProps {
    user: User;
    setIsAuthModalOpen: (open: boolean) => void;
    refreshUser: () => Promise<void>;
    onLogout: () => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ user, setIsAuthModalOpen, refreshUser, onLogout }) => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'transactions' | 'deposits'>('transactions');
    const [transactions, setTransactions] = useState<any[]>([]);
    const [deposits, setDeposits] = useState<Deposit[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedDeposit, setSelectedDeposit] = useState<Deposit | null>(null);
    const [isCancelProcessing, setIsCancelProcessing] = useState(false);
    const [editForm, setEditForm] = useState({
        name: user.name,
        email: user.email,
        phone: user.phone || ''
    });
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [passwordForm, setPasswordForm] = useState({
        newPassword: '',
        confirmPassword: ''
    });

    useEffect(() => {
        setEditForm({
            name: user.name,
            email: user.email,
            phone: user.phone || '',
        });
    }, [user]);

    const handleChangePassword = async () => {
        if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
            alert('Password minimal 6 karakter.');
            return;
        }
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            alert('Konfirmasi password tidak cocok!');
            return;
        }

        setLoading(true);
        try {
            const res = await api.auth.updateProfile({ password: passwordForm.newPassword });
            if (res.status === 'success') {
                setIsChangingPassword(false);
                setPasswordForm({ newPassword: '', confirmPassword: '' });
                alert('Password berhasil diubah!');
            } else {
                alert(res.message || 'Gagal mengubah password.');
            }
        } catch (err: any) {
            alert(err.message || 'Terjadi kesalahan sistem.');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProfile = async () => {
        setLoading(true);
        try {
            const res = await api.auth.updateProfile(editForm);
            if (res.status === 'success') {
                await refreshUser();
                setIsEditing(false);
                alert('Profil berhasil diperbarui!');
            } else {
                alert(res.message || 'Gagal memperbarui profil.');
            }
        } catch (err: any) {
            alert(err.message || 'Terjadi kesalahan sistem.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const data = await api.auth.getHistory();
            if (data.status === 'success') {
                setTransactions(data.transactions || []);
                setDeposits(data.deposits || []);
            }
        } catch (err) {
            console.error('Gagal mengambil riwayat:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSyncTx = async (id: string) => {
        setSyncingId(id);
        try {
            const res = await api.transaction.syncTransaction(id);
            if (res.status === 'success') {
                await fetchHistory();
                await refreshUser();
            }
        } catch (err: any) {
            alert('Gagal sinkronisasi: ' + err.message);
        } finally {
            setSyncingId(null);
        }
    };

    const handleSyncDepo = async (id: string) => {
        setSyncingId(id);
        try {
            const res = await api.transaction.syncDeposit(id);
            if (res.status === 'success') {
                await fetchHistory();
                await refreshUser();
                // Update selected deposit if open
                if (selectedDeposit?.id === id) {
                    const updated = (await api.auth.getHistory()).deposits.find((d: any) => d.id === id);
                    if (updated && updated.status !== 'pending') {
                        setSelectedDeposit(null);
                    }
                }
            }
        } catch (err: any) {
            alert('Gagal sinkronisasi: ' + err.message);
        } finally {
            setSyncingId(null);
        }
    };

    const handleSelectDeposit = (dp: Deposit) => {
        // Defensive: if payment_number is missing (old records), try to parse from gateway_response
        if (!dp.payment_number && dp.gateway_response) {
            try {
                const parsed = JSON.parse(dp.gateway_response);
                const data = parsed.data || parsed;
                dp.payment_number = data.payment_number;
                if (!dp.qr_image_url) dp.qr_image_url = data.qr_image_url;
                if (!dp.total_payment) dp.total_payment = data.total_payment;
            } catch (e) {
                console.warn("Gagal parse gateway_response:", e);
            }
        }
        setSelectedDeposit(dp);
    };

    const handleCancelDeposit = async () => {
        if (!selectedDeposit) return;
        if (!confirm('Apakah Anda yakin ingin membatalkan deposit ini?')) return;

        setIsCancelProcessing(true);
        try {
            const res = await api.transaction.cancelDeposit(selectedDeposit.id);
            if (res.status === 'success') {
                setSelectedDeposit(null);
                await fetchHistory();
                alert('Deposit berhasil dibatalkan.');
            }
        } catch (err: any) {
            alert(err.message || 'Gagal membatalkan deposit.');
        } finally {
            setIsCancelProcessing(false);
        }
    };

    const handleChangeMethod = () => {
        if (!selectedDeposit) return;
        navigate('/deposit', { state: { existingDeposit: selectedDeposit } });
    };

    return (
        <>
            <div className="animate-fade-in space-y-8">
                {/* PROFILE HEADER */}
                <div className="glass-card p-6 md:p-10 rounded-[2rem] border border-slate-800 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] pointer-events-none group-hover:bg-blue-600/20 transition-all duration-700"></div>

                    <div className="flex justify-between items-start mb-10 relative z-10">
                        <div>
                            <h2 className="text-2xl font-black tracking-tight uppercase">Akun Saya</h2>
                            {user.role === 'admin' && (
                                <span className="mt-2 inline-block px-4 py-1.5 bg-red-500/10 text-red-500 text-[10px] font-black rounded-full uppercase tracking-widest border border-red-500/20">
                                    Administrator
                                </span>
                            )}
                        </div>
                        <button
                            onClick={onLogout}
                            className="px-6 py-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-500/20 transition-all flex items-center gap-2"
                        >
                            <i className="fas fa-sign-out-alt"></i> Logout
                        </button>
                    </div>

                    <div className="space-y-8 relative z-10">
                        {/* EDIT FORM or PROFILE INFO */}
                        {isEditing ? (
                            <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 animate-fade-in">
                                <h3 className="text-lg font-black mb-4 uppercase">Edit Profil</h3>
                                <div className="grid gap-4">
                                    <div>
                                        <label className="text-[10px] uppercase font-black text-slate-400">Nama Lengkap</label>
                                        <input
                                            type="text"
                                            value={editForm.name}
                                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm mt-1 focus:border-blue-500 outline-none text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-black text-slate-500">Email</label>
                                        <input
                                            type="email"
                                            value={editForm.email}
                                            onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm mt-1 focus:border-blue-500 outline-none text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-black text-slate-500">No. Handphone</label>
                                        <input
                                            type="text"
                                            value={editForm.phone}
                                            onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm mt-1 focus:border-blue-500 outline-none text-white"
                                            placeholder="08..."
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-6">
                                    <button
                                        onClick={handleUpdateProfile}
                                        disabled={loading}
                                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all disabled:opacity-50"
                                    >
                                        {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                                    </button>
                                    <button
                                        onClick={() => setIsEditing(false)}
                                        className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-black uppercase tracking-widest text-slate-300 transition-all"
                                    >
                                        Batal
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col md:flex-row items-center gap-6">
                                <div className="relative group cursor-pointer" onClick={() => setIsEditing(true)}>
                                    <img src={user.photoURL} className="w-24 h-24 rounded-[2.5rem] border-2 border-blue-500 p-1 shadow-2xl shadow-blue-500/20" alt="Avatar" />
                                    <div className="absolute inset-0 bg-black/50 rounded-[2.5rem] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <i className="fas fa-pen text-white"></i>
                                    </div>
                                </div>
                                <div className="text-center md:text-left flex-1">
                                    <div className="flex items-center justify-center md:justify-start gap-3">
                                        <p className="font-black text-2xl text-white tracking-tight">{user.name}</p>
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                                        >
                                            <i className="fas fa-pen text-xs"></i>
                                        </button>
                                    </div>
                                    <p className="text-slate-400 text-xs font-medium mb-2">{user.email}</p>
                                    <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-2">
                                        <span className="px-3 py-1 bg-slate-800/50 rounded-lg text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <i className="fas fa-phone text-[8px]"></i> {user.phone || '-'}
                                        </span>
                                        <span className="px-3 py-1 bg-slate-800/50 rounded-lg text-[9px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                                            <i className="fas fa-calendar text-[8px]"></i> Joined {user.created_at ? new Date(user.created_at).toLocaleString('id-ID', { month: 'long', year: 'numeric' }) : '2024'}
                                        </span>
                                    </div>
                                    <div className="mt-4 flex justify-center md:justify-start">
                                        <button
                                            onClick={() => setIsChangingPassword(!isChangingPassword)}
                                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-700 transition-all flex items-center gap-2"
                                        >
                                            <i className={`fas ${isChangingPassword ? 'fa-times' : 'fa-lock'}`}></i>
                                            {isChangingPassword ? 'Batal Ganti Password' : 'Ganti Password'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* CHANGE PASSWORD FORM */}
                        {isChangingPassword && (
                            <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 animate-fade-in mt-4">
                                <h3 className="text-lg font-black mb-4 uppercase text-white">Ganti Password</h3>
                                <div className="grid gap-4">
                                    <div>
                                        <label className="text-[10px] uppercase font-black text-slate-500">Password Baru</label>
                                        <input
                                            type="password"
                                            value={passwordForm.newPassword}
                                            onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm mt-1 focus:border-blue-500 outline-none text-white"
                                            placeholder="Masukkan password baru"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-black text-slate-500">Konfirmasi Password</label>
                                        <input
                                            type="password"
                                            value={passwordForm.confirmPassword}
                                            onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm mt-1 focus:border-blue-500 outline-none text-white"
                                            placeholder="Ulangi password baru"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-6">
                                    <button
                                        onClick={handleChangePassword}
                                        disabled={loading || !passwordForm.newPassword}
                                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all disabled:opacity-50"
                                    >
                                        {loading ? 'Menyimpan...' : 'Simpan Password'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* BALANCE CARD & API KEY (REMOVED API KEY) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gradient-to-br from-blue-600/10 to-transparent p-6 rounded-3xl border border-blue-500/20 group hover:border-blue-500/40 transition-all col-span-full">
                                <p className="text-[10px] text-slate-400 uppercase font-black mb-1 tracking-widest">Saldo Tersedia</p>
                                <div className="flex items-center justify-between">
                                    <p className="text-3xl font-black text-white">Rp {user.balance.toLocaleString('id-ID')}</p>
                                    <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-500">
                                        <i className="fas fa-wallet text-xl"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* HISTORY SECTION */}
                <div className="glass-card rounded-[2rem] border border-slate-800 overflow-hidden shadow-2xl">
                    <div className="px-4 py-4 border-b border-slate-800 bg-slate-900/50 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex bg-slate-950 p-1.5 rounded-[1.5rem] border border-slate-800 w-full md:w-auto">
                            <button
                                onClick={() => setActiveTab('transactions')}
                                className={`flex-1 md:flex-none px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'transactions' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-slate-500 hover:text-white'}`}
                            >
                                Transaksi
                            </button>
                            <button
                                onClick={() => setActiveTab('deposits')}
                                className={`flex-1 md:flex-none px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'deposits' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-slate-500 hover:text-white'}`}
                            >
                                Deposit
                            </button>
                        </div>
                        <button
                            onClick={fetchHistory}
                            className="w-full md:w-auto px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all border border-slate-700/50"
                        >
                            <i className={`fas fa-sync-alt mr-2 ${loading ? 'animate-spin' : ''}`}></i>
                            Refresh data
                        </button>
                    </div>

                    <div className="overflow-x-auto min-h-[300px]">
                        {loading ? (
                            <div className="p-6 space-y-4">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} className="flex flex-col md:flex-row gap-4 justify-between border-b border-slate-800 pb-4">
                                        <div className="space-y-2 flex-1">
                                            <Skeleton className="h-4 w-1/3" />
                                            <Skeleton className="h-3 w-1/4" />
                                        </div>
                                        <div className="flex gap-4 items-center">
                                            <Skeleton className="h-6 w-16" />
                                            <Skeleton className="h-4 w-20" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : activeTab === 'transactions' ? (
                            <>
                                <div className="overflow-x-auto no-scrollbar">
                                    <table className="w-full text-left min-w-[600px] hidden md:table">
                                        <thead className="bg-[#020617] border-b border-slate-800">
                                            <tr>
                                                <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Produk / ID</th>
                                                <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Target</th>
                                                <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Harga</th>
                                                <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                                <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/50">
                                            {transactions.length === 0 ? (
                                                <tr><td colSpan={5} className="py-20 text-center text-slate-600 text-xs italic">Belum ada transaksi.</td></tr>
                                            ) : (
                                                transactions.map(tx => (
                                                    <tr key={tx.id} className="group hover:bg-white/5 transition-all">
                                                        <td className="px-6 py-4">
                                                            <p className="text-xs font-black text-white">{tx.product_name}</p>
                                                            <p className="text-[9px] text-slate-500 uppercase mt-0.5">{tx.id}</p>
                                                        </td>
                                                        <td className="px-6 py-4 font-mono text-[10px] text-slate-400">{tx.target}</td>
                                                        <td className="px-6 py-4 font-black text-white text-xs">Rp {tx.price.toLocaleString('id-ID')}</td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${tx.status === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                                                                tx.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 animate-pulse' :
                                                                    'bg-red-500/10 text-red-500 border border-red-500/20'
                                                                }`}>
                                                                {tx.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {tx.status === 'pending' && (
                                                                <button
                                                                    disabled={syncingId === tx.id}
                                                                    onClick={() => handleSyncTx(tx.id)}
                                                                    className="p-2.5 bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white rounded-xl transition-all disabled:opacity-50"
                                                                >
                                                                    <i className={`fas fa-sync-alt text-[10px] ${syncingId === tx.id ? 'animate-spin' : ''}`}></i>
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="md:hidden divide-y divide-slate-800">
                                    {transactions.length === 0 ? (
                                        <p className="py-20 text-center text-slate-600 text-xs italic">Belum ada transaksi.</p>
                                    ) : (
                                        transactions.map(tx => (
                                            <div key={tx.id} className="p-4 space-y-3">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="text-xs font-black text-white">{tx.product_name}</p>
                                                        <p className="text-[9px] text-slate-500 uppercase mt-0.5">{tx.id}</p>
                                                    </div>
                                                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${tx.status === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                                                        tx.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 animate-pulse' :
                                                            'bg-red-500/10 text-red-500 border border-red-500/20'
                                                        }`}>
                                                        {tx.status}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-800/50">
                                                    <div>
                                                        <p className="text-[8px] text-slate-400 uppercase font-black">Target</p>
                                                        <p className="text-[10px] font-mono text-slate-300">{tx.target}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[8px] text-slate-400 uppercase font-black">Harga</p>
                                                        <p className="text-xs font-black text-blue-400">Rp {tx.price.toLocaleString('id-ID')}</p>
                                                    </div>
                                                </div>
                                                {tx.status === 'pending' && (
                                                    <button
                                                        disabled={syncingId === tx.id}
                                                        onClick={() => handleSyncTx(tx.id)}
                                                        className="w-full py-2.5 bg-blue-600/10 text-blue-500 text-[9px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <i className={`fas fa-sync-alt ${syncingId === tx.id ? 'animate-spin' : ''}`}></i>
                                                        Sinkron Status
                                                    </button>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="overflow-x-auto no-scrollbar">
                                    <table className="w-full text-left min-w-[700px] hidden md:table">
                                        <thead className="bg-[#020617] border-b border-slate-800">
                                            <tr>
                                                <th className="px-6 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Metode / ID</th>
                                                <th className="px-6 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Nominal</th>
                                                <th className="px-6 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Waktu</th>
                                                <th className="px-6 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                                                <th className="px-6 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/50">
                                            {deposits.length === 0 ? (
                                                <tr><td colSpan={5} className="py-20 text-center text-slate-600 text-xs italic">Belum ada riwayat deposit.</td></tr>
                                            ) : (
                                                deposits.map(dp => (
                                                    <tr key={dp.id} className="group hover:bg-white/5 transition-all">
                                                        <td className="px-6 py-4">
                                                            <p className="text-xs font-black text-white capitalize">{dp.method}</p>
                                                            <p className="text-[9px] text-slate-500 uppercase mt-0.5">{dp.reff_id}</p>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <p className="font-black text-blue-400 text-xs">Rp {dp.nominal.toLocaleString('id-ID')}</p>
                                                            <p className="text-[8px] text-slate-600">+ biay: Rp {dp.fee}</p>
                                                        </td>
                                                        <td className="px-6 py-4 text-[10px] text-slate-500">
                                                            {new Date(dp.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${dp.status === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                                                                dp.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                                                                    'bg-red-500/10 text-red-500 border border-red-500/20'
                                                                }`}>
                                                                {dp.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                {dp.status === 'pending' && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleSelectDeposit(dp)}
                                                                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
                                                                        >
                                                                            Lihat Detail
                                                                        </button>
                                                                        <button
                                                                            disabled={syncingId === dp.id}
                                                                            onClick={() => handleSyncDepo(dp.id)}
                                                                            className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all disabled:opacity-50"
                                                                            title="Sinkron Status"
                                                                        >
                                                                            <i className={`fas fa-sync-alt text-[10px] ${syncingId === dp.id ? 'animate-spin' : ''}`}></i>
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="md:hidden divide-y divide-slate-800">
                                    {deposits.length === 0 ? (
                                        <p className="py-20 text-center text-slate-600 text-xs italic">Belum ada riwayat deposit.</p>
                                    ) : (
                                        deposits.map(dp => (
                                            <div key={dp.id} className="p-4 space-y-3">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="text-xs font-black text-white capitalize">{dp.method}</p>
                                                        <p className="text-[9px] text-slate-500 uppercase mt-0.5">{dp.reff_id}</p>
                                                    </div>
                                                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${dp.status === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                                                        dp.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                                                            'bg-red-500/10 text-red-500 border border-red-500/20'
                                                        }`}>
                                                        {dp.status}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-800/50">
                                                    <div>
                                                        <p className="text-[8px] text-slate-500 uppercase font-black">Nominal</p>
                                                        <p className="text-xs font-black text-blue-400">Rp {dp.nominal.toLocaleString('id-ID')}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[8px] text-slate-500 uppercase font-black">Waktu</p>
                                                        <p className="text-[10px] text-slate-400">{new Date(dp.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                                    </div>
                                                </div>
                                                {dp.status === 'pending' && (
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button
                                                            onClick={() => handleSelectDeposit(dp)}
                                                            className="py-2.5 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center"
                                                        >
                                                            Detail
                                                        </button>
                                                        <button
                                                            disabled={syncingId === dp.id}
                                                            onClick={() => handleSyncDepo(dp.id)}
                                                            className="py-2.5 bg-slate-800 text-slate-300 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
                                                        >
                                                            <i className={`fas fa-sync-alt ${syncingId === dp.id ? 'animate-spin' : ''}`}></i>
                                                            Sync
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* DEPOSIT DETAIL MODAL */}
            {selectedDeposit && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setSelectedDeposit(null)}></div>
                    <div className="relative w-full max-w-2xl animate-fade-in-up">
                        <div className="glass-card p-4 md:p-10 rounded-[2.5rem] border border-blue-500/30 shadow-2xl bg-slate-900 shadow-blue-500/10">
                            <DepositInvoice
                                deposit={selectedDeposit}
                                methodName={selectedDeposit.method}
                                onClose={() => setSelectedDeposit(null)}
                                onCancel={handleCancelDeposit}
                                onChangeMethod={handleChangeMethod}
                                isProcessing={isCancelProcessing}
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ProfilePage;
