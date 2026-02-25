
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, PanelPackage, PterodactylPanel, PterodactylEgg, PterodactylNest } from '../types';
import { api } from '../services/api';
import Skeleton from '../components/Skeleton';

interface PterodactylPageProps {
    user: User | null;
    refreshUser: () => Promise<void>;
}

const PterodactylPage: React.FC<PterodactylPageProps> = ({ user, refreshUser }) => {
    const navigate = useNavigate();
    const [packages, setPackages] = useState<PanelPackage[]>([]);
    const [nests, setNests] = useState<PterodactylNest[]>([]);
    const [myPanels, setMyPanels] = useState<PterodactylPanel[]>([]);
    const [selectedPackage, setSelectedPackage] = useState<PanelPackage | null>(null);
    const [selectedEgg, setSelectedEgg] = useState<PterodactylEgg | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [isConfigured, setIsConfigured] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [createdPanel, setCreatedPanel] = useState<any>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, [user]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [pkgRes, eggRes] = await Promise.all([
                api.pterodactyl.getPackages(),
                api.pterodactyl.getEggs()
            ]);

            setPackages(pkgRes.data || []);
            setNests(eggRes.data || []);
            setIsConfigured(pkgRes.configured);

            if (user) {
                const panelsRes = await api.pterodactyl.getMyPanels();
                setMyPanels(panelsRes.data || []);
            }
        } catch (err) {
            console.error('Error loading pterodactyl data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePurchase = async () => {
        if (!user || !selectedPackage) return;

        setIsPurchasing(true);
        setStatusMessage(null);
        setCreatedPanel(null);

        try {
            const data = await api.pterodactyl.purchase({
                package_id: selectedPackage.id,
                egg_id: selectedEgg?.id
            });
            if (data.status === 'success') {
                await refreshUser();
                setCreatedPanel(data.data);
                setStatusMessage({ type: 'success', text: 'Panel berhasil dibuat! Lihat detail di bawah.' });
                setShowConfirmModal(false);
                setSelectedPackage(null);
                setSelectedEgg(null);
                await loadData();
            } else {
                setStatusMessage({ type: 'error', text: data.message || 'Gagal membuat panel.' });
            }
        } catch (err: any) {
            setStatusMessage({ type: 'error', text: err.message || 'Gagal terhubung ke server.' });
        } finally {
            setIsPurchasing(false);
            setShowConfirmModal(false);
        }
    };

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const formatSpec = (value: number, unit: string) => {
        return value === 0 ? '∞ Unlimited' : `${value} ${unit}`;
    };

    // Loading skeleton
    if (isLoading) {
        return (
            <div className="animate-fade-in space-y-8 pb-40">
                <Skeleton className="h-48 w-full rounded-3xl" />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <Skeleton key={i} className="h-56 w-full rounded-2xl" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="animate-fade-in space-y-8 md:space-y-12 pb-40">
                {/* HERO BANNER */}
                <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(99,102,241,0.15),transparent_70%)]"></div>
                    <div className="relative px-6 md:px-12 py-10 md:py-16">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-indigo-600/20 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                                <i className="fas fa-server text-indigo-400 text-xl"></i>
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">Pterodactyl Panel</span>
                        </div>
                        <h1 className="text-2xl md:text-4xl font-black text-white leading-tight mb-3">
                            Panel <span className="text-indigo-400">Hosting</span> Instan
                        </h1>
                        <p className="text-xs md:text-sm text-slate-400 font-medium max-w-lg leading-relaxed">
                            Buat panel hosting Pterodactyl sendiri dalam hitungan detik. Pilih paket, bayar dengan saldo, langsung aktif!
                        </p>
                        {!isConfigured && (
                            <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 inline-flex items-center gap-2">
                                <i className="fas fa-exclamation-triangle text-amber-400 text-xs"></i>
                                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Layanan belum dikonfigurasi admin</span>
                            </div>
                        )}
                    </div>
                </section>

                {/* STATUS MESSAGE */}
                {statusMessage && (
                    <div className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border animate-fade-in ${statusMessage.type === 'success'
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                        <i className={`fas ${statusMessage.type === 'success' ? 'fa-check-circle' : 'fa-times-circle'} mr-2`}></i>
                        {statusMessage.text}
                    </div>
                )}

                {/* CREATED PANEL CREDENTIALS */}
                {createdPanel && (
                    <section className="glass-card p-6 md:p-8 rounded-[2rem] border border-green-500/30 bg-green-500/5 animate-fade-in">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-green-600/20 rounded-xl flex items-center justify-center">
                                <i className="fas fa-check-circle text-green-400"></i>
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-tight">Panel Berhasil Dibuat!</h3>
                                <p className="text-[10px] text-green-400 font-bold">Simpan kredensial berikut ini</p>
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-3">
                            {[
                                { label: 'Domain Panel', value: createdPanel.domain, icon: 'fa-globe', key: 'domain' },
                                { label: 'Username', value: createdPanel.panel_username, icon: 'fa-user', key: 'username' },
                                { label: 'Email', value: createdPanel.panel_email, icon: 'fa-envelope', key: 'email' },
                                { label: 'Password', value: createdPanel.panel_password, icon: 'fa-key', key: 'password' },
                            ].map(item => (
                                <div key={item.key} className="bg-slate-950/50 rounded-xl p-4 border border-slate-800 flex items-center justify-between group">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">{item.label}</p>
                                        <p className="text-xs font-bold text-white truncate">{item.value}</p>
                                    </div>
                                    <button
                                        onClick={() => copyToClipboard(item.value, item.key)}
                                        className="ml-3 w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 hover:bg-indigo-600 hover:text-white transition-all shrink-0"
                                    >
                                        <i className={`fas ${copiedField === item.key ? 'fa-check text-green-400' : 'fa-copy'} text-[10px]`}></i>
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 bg-slate-950/50 rounded-xl p-4 border border-slate-800">
                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                                <span className="text-slate-500">Paket</span>
                                <span className="text-indigo-400">{createdPanel.package}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mt-2">
                                <span className="text-slate-500">Spesifikasi</span>
                                <span className="text-white">RAM {formatSpec(createdPanel.memory, 'MB')} · CPU {formatSpec(createdPanel.cpu, '%')} · Disk {formatSpec(createdPanel.disk, 'MB')}</span>
                            </div>
                        </div>
                    </section>
                )}

                {/* PACKAGES GRID */}
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight">Pilih Paket</h2>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{packages.length} paket tersedia</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                        {packages.map(pkg => {
                            const isUnlimited = pkg.memory === 0;
                            return (
                                <button
                                    key={pkg.id}
                                    onClick={() => {
                                        setSelectedPackage(pkg);
                                        setShowConfirmModal(true);
                                        setStatusMessage(null);
                                        setCreatedPanel(null);
                                        // Set default egg if available
                                        if (nests.length > 0 && nests[0].eggs.length > 0 && !selectedEgg) {
                                            setSelectedEgg(nests[0].eggs[0]);
                                        }
                                    }}
                                    disabled={!isConfigured}
                                    className={`relative p-5 md:p-6 rounded-2xl border-2 text-left transition-all group overflow-hidden ${isUnlimited
                                        ? 'border-indigo-500/50 bg-gradient-to-br from-indigo-950/50 to-purple-950/50 hover:border-indigo-400'
                                        : 'border-slate-800 bg-slate-950/50 hover:border-indigo-500/50'
                                        } ${!isConfigured ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {isUnlimited && (
                                        <div className="absolute top-3 right-3">
                                            <span className="text-[8px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-widest">
                                                Best
                                            </span>
                                        </div>
                                    )}

                                    <h3 className="text-lg md:text-xl font-black text-white mb-3 group-hover:text-indigo-400 transition-colors">{pkg.label}</h3>

                                    <div className="space-y-1.5 mb-4">
                                        <div className="flex items-center gap-2 text-[9px] md:text-[10px] text-slate-400">
                                            <i className="fas fa-memory w-4 text-center text-indigo-500/60"></i>
                                            <span>RAM: {formatSpec(pkg.memory, 'MB')}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[9px] md:text-[10px] text-slate-400">
                                            <i className="fas fa-microchip w-4 text-center text-indigo-500/60"></i>
                                            <span>CPU: {formatSpec(pkg.cpu, '%')}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[9px] md:text-[10px] text-slate-400">
                                            <i className="fas fa-hard-drive w-4 text-center text-indigo-500/60"></i>
                                            <span>Disk: {formatSpec(pkg.disk, 'MB')}</span>
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-slate-800">
                                        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">Harga</p>
                                        <p className={`text-base md:text-lg font-black ${isUnlimited ? 'text-indigo-400' : 'text-white'}`}>
                                            Rp {pkg.price.toLocaleString('id-ID')}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* MY PANELS */}
                {user && myPanels.length > 0 && (
                    <section>
                        <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight mb-6">Panel Saya</h2>
                        <div className="space-y-3">
                            {myPanels.map(panel => (
                                <div key={panel.id} className="glass-card p-5 md:p-6 rounded-2xl border border-slate-800 hover:border-indigo-500/30 transition-all">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${panel.status === 'success' ? 'bg-green-500/10 border border-green-500/20' :
                                                panel.status === 'failed' ? 'bg-red-500/10 border border-red-500/20' :
                                                    'bg-amber-500/10 border border-amber-500/20'
                                                }`}>
                                                <i className={`fas ${panel.status === 'success' ? 'fa-check text-green-400' :
                                                    panel.status === 'failed' ? 'fa-times text-red-400' :
                                                        'fa-spinner fa-spin text-amber-400'
                                                    } text-sm`}></i>
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-xs font-black text-white uppercase tracking-tight truncate">{panel.server_name || panel.panel_username}</h4>
                                                <p className="text-[10px] text-slate-500 font-bold">
                                                    {panel.package_id.toUpperCase()} · Rp {panel.price?.toLocaleString('id-ID')} · {new Date(panel.created_at).toLocaleDateString('id-ID')}
                                                </p>
                                            </div>
                                        </div>

                                        {panel.status === 'success' && (
                                            <div className="flex flex-wrap gap-2">
                                                {[
                                                    { label: 'User', value: panel.panel_username },
                                                    { label: 'Email', value: panel.panel_email },
                                                    { label: 'Pass', value: '••••••••' },
                                                ].map(cred => (
                                                    <button
                                                        key={cred.label}
                                                        onClick={() => copyToClipboard(cred.value, `${panel.id}-${cred.label}`)}
                                                        className="bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg px-3 py-2 text-left transition-all group"
                                                    >
                                                        <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">{cred.label}</p>
                                                        <p className="text-[10px] font-bold text-slate-300 group-hover:text-white transition-colors truncate max-w-[120px]">
                                                            {copiedField === `${panel.id}-${cred.label}` ? '✅ Copied!' : cred.value}
                                                        </p>
                                                    </button>
                                                ))}
                                                <a
                                                    href={panel.domain}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/30 rounded-lg px-4 py-2 flex items-center gap-2 transition-all"
                                                >
                                                    <i className="fas fa-external-link-alt text-indigo-400 text-[10px]"></i>
                                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Login Panel</span>
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* NOT LOGGED IN */}
                {!user && (
                    <section className="text-center py-16 glass-card rounded-[2rem] border border-slate-800">
                        <i className="fas fa-lock text-4xl text-slate-800 mb-6"></i>
                        <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mb-2">Login Diperlukan</p>
                        <p className="text-[10px] text-slate-600 font-medium mb-6">Silakan login untuk membeli panel hosting.</p>
                    </section>
                )}
            </div>

            {/* CONFIRM PURCHASE MODAL */}
            {showConfirmModal && selectedPackage && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => !isPurchasing && setShowConfirmModal(false)}>
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
                    <div className="relative bg-slate-900 rounded-[2rem] border border-slate-800 p-6 md:p-8 w-full max-w-md shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
                        <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-600/10 blur-3xl pointer-events-none rounded-full"></div>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                                <i className="fas fa-server text-indigo-400"></i>
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-tight">Konfirmasi Pembelian</h3>
                                <p className="text-[10px] text-slate-500 font-bold">Panel Pterodactyl</p>
                            </div>
                        </div>

                        <div className="space-y-3 mb-6">
                            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Paket</span>
                                    <span className="text-sm font-black text-indigo-400">{selectedPackage.label}</span>
                                </div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">RAM</span>
                                    <span className="text-xs font-bold text-white">{formatSpec(selectedPackage.memory, 'MB')}</span>
                                </div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">CPU</span>
                                    <span className="text-xs font-bold text-white">{formatSpec(selectedPackage.cpu, '%')}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Disk</span>
                                    <span className="text-xs font-bold text-white">{formatSpec(selectedPackage.disk, 'MB')}</span>
                                </div>
                            </div>

                            {/* EGG SELECTION GROUPED BY NEST */}
                            <div className="space-y-4">
                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest ml-1">Tipe Server</label>
                                <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                    {nests.map(nest => (
                                        <div key={nest.id} className="space-y-1.5">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter ml-1">
                                                {nest.name}
                                            </p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {nest.eggs.map(egg => (
                                                    <button
                                                        key={egg.id}
                                                        onClick={() => setSelectedEgg(egg)}
                                                        className={`p-3 rounded-xl border text-left transition-all ${selectedEgg?.id === egg.id
                                                            ? 'border-indigo-500 bg-indigo-500/10'
                                                            : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                                                            }`}
                                                    >
                                                        <p className={`text-[10px] font-black truncate ${selectedEgg?.id === egg.id ? 'text-indigo-400' : 'text-slate-400'}`}>
                                                            {egg.name}
                                                        </p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Saldo Anda</span>
                                    <span className="text-xs font-bold text-blue-400">Rp {user?.balance.toLocaleString('id-ID') || 0}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Total Bayar</span>
                                    <span className="text-lg font-black text-white">Rp {selectedPackage.price.toLocaleString('id-ID')}</span>
                                </div>
                            </div>

                            {user && user.balance < selectedPackage.price && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center gap-2">
                                    <i className="fas fa-exclamation-circle text-red-400 text-xs"></i>
                                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Saldo tidak mencukupi</span>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                disabled={isPurchasing}
                                className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all disabled:opacity-50"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handlePurchase}
                                disabled={isPurchasing || !user || (user && user.balance < selectedPackage.price)}
                                className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all disabled:opacity-30 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                            >
                                {isPurchasing ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                        Memproses...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-shopping-cart"></i>
                                        Beli Sekarang
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default PterodactylPage;
