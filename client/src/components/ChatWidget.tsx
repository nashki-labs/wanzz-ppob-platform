
import React, { useState, useEffect, useRef } from 'react';
import { User, ChatMessage } from '../types';
import { api } from '../services/api';

interface ChatWidgetProps {
  user: User | null;
}

const ChatWidget: React.FC<ChatWidgetProps> = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && user) {
      api.messages.getAll()
        .then(json => {
          if (json.status === 'success') {
            setMessages(json.data.map((m: any) => ({
              id: m.id,
              sender: m.sender,
              text: m.text,
              timestamp: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            })));
          }
        })
        .catch(err => console.error('Failed to load messages:', err));
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    if (!user) {
      alert('Silakan login untuk menggunakan layanan chat.');
      return;
    }

    const tempId = Date.now().toString();
    const newMessage: ChatMessage = {
      id: tempId,
      sender: 'user',
      text: message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages([...messages, newMessage]);

    // Save to DB via new centralized API
    api.messages.send(message).catch(console.error);

    setMessage('');

    // Play subtle sound? (Optional)
  };

  return (
    <div className="fixed bottom-28 lg:bottom-8 right-6 lg:right-8 z-40">
      {/* CHAT WINDOW */}
      {isOpen && (
        <div className="absolute bottom-20 right-0 w-[320px] md:w-[380px] h-[500px] glass-card border border-slate-800 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-300">
          {/* HEADER */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                <i className="fas fa-headset text-white"></i>
              </div>
              <div>
                <h4 className="text-white font-black text-sm uppercase tracking-tight">Wanzz Support</h4>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  <span className="text-[10px] text-blue-100 font-bold uppercase tracking-widest">Online</span>
                </div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/60 hover:text-white transition-colors">
              <i className="fas fa-times"></i>
            </button>
          </div>

          {/* MESSAGES */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950/20 backdrop-blur-xl">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4 text-slate-700">
                  <i className="fas fa-comments text-2xl"></i>
                </div>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Punya pertanyaan?</p>
                <p className="text-slate-600 text-[10px] mt-1 leading-relaxed italic">Kirim pesan sekarang, tim admin kami akan segera membantu.</p>
              </div>
            ) : (
              messages.map(m => (
                <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-3xl text-xs font-medium leading-relaxed shadow-lg ${m.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-slate-900 text-slate-300 rounded-tl-none border border-slate-800'
                    }`}>
                    {m.text}
                    <p className={`text-[8px] mt-2 font-black uppercase tracking-widest ${m.sender === 'user' ? 'text-blue-200 text-right' : 'text-slate-500'}`}>{m.timestamp}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* INPUT */}
          <div className="p-4 bg-slate-900/50 border-t border-slate-800 shrink-0">
            <div className="relative">
              <input
                type="text"
                placeholder="Tulis pesan..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3.5 pl-5 pr-12 text-xs text-white outline-none focus:border-blue-500 transition-all shadow-inner"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              />
              <button
                onClick={handleSend}
                className="absolute right-2 top-1.5 w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
              >
                <i className="fas fa-paper-plane text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOGGLE BUTTON */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 md:w-16 md:h-16 rounded-[2rem] flex items-center justify-center text-white text-xl shadow-2xl transition-all hover:scale-110 active:scale-95 ${isOpen ? 'bg-slate-800 rotate-90' : 'bg-blue-600 shadow-blue-600/40'
          }`}
      >
        <i className={`fas ${isOpen ? 'fa-times' : 'fa-comments'}`}></i>
      </button>
    </div>
  );
};

export default ChatWidget;
