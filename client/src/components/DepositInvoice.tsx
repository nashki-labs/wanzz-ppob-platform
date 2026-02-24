import React from 'react';
import { Deposit } from '../types';

interface DepositInvoiceProps {
    deposit: Deposit;
    methodName?: string;
    onClose: () => void;
    onCancel?: () => Promise<void>;
    onChangeMethod?: () => void;
    isProcessing?: boolean;
}

const DepositInvoice: React.FC<DepositInvoiceProps> = ({
    deposit,
    methodName,
    onClose,
    onCancel,
    onChangeMethod,
    isProcessing
}) => {
    const isQRIS = deposit.method === 'qris' || (methodName && methodName.toLowerCase().includes('qris'));
    const isVA = deposit.method?.includes('_va') || (methodName && methodName.toLowerCase().includes('virtual account'));

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Berhasil disalin ke clipboard!');
    };

    return (
        <div className="animate-fade-in py-5">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-clock text-2xl text-yellow-500 animate-pulse"></i>
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight text-white">Menunggu Pembayaran</h2>
                <p className="text-slate-400 text-xs mt-1">Silakan selesaikan pembayaran sebelum kadaluwarsa</p>
            </div>

            <div className="space-y-6 bg-slate-950/50 p-6 md:p-8 rounded-3xl border border-slate-800">
                {deposit.qr_image_url && (
                    <div className="bg-white p-4 rounded-2xl mx-auto w-fit mb-6">
                        <img src={deposit.qr_image_url} alt="QRIS" className="w-48 h-48" />
                    </div>
                )}

                {deposit.payment_number && !isQRIS && (
                    <div className="mb-6">
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2 text-center">
                            {isVA ? 'Nomor Virtual Account' : 'Tujuan Pembayaran'}
                        </p>
                        <div className="flex items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-700">
                            <span className={`font-mono font-black text-blue-400 ${isVA ? 'text-xl' : 'text-lg'}`}>
                                {deposit.payment_number}
                            </span>
                            <button
                                onClick={() => copyToClipboard(deposit.payment_number!)}
                                className="p-2 hover:bg-slate-800 rounded-lg text-blue-500 transition-colors"
                                title="Salin Nomor"
                            >
                                <i className="fas fa-copy"></i>
                            </button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-y-4">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">ID Transaksi</span>
                    <span className="text-xs font-mono font-bold text-right text-blue-400 text-wrap break-all">{deposit.reff_id}</span>

                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Metode</span>
                    <span className="text-xs font-bold text-right text-white">{methodName || deposit.method}</span>

                    {deposit.expired_at && (
                        <>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Batas Waktu</span>
                            <span className="text-xs font-bold text-right text-red-400">
                                {new Date(deposit.expired_at).toLocaleString('id-ID')}
                            </span>
                        </>
                    )}

                    <div className="col-span-2 pt-4 border-t border-slate-800 flex justify-between items-center">
                        <span className="text-xs text-slate-200 font-black uppercase">Total Bayar</span>
                        <div className="flex flex-col items-end">
                            <span className="text-2xl font-black text-green-400">
                                Rp {(deposit.total_payment || (deposit.nominal + (deposit.fee || 0))).toLocaleString('id-ID')}
                            </span>
                            <button
                                onClick={() => copyToClipboard((deposit.total_payment || (deposit.nominal + (deposit.fee || 0))).toString())}
                                className="text-[9px] text-blue-400 hover:text-blue-300 font-bold uppercase mt-1"
                            >
                                <i className="fas fa-copy mr-1"></i> Salin Nominal
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 space-y-4">
                <button
                    onClick={onClose}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all shadow-xl shadow-blue-600/20"
                >
                    Tutup
                </button>

                <div className="flex items-center justify-between px-2">
                    {onChangeMethod && (
                        <button
                            onClick={onChangeMethod}
                            className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-400 transition-colors flex items-center gap-2"
                        >
                            <i className="fas fa-sync-alt text-[8px]"></i>
                            Ganti Metode
                        </button>
                    )}

                    {onCancel && (
                        <button
                            onClick={onCancel}
                            disabled={isProcessing}
                            className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-red-500 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            <i className="fas fa-trash-can text-[8px]"></i>
                            {isProcessing ? 'Memproses...' : 'Batalkan'}
                        </button>
                    )}
                </div>
            </div>

            <p className="text-center text-[9px] text-slate-500 mt-6 font-medium">
                <i className="fas fa-info-circle mr-1"></i> Pembayaran akan diverifikasi secara otomatis oleh sistem.
            </p>
        </div>
    );
};

export default DepositInvoice;
