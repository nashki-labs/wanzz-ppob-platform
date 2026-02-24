
import React, { useState, useEffect } from 'react';


const JsonViewPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [dataType, setDataType] = useState<'products' | 'deposits'>('products');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const url = dataType === 'products' ? '/api/products' : '/api/deposit-methods';
        const res = await fetch(url);
        const json = await res.json();
        setData(json.data || []);
      } catch (err) {
        console.error('Error fetching JSON data:', err);
        setData({ error: 'Failed to fetch data from gateway' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dataType]);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Endpoint JSON</h1>
          <p className="text-slate-500 font-medium">Lihat respon mentah dari API ciaaTopUp secara real-time</p>
        </div>
        <div className="flex bg-slate-900 p-2 rounded-2xl border border-slate-800">
          <button
            onClick={() => setDataType('products')}
            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dataType === 'products' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            List Produk
          </button>
          <button
            onClick={() => setDataType('deposits')}
            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dataType === 'deposits' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Metode Deposit
          </button>
        </div>
      </div>

      <div className="glass-card rounded-[2.5rem] border border-slate-800/50 overflow-hidden relative shadow-2xl">
        {/* Code Header */}
        <div className="bg-slate-900/80 px-8 py-5 border-b border-slate-800 flex justify-between items-center">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-mono text-slate-500 uppercase font-black">application/json</span>
            <button
              onClick={handleCopy}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${copied ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
            >
              <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`}></i>
              {copied ? 'Copied' : 'Copy JSON'}
            </button>
          </div>
        </div>

        {/* JSON Content */}
        <div className="p-8 bg-slate-950 font-mono text-sm overflow-auto max-h-[600px] scrollbar-hide">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
              <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.3em]">Parsing Response...</p>
            </div>
          ) : (
            <pre className="text-blue-400 leading-relaxed">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </div>
      </div>

      {/* API Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-[2rem] border border-slate-800/50">
          <p className="text-[10px] text-slate-500 font-black uppercase mb-3">Gateway Source</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center text-blue-500">
              <i className="fas fa-server"></i>
            </div>
            <span className="font-bold text-slate-200">ciaaTopUp H2H</span>
          </div>
        </div>
        <div className="glass-card p-6 rounded-[2rem] border border-slate-800/50">
          <p className="text-[10px] text-slate-500 font-black uppercase mb-3">Sync Mode</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600/10 rounded-xl flex items-center justify-center text-green-500">
              <i className="fas fa-bolt-lightning"></i>
            </div>
            <span className="font-bold text-slate-200">Real-time Hook</span>
          </div>
        </div>
        <div className="glass-card p-6 rounded-[2rem] border border-slate-800/50">
          <p className="text-[10px] text-slate-500 font-black uppercase mb-3">Response Size</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600/10 rounded-xl flex items-center justify-center text-purple-500">
              <i className="fas fa-file-code"></i>
            </div>
            <span className="font-bold text-slate-200">
              {data ? (JSON.stringify(data).length / 1024).toFixed(2) : 0} KB
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JsonViewPage;
