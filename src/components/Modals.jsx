import Reactimport React, { useState, useRef, useEffect } from 'react';
, { useState, useRef, useEffect } from 'react';
import {
  X, Plus, Trash2, Edit3, Camera, Calculator, Calendar, Tag, ReceiptText, Loader2,
  Sparkles, ChevronDown, ChevronLeft, ChevronRight, Keyboard, Bot, Send, Check, CheckCircle2,
  Globe, Bell, DownloadCloud, Barcode, RefreshCw, Target, Coins, Repeat,
  CalendarHeart, TrendingUp, Save
} from 'lucide-react';
import { getLocalYYYYMMDD, getLocalHHmm, fetchWithBackoff } from '../utils/helpers';
import { serverTimestamp } from 'firebase/firestore';

// ==========================================
// 1. 共用 UI 組件
// ==========================================
export const ToggleSwitch = ({ checked, onChange, isDark }) => (
  <div onClick={() => onChange(!checked)} className={`w-14 h-8 rounded-full cursor-pointer relative transition-colors duration-300 ease-in-out shadow-inner ${checked ? (isDark ? 'bg-indigo-600' : 'bg-[#5C4033]') : (isDark ? 'bg-slate-700/50' : 'bg-stone-300/50')}`}>
    <div className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
  </div>
);

export const SwipeableItem = ({ children, onEdit, onDelete, t }) => {
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollLeft = 80; }, []);
  return (
    <div className="relative w-full rounded-[2rem] overflow-hidden group border border-transparent shadow-sm">
      <div className="absolute inset-0 flex justify-between items-center z-0 px-6 bg-stone-100 dark:bg-slate-800 rounded-[2rem]">
         <div className="flex flex-col items-center justify-center text-emerald-500 font-bold text-xs"><Edit3 className="w-5 h-5 mb-1"/>修改</div>
         <div className="flex flex-col items-center justify-center text-rose-500 font-bold text-xs"><Trash2 className="w-5 h-5 mb-1"/>刪除</div>
      </div>
      <div ref={scrollRef} className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar relative z-10 w-full" style={{ scrollBehavior: 'smooth' }}>
        <div className="snap-center shrink-0 w-[80px] flex items-center justify-center cursor-pointer opacity-0" onClick={onEdit}>.</div>
        <div className={`snap-center shrink-0 w-full ${t.cardInner} shadow-sm border ${t.border} rounded-[2rem] transition-colors group-hover:border-indigo-500/30`}>
          {children}
        </div>
        <div className="snap-center shrink-0 w-[80px] flex items-center justify-center cursor-pointer opacity-0" onClick={onDelete}>.</div>
      </div>
    </div>
  );
};

export const TrendLineChart = ({ data, year, t, isDark }) => {
  const months = Array.from({length: 12}, (_, i) => i);
  const monthlyData = months.map(m => {
    const monthStr = `${year}-${String(m + 1).padStart(2, '0')}`;
    const txs = data.filter(tx => tx.month === monthStr);
    const exp = txs.reduce((sum, tx) => tx.type === 'expense' ? sum + tx.amount : sum, 0);
    const inc = txs.reduce((sum, tx) => tx.type === 'income' ? sum + tx.amount : sum, 0);
    return { month: m + 1, exp, inc };
  });

  const maxVal = Math.max(...monthlyData.map(d => Math.max(d.exp, d.inc)), 1000); 
  const height = 160; const width = 300;
  
  const getCoordinates = (value, index) => {
    const x = (index / 11) * width; const y = height - (value / maxVal) * height;
    return `${x},${y}`;
  };

  const expPath = monthlyData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getCoordinates(d.exp, i)}`).join(' ');
  const incPath = monthlyData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getCoordinates(d.inc, i)}`).join(' ');

  return (
    <div className={`w-full ${t.cardInner} rounded-[2rem] p-6 shadow-lg border ${t.border} relative overflow-hidden mt-6`}>
      <h3 className="font-extrabold text-base mb-6 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-indigo-500"/> 年度收支趨勢</h3>
      <div className="relative w-full overflow-x-auto hide-scrollbar pb-2">
        <svg viewBox={`-10 -10 ${width + 20} ${height + 30}`} className="w-full h-auto drop-shadow-md min-w-[300px]">
          {[0, 0.5, 1].map(ratio => (<line key={ratio} x1="0" y1={height * ratio} x2={width} y2={height * ratio} stroke={isDark ? "#334155" : "#e7e5e4"} strokeWidth="1" strokeDasharray="4 4" />))}
          <path d={incPath} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {monthlyData.map((d, i) => { const [x, y] = getCoordinates(d.inc, i).split(','); return <circle key={`inc-${i}`} cx={x} cy={y} r="4" fill="#10b981" stroke={t.cardInner.replace('bg-', '')} strokeWidth="2" />; })}
          <path d={expPath} fill="none" stroke="#f43f5e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {monthlyData.map((d, i) => { const [x, y] = getCoordinates(d.exp, i).split(','); return <circle key={`exp-${i}`} cx={x} cy={y} r="4" fill="#f43f5e" stroke={t.cardInner.replace('bg-', '')} strokeWidth="2" />; })}
          {monthlyData.map((d, i) => { const x = (i / 11) * width; return <text key={`m-${i}`} x={x} y={height + 20} fontSize="10" fill={isDark ? "#94a3b8" : "#78716c"} textAnchor="middle" fontWeight="bold">{d.month}月</text>; })}
        </svg>
      </div>
      <div className="flex justify-center gap-6 mt-2 text-xs font-bold">
        <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-emerald-500 rounded-full"></span> 總收入</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-rose-500 rounded-full"></span> 總支出</div>
      </div>
    </div>
  );
};

// ==========================================
// 2. 記帳相關 Modals
// ==========================================
export const TxForm = ({ accounts, cats, tags, initialData, templates, settings, allTxs, onAI, onAddTag, onSaveTemplate, onDeleteTemplate, onClose, onSave, t, ui }) => {
  const [data, setData] = useState({ 
    id: initialData?.id || null, type: initialData?.type || 'expense', category: initialData?.category || cats.expense[0]?.name || '餐飲', 
    accountId: initialData?.accountId || (accounts[0]?.id || ''), fromAccountId: initialData?.fromAccountId || (accounts[0]?.id || ''), toAccountId: initialData?.toAccountId || (accounts[1]?.id || ''), 
    amount: initialData ? String(initialData.amount) : '', note: initialData?.note || '', tags: initialData?.tags || [],
    recordDate: initialData?.date || getLocalYYYYMMDD(new Date()), recordTime: initialData?.recordTime || getLocalHHmm(new Date())
  });

  const [displayDate, setDisplayDate] = useState(() => {
    const dStr = initialData?.date || getLocalYYYYMMDD(new Date());
    const [y, m, d] = dStr.split('-'); return `${d}/${m}/${y}`;
  });

  const handleDateType = (e) => {
    let val = e.target.value.replace(/\D/g, ''); 
    if (val.length > 8) val = val.slice(0, 8);
    let formatted = val;
    if (val.length >= 5) formatted = `${val.slice(0,2)}/${val.slice(2,4)}/${val.slice(4)}`;
    else if (val.length >= 3) formatted = `${val.slice(0,2)}/${val.slice(2)}`;
    setDisplayDate(formatted);
    if (val.length === 8) { const d = val.slice(0,2); const m = val.slice(2,4); const y = val.slice(4); setData(prev => ({...prev, recordDate: `${y}-${m}-${d}`})); }
  };

  const handleDateSelect = (e) => { const val = e.target.value; setData(prev => ({...prev, recordDate: val})); if (val) { const [y, m, d] = val.split('-'); setDisplayDate(`${d}/${m}/${y}`); } };
  
  const [splitBill, setSplitBill] = useState(initialData ? (initialData.split !== 'none') : false);
  const [splitRatio, setSplitRatio] = useState(initialData?.splitRatio?.h || 50);

  const safeTravelCurrencies = settings.travelCurrencies || (settings.travelCurrency ? [{code: settings.travelCurrency, rate: settings.travelRate}] : []);
  const [currency, setCurrency] = useState('TWD');

  const [showKeypad, setShowKeypad] = useState(true);
  const [newTag, setNewTag] = useState('');
  const [isOCR, setIsOCR] = useState(false);
  const fileInputRef = useRef(null);
  
  const evaluateMath = (str) => {
    try { if (!str) return ''; const safeStr = str.replace(/×/g, '*').replace(/÷/g, '/'); if (/^[0-9+\-*/.()]+$/.test(safeStr)) { const result = new Function(`return ${safeStr}`)(); return isNaN(result) || !isFinite(result) ? str : String(Math.round(result * 100) / 100); } return str; } catch { return str; }
  };

  const handleKeypadClick = (key) => {
    if (key === 'C') setData({...data, amount: ''}); else if (key === '⌫') setData({...data, amount: data.amount.slice(0, -1)}); else if (key === '=') setData({...data, amount: evaluateMath(data.amount)}); else setData({...data, amount: data.amount + key});
  };

  const submit = () => { 
    let finalAmount = Number(evaluateMath(data.amount));
    if (settings.travelMode && currency !== 'TWD' && finalAmount > 0) { const c = safeTravelCurrencies.find(x => x.code === currency); if (c) { finalAmount = Math.round(finalAmount * c.rate); data.note = `[${c.code} ${data.amount}] ${data.note}`; } }
    if (finalAmount > 0) {
      if (finalAmount > (settings.largeExpenseThreshold || 50000)) { if(!window.confirm(`⚠️ 警告：金額高達 $${finalAmount.toLocaleString()}，請確認是否輸入正確？`)) return; }
      const selectedD = new Date(data.recordDate); const diffDays = (selectedD - new Date()) / 86400000;
      if (diffDays > 7) { if(!window.confirm(`⚠️ 提示：您選擇了未來的日期 (${data.recordDate})，確定要記帳嗎？`)) return; }
      if (!initialData) {
         const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
         const isDuplicate = allTxs.some(t => t.amount === finalAmount && t.category === data.category && (t.createdAt?.toMillis() || 0) > fiveMinsAgo);
         if (isDuplicate) { if(!window.confirm("⚠️ 提示：您在5分鐘內似乎記過一筆一模一樣的帳目，確定要重複記帳嗎？")) return; }
      }
      const acc = accounts.find(a => a.id === data.accountId); const autoPayer = acc ? acc.type : 'joint'; 
      let autoSplit = splitBill ? 'custom' : 'none'; let payloadSplitRatio = splitBill ? { h: splitRatio, w: 100 - splitRatio } : null;
      onSave({...data, amount: finalAmount, payer: autoPayer, split: autoSplit, splitRatio: payloadSplitRatio}); 
    }
  };
  
  const handleAddNewTag = () => { if (newTag.trim() && !tags.includes(newTag.trim())) { onAddTag(newTag.trim()); setData(prev => ({ ...prev, tags: [...prev.tags, newTag.trim()] })); setNewTag(''); } };

  const handleSaveTemplate = () => {
    if (!data.amount || !data.category) return alert("請先填寫金額與分類！");
    const name = window.prompt("請為這個一鍵記帳範本命名 (例如：買咖啡)：");
    if (name) {
      const acc = accounts.find(a => a.id === data.accountId); const autoPayer = acc ? acc.type : 'joint';
      let autoSplit = splitBill ? 'custom' : 'none'; let payloadSplitRatio = splitBill ? { h: splitRatio, w: 100 - splitRatio } : null;
      onSaveTemplate({ name, txData: { ...data, amount: Number(evaluateMath(data.amount)), payer: autoPayer, split: autoSplit, splitRatio: payloadSplitRatio } });
    }
  };

  const handlePhotoUpload = (e) => {
    setIsOCR(true); setTimeout(() => setIsOCR(false), 1500); 
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="flex justify-between items-center px-6 py-5 shrink-0 bg-transparent">
         <div className={`flex ${t.bg} p-1 rounded-2xl border ${t.border} shadow-sm`}>
           <button onClick={() => { setData({...data, type:'expense', category:cats.expense[0]?.name}); }} className={`px-5 py-2 font-bold text-sm rounded-xl transition-all ${data.type === 'expense' ? `${t.cardInner} shadow-sm` : t.textM}`}>支出</button>
           <button onClick={() => { setData({...data, type:'income', category:cats.income[0]?.name}); }} className={`px-5 py-2 font-bold text-sm rounded-xl transition-all ${data.type === 'income' ? `${t.cardInner} shadow-sm` : t.textM}`}>收入</button>
           <button onClick={() => { setData({...data, type:'transfer', category:''}); }} className={`px-5 py-2 font-bold text-sm rounded-xl transition-all ${data.type === 'transfer' ? `${t.cardInner} shadow-sm` : t.textM}`}>轉帳</button>
         </div>
         <button onClick={onClose} className={`p-2 rounded-full ${t.bg} border ${t.border} ${t.textM} hover:opacity-80 active:scale-95`}><X className="w-5 h-5"/></button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 space-y-6 hide-scrollbar pb-10">
        <div className="flex gap-3 items-center w-full">
           {!initialData && (<button onClick={onAI} className={`shrink-0 p-3 rounded-xl border border-indigo-500/30 text-indigo-500 bg-indigo-500/10 active:scale-95 shadow-sm`}><Bot className="w-5 h-5" /></button>)}
           <div className="flex gap-2 overflow-x-auto hide-scrollbar flex-1 items-center">
             <button onClick={handleSaveTemplate} className={`shrink-0 flex items-center justify-center gap-1.5 px-3 py-2 border-2 border-dashed ${t.border} rounded-xl text-xs font-bold ${t.textM} hover:${t.primaryText} transition-colors`}><Save className="w-4 h-4" /> 存為範本</button>
             {templates.map(tpl => (<div key={tpl.id} className={`relative flex items-center shrink-0 ${t.bg} border ${t.border} rounded-xl pl-3 pr-8 py-2 shadow-sm group`}><span onClick={() => setData({ ...data, ...tpl.txData, amount: String(tpl.txData.amount) })} className={`font-bold text-sm cursor-pointer ${t.text}`}>{tpl.name}</span><button onClick={() => onDeleteTemplate(tpl.id)} className="absolute right-2 text-stone-400 hover:text-red-500 transition-colors p-0.5"><X className="w-4 h-4" strokeWidth={3} /></button></div>))}
           </div>
        </div>
        
        {data.type === 'transfer' ? (
          <div className="flex flex-col gap-2">
            <div className="space-y-1"><label className={`font-bold text-xs ${t.textM} px-1`}>從 (轉出)</label><div className={`flex p-1.5 rounded-2xl border ${t.border} ${t.bg} overflow-x-auto hide-scrollbar gap-1 shadow-inner`}>{accounts.map(a => <button key={`from-${a.id}`} onClick={() => setData({...data, fromAccountId: a.id})} className={`shrink-0 px-4 py-3 font-bold text-sm rounded-xl transition-all ${data.fromAccountId === a.id ? `${t.cardInner} shadow-sm ${t.primaryText}` : t.textM}`}>{a.name}</button>)}</div></div>
            <div className="flex justify-center my-1"><ChevronDown className={`w-5 h-5 ${t.textM}`} /></div>
            <div className="space-y-1"><label className={`font-bold text-xs ${t.textM} px-1`}>到 (轉入)</label><div className={`flex p-1.5 rounded-2xl border ${t.border} ${t.bg} overflow-x-auto hide-scrollbar gap-1 shadow-inner`}>{accounts.filter(a => a.id !== data.fromAccountId).map(a => <button key={`to-${a.id}`} onClick={() => setData({...data, toAccountId: a.id})} className={`shrink-0 px-4 py-3 font-bold text-sm rounded-xl transition-all ${data.toAccountId === a.id ? `${t.cardInner} shadow-sm ${t.primaryText}` : t.textM}`}>{a.name}</button>)}</div></div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {cats[data.type] && cats[data.type].map(c => (<button key={c.name} onClick={() => setData({...data, category: c.name})} className={`py-4 rounded-[1.5rem] border-2 ${data.category === c.name ? t.primary + ' text-white border-transparent shadow-md' : `${t.bg} ${t.border}`} flex flex-col items-center transition-all active:scale-95`}><span className="text-3xl mb-1.5">{c.icon}</span><span className="text-xs font-bold">{c.name}</span></button>))}
          </div>
        )}

        {data.type !== 'transfer' && (
          <div className="space-y-2">
            <label className={`font-bold text-xs ${t.textM} px-1`}>帳戶 (系統會自動判斷付款人)</label>
            <div className={`flex p-1.5 rounded-2xl border ${t.border} ${t.bg} overflow-x-auto hide-scrollbar gap-1 shadow-inner`}>{accounts.map(a => <button key={a.id} onClick={() => setData({...data, accountId: a.id})} className={`shrink-0 px-5 py-3 font-bold text-sm rounded-xl transition-all ${data.accountId === a.id ? `${t.cardInner} shadow-sm ${t.primaryText}` : t.textM}`}>{a.name}</button>)}</div>
            {data.type === 'expense' && (
              <div className={`mt-3 px-5 py-4 rounded-[1.5rem] border ${t.border} ${t.bg} shadow-sm space-y-4`}>
                <div className="flex justify-between items-center"><span className={`text-sm font-bold ${t.text}`}>這筆花費要平分嗎？</span><ToggleSwitch checked={splitBill} onChange={setSplitBill} isDark={ui.isDark} /></div>
                {splitBill && (
                  <div className={`pt-4 border-t ${t.border} space-y-3 animate-in fade-in slide-in-from-top-2`}>
                     <div className="flex justify-between text-sm font-black"><span className={t.primaryText}>👨 老公負擔 {splitRatio}%</span><span className="text-pink-500">👩 老婆負擔 {100 - splitRatio}%</span></div>
                     <input type="range" min="0" max="100" step="5" value={splitRatio} onChange={e => setSplitRatio(Number(e.target.value))} className="w-full accent-indigo-500" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        <div className="flex gap-3 relative">
          <div className="flex-1 space-y-2 relative"><label className={`font-bold text-xs ${t.textM} px-1`}>日期 (DD/MM/YYYY)</label><div className="relative"><input type="text" value={displayDate} onChange={handleDateType} placeholder="DD/MM/YYYY" maxLength={10} className={`w-full p-4 pr-12 rounded-2xl ${t.bg} border ${t.border} font-bold text-sm outline-none focus:ring-2 ${t.ring} shadow-inner`} /><div className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center overflow-hidden pointer-events-none"><Calendar className={`w-5 h-5 ${t.textM}`} /></div><input type="date" value={data.recordDate} onChange={handleDateSelect} className="absolute right-0 top-0 w-12 h-full opacity-0 cursor-pointer" /></div></div>
          <div className="flex-1 space-y-2"><label className={`font-bold text-xs ${t.textM} px-1`}>時間</label><input type="time" value={data.recordTime} onChange={e => setData({...data, recordTime: e.target.value})} className={`w-full p-4 rounded-2xl ${t.bg} border ${t.border} font-bold text-sm outline-none focus:ring-2 ${t.ring} shadow-inner`} /></div>
        </div>

        <div className="space-y-3">
          <div className="flex gap-3"><input type="text" placeholder="新增標籤..." value={newTag} onChange={(e) => setNewTag(e.target.value)} className={`flex-1 p-4 rounded-2xl ${t.bg} border ${t.border} font-bold text-sm outline-none focus:ring-2 ${t.ring} shadow-inner`} /><button onClick={handleAddNewTag} disabled={!newTag.trim()} className={`px-6 rounded-2xl ${t.primary} text-white font-bold text-base disabled:opacity-50 shadow-md active:scale-95`}>+</button></div>
          <div className="flex flex-wrap gap-2">{tags.map(tg => (<button key={tg} onClick={() => setData(prev => ({...prev, tags: prev.tags.includes(tg) ? prev.tags.filter(x=>x!==tg) : [...prev.tags, tg]}))} className={`px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all ${data.tags.includes(tg) ? `${t.primary} text-white border-transparent shadow-sm` : `${t.bg} ${t.border}`}`}>#{tg}</button>))}</div>
        </div>

        <div className="flex gap-3 pb-4">
          <input type="text" placeholder="備註..." value={data.note} onChange={e => setData({...data, note: e.target.value})} className={`flex-1 p-4 rounded-2xl ${t.bg} border ${t.border} font-bold text-base outline-none focus:ring-2 ${t.ring} shadow-inner`} />
          <button onClick={() => fileInputRef.current.click()} disabled={isOCR} className={`p-4 rounded-2xl font-bold flex items-center justify-center active:scale-95 ${t.bg} border ${t.border} ${t.textM} relative shadow-sm`}>
            {isOCR ? <Loader2 className="animate-spin w-6 h-6" /> : <Camera className="w-6 h-6" />}<input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handlePhotoUpload} />
          </button>
        </div>
      </div>

      <div className={`shrink-0 bg-[#1c212c] text-white rounded-t-[2rem] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col ${showKeypad ? 'p-6' : 'p-6 pb-10 shadow-[0_-10px_40px_rgba(0,0,0,0.2)]'}`}>
        <div className="flex justify-center -mt-10 mb-4 z-10"><button onClick={() => setShowKeypad(!showKeypad)} className="p-2.5 bg-[#2a303c] rounded-full shadow-xl border border-white/10 hover:bg-[#343b4a] transition-colors active:scale-95">{showKeypad ? <ChevronDown className="w-5 h-5 text-slate-300"/> : <Keyboard className="w-5 h-5 text-slate-300"/>}</button></div>

        {settings.travelMode && data.type === 'expense' && safeTravelCurrencies.length > 0 && (
          <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-4 -mx-2 px-2">
             <button onClick={() => setCurrency('TWD')} className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${currency === 'TWD' ? `bg-indigo-500 text-white shadow-sm` : `bg-[#2a303c] text-slate-400 border border-white/5`}`}>TWD 台幣</button>
             {safeTravelCurrencies.map(c => (<button key={c.code} onClick={() => setCurrency(c.code)} className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${currency === c.code ? `bg-[#0074D9] text-white shadow-sm` : `bg-[#2a303c] text-slate-400 border border-white/5`}`}>{c.code}</button>))}
          </div>
        )}

        <div className={`flex justify-between items-end mb-4`}>
          <span className={`font-bold text-sm ${currency !== 'TWD' ? 'text-[#0074D9]' : 'text-slate-400'}`}>{currency !== 'TWD' ? `輸入外幣 (${currency})` : '輸入金額'}</span>
          <div className="flex items-baseline overflow-hidden px-2"><span className={`text-4xl mr-2 font-light ${currency !== 'TWD' ? 'text-[#0074D9]/50' : 'text-slate-500'}`}>$</span><span className={`text-6xl font-black truncate max-w-[220px] ${!calcStr ? 'opacity-30' : ''} ${currency !== 'TWD' ? 'text-[#0074D9]' : (data.type === 'expense' ? 'text-rose-500' : 'text-emerald-500')}`}>{calcStr || '0'}</span></div>
        </div>

        {showKeypad ? (
          <div className="grid grid-cols-4 gap-3 animate-in slide-in-from-bottom-6 duration-300">
            {['7','8','9','÷', '4','5','6','×', '1','2','3','-', 'C','0','.','+'].map((key) => {
              const isOp = ['÷','×','-','+'].includes(key); const isAc = ['C', '⌫'].includes(key);
              return (<button key={key} type="button" onClick={() => handleKeypadClick(key)} className={`h-14 rounded-2xl text-2xl font-black flex items-center justify-center transition-transform active:scale-90 border ${isOp ? 'bg-[#2a303c] text-rose-500 border-white/5' : isAc ? 'bg-[#2a303c] text-slate-400 border-white/5' : 'bg-[#343b4a] text-white border-white/10 shadow-sm'}`}>{key}</button>) 
            })}
            <button type="button" onClick={() => handleKeypadClick('⌫')} className={`h-14 rounded-2xl text-2xl font-black flex items-center justify-center transition-transform active:scale-90 border bg-[#2a303c] text-slate-400 border-white/5`}>⌫</button>
            <button type="button" onClick={() => handleKeypadClick('00')} className={`h-14 rounded-2xl text-2xl font-black flex items-center justify-center transition-transform active:scale-90 border bg-[#343b4a] text-white border-white/10 shadow-sm`}>00</button>
            <button type="button" onClick={submit} className={`h-14 col-span-2 rounded-2xl text-2xl font-black flex items-center justify-center transition-transform active:scale-95 border border-indigo-400/50 bg-indigo-500 text-white shadow-lg shadow-indigo-500/30`}>OK</button>
          </div>
        ) : (
          <button type="button" onClick={submit} className={`w-full h-16 rounded-2xl text-2xl font-black flex items-center justify-center transition-transform active:scale-95 border border-indigo-400/50 bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 animate-in fade-in`}>
             確認{initialData ? '修改' : '記帳'}
          </button>
        )}
      </div>
    </div>
  );
};

export const AIChatForm = ({ cats, accounts, onBack, onSave, showToast, t, ui, apiKey }) => {
  const [messages, setMessages] = useState([{ id: '1', role: 'ai', text: '哈囉！我是您的專屬理財管家。您可以跟我說：「今天去全聯買菜花了 500 元，老婆付的」，我會自動幫您解析喔！' }]);
  const [inputText, setInputText] = useState(''); const [loading, setLoading] = useState(false); const scrollRef = useRef(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const handleSend = async () => {
    if (!apiKey) return showToast("系統未設定 API 金鑰", "error");
    if (!inputText.trim()) return; 
    
    const userText = inputText.trim();
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: userText }]); setInputText(''); setLoading(true);

    try {
       const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
       const prompt = `您是一個家庭理財的對話機器人。請根據使用者的敘述解析記帳資訊。
       分類選項：${cats.expense.map(c=>c.name).join(', ')}。帳戶選項：${accounts.map(a=>`${a.name}(${a.id})`).join(', ')}。
       請務必以 JSON 格式回覆：
       { "message": "給使用者的對話回覆", "isTransaction": boolean, "transaction": { "type": "expense", "amount": 數字, "category": "分類", "accountId": "帳戶ID", "payer": "husband/wife/joint", "note": "備註" } }`;

       const res = await fetchWithBackoff(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { text: `User: ${userText}` }] }], generationConfig: { responseMimeType: "application/json" } }) });
       if(!res.candidates) throw new Error("API 回傳異常");
       const result = JSON.parse(res.candidates[0].content.parts[0].text.match(/\{[\s\S]*\}/)[0]);
       setMessages(prev => [...prev, { id: Date.now().toString() + 'ai', role: 'ai', text: result.message, txData: result.isTransaction ? result.transaction : null }]);
    } catch (e) { setMessages(prev => [...prev, { id: Date.now().toString() + 'err', role: 'ai', text: '抱歉，我剛剛當機了，請再說一次好嗎？' }]); } finally { setLoading(false); }
  };

  return (
    <div className={`flex flex-col h-full ${t.bg}`}>
      <div className={`flex justify-between items-center px-6 py-5 shrink-0 ${t.cardInner} border-b ${t.border} shadow-sm z-10`}><h3 className="font-black text-xl flex items-center gap-2"><Bot className="w-6 h-6 text-indigo-500"/> AI 理財管家</h3><button onClick={onBack} className={`p-2 rounded-full ${t.bg} border ${t.border} hover:opacity-80 active:scale-95`}><X className="w-5 h-5"/></button></div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-[2rem] p-4 ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : `${t.cardInner} border ${t.border} shadow-sm rounded-tl-sm`}`}>
               <p className={`text-[15px] leading-relaxed font-bold ${msg.role==='user'?'text-white':t.text}`}>{msg.text}</p>
               {msg.txData && (
                 <div className="mt-4 pt-4 border-t border-black/10 dark:border-white/10 space-y-2"><div className="flex justify-between items-center text-sm"><span className="opacity-70">分類</span><span className="font-black">{msg.txData.category}</span></div><div className="flex justify-between items-center text-sm"><span className="opacity-70">金額</span><span className="font-black text-rose-500">${msg.txData.amount}</span></div><div className="flex justify-between items-center text-sm"><span className="opacity-70">付款</span><span className="font-black">{msg.txData.payer === 'husband' ? '老公' : msg.txData.payer === 'wife' ? '老婆' : '共同'}</span></div><button onClick={() => onSave(msg.txData)} className="w-full mt-3 bg-emerald-500 text-white font-black py-3 rounded-xl active:scale-95 shadow-md flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4"/> 確認並記帳</button></div>
               )}
            </div>
          </div>
        ))}
        {loading && (<div className="flex justify-start"><div className={`max-w-[85%] rounded-[2rem] rounded-tl-sm p-4 ${t.cardInner} border ${t.border} shadow-sm`}><Loader2 className="w-5 h-5 animate-spin text-indigo-500"/></div></div>)}
      </div>
      <div className={`shrink-0 p-4 pb-safe bg-transparent border-t ${t.border}`}><div className="flex gap-2"><input type="text" value={inputText} onChange={e => setInputText(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()} placeholder="跟管家說說話..." className={`flex-1 ${t.cardInner} border ${t.border} rounded-full px-5 py-4 font-bold text-sm focus:outline-none focus:ring-2 ring-indigo-500 shadow-sm`} /><button onClick={handleSend} disabled={loading || !inputText.trim()} className="w-14 h-14 shrink-0 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg disabled:opacity-50 active:scale-90"><Send className="w-5 h-5 ml-1"/></button></div></div>
    </div>
  );
};

// ==========================================
// 3. 設定與其他 Modals
// ==========================================
export const SettingsForm = ({ settings, onSave, onExport, onRecurring, t }) => {
  const [s, setS] = useState(settings);
  const [newCurr, setNewCurr] = useState('');
  const isDark = t.bg.includes('0f172a') || t.bg.includes('020617'); 

  const handleAddCurrency = async () => {
    let targetCurrency = newCurr.trim().toUpperCase(); if (!targetCurrency) return;
    const currencyMap = { '日': 'JPY', 'jpy': 'JPY', '韓': 'KRW', 'krw': 'KRW', '美': 'USD', 'usd': 'USD', '歐': 'EUR', 'eur': 'EUR', '港': 'HKD', 'hkd': 'HKD', '泰': 'THB', 'thb': 'THB', '英': 'GBP', 'gbp': 'GBP', '澳': 'AUD', 'aud': 'AUD', '加': 'CAD', 'cad': 'CAD', '新': 'SGD', 'sgd': 'SGD', '馬': 'MYR', 'myr': 'MYR', '越': 'VND', 'vnd': 'VND', '印尼': 'IDR', 'idr': 'IDR', '人民幣': 'CNY', '中': 'CNY', 'cny': 'CNY', 'rmb': 'CNY' };
    for (const [key, value] of Object.entries(currencyMap)) { if (targetCurrency.includes(key)) { targetCurrency = value; break; } }
    if (targetCurrency.length !== 3) return alert("請輸入正確的國家關鍵字或 3 碼幣別");
    const currentList = s.travelCurrencies || []; if (currentList.find(x => x.code === targetCurrency)) return alert(`${targetCurrency} 已經在列表裡囉！`);
    try { const res = await fetch(`https://open.er-api.com/v6/latest/${targetCurrency}`); const data = await res.json(); if (data.result === 'success' && data.rates.TWD) { const rate = Number(data.rates.TWD.toFixed(4)); setS(prev => ({...prev, travelCurrencies: [...(prev.travelCurrencies||[]), {code: targetCurrency, rate}]})); setNewCurr(''); alert(`新增成功！\n1 ${targetCurrency} = ${rate} TWD`); } else alert("找不到該幣別匯率，請手動輸入"); } catch (e) { alert("抓取匯率失敗，請檢查網路"); }
  };

  return (
    <div className="space-y-4">
      <div className={`${t.bg} rounded-3xl p-5 border ${t.border} shadow-sm space-y-4`}><div className="flex justify-between items-center"><span className={`font-bold text-sm ${t.text}`}>系統字體大小</span><div className={`flex p-1 rounded-xl border ${t.border} ${t.cardInner}`}>{['sm:小', 'md:標準', 'lg:大'].map(size => { const [k, l] = size.split(':'); return <button key={k} onClick={() => setS({...s, uiFontSize: k})} className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${s.uiFontSize === k ? `${t.bg} shadow-sm ${t.primaryText}` : t.textM}`}>{l}</button>; })}</div></div></div>
      <div className={`${t.bg} rounded-3xl p-5 border ${t.border} shadow-sm space-y-4`}><div className="flex justify-between items-center"><h4 className={`font-bold text-base flex items-center gap-2 ${s.travelMode ? 'text-[#3b82f6]' : t.text}`}><Globe className="w-5 h-5"/> 多點跨國旅行模式</h4><ToggleSwitch checked={s.travelMode} onChange={val => setS({...s, travelMode: val})} isDark={isDark} /></div>{s.travelMode && (<div className={`space-y-4 pt-3 border-t ${t.border}`}><div className="flex gap-2"><input value={newCurr} onChange={e => setNewCurr(e.target.value)} className={`flex-1 ${t.cardInner} p-3 rounded-xl font-bold text-sm border ${t.border} outline-none focus:ring-2 ${t.ring} shadow-inner`} placeholder="輸入國家或幣別 (如: 日本)" /><button onClick={handleAddCurrency} disabled={!newCurr} className={`px-5 rounded-xl text-sm font-bold text-white bg-[#3b82f6] active:scale-95 shadow-sm disabled:opacity-50`}>新增匯率</button></div><div className="space-y-2">{(s.travelCurrencies || []).map(c => (<div key={c.code} className={`flex justify-between items-center p-3 rounded-xl ${t.cardInner} border ${t.border}`}><span className={`font-black text-sm text-[#3b82f6] w-12`}>{c.code}</span><div className="flex items-center gap-2"><span className={`text-xs ${t.textM}`}>對台幣</span><input type="number" step="0.01" value={c.rate} onChange={e => { const newArr = s.travelCurrencies.map(x => x.code === c.code ? {...x, rate: Number(e.target.value)} : x); setS({...s, travelCurrencies: newArr}); }} className={`w-20 ${t.bg} p-1.5 rounded-lg font-bold text-center border-none outline-none shadow-inner`} /></div><button onClick={() => setS(prev => ({...prev, travelCurrencies: (prev.travelCurrencies||[]).filter(x => x.code !== c.code)}))} className={`text-stone-400 hover:text-red-500`}><X className="w-5 h-5"/></button></div>))}{(s.travelCurrencies || []).length === 0 && <p className={`text-center text-xs font-bold ${t.textM} py-2`}>尚未加入外幣</p>}</div></div>)}</div>
      <div className={`${t.bg} rounded-3xl p-5 border ${t.border} shadow-sm space-y-4`}><h4 className={`font-bold text-sm ${t.textM} mb-2`}>家庭總預算</h4><div className={`flex items-center gap-2 ${t.cardInner} rounded-2xl p-4 shadow-inner`}><span className={`font-bold text-xl ${t.textM}`}>$</span><input type="number" value={s.monthlyBudget} onChange={e => setS({...s, monthlyBudget: Number(e.target.value)})} className={`w-full bg-transparent font-bold text-2xl border-none focus:outline-none`} /></div><div className={`flex justify-between items-center pt-2`}><span className={`font-bold text-sm ${t.text}`}>預算結轉機制</span><ToggleSwitch checked={s.enableRollover} onChange={val => setS({...s, enableRollover: val})} isDark={isDark} /></div></div>
      <div className={`${t.bg} rounded-3xl p-5 border ${t.border} shadow-sm`}><h4 className={`font-bold text-sm ${t.textM} mb-4 flex items-center gap-2`}><Bell className="w-4 h-4"/>防呆與通知中心</h4><div className={`space-y-4 pb-4 border-b ${t.border}`}><div className="flex justify-between items-center"><span className={`font-bold text-sm ${t.text}`}>天價金額防護罩 (記帳警告)</span><ToggleSwitch checked={s.notifyLargeExpense} onChange={val => setS({...s, notifyLargeExpense: val})} isDark={isDark} /></div>{s.notifyLargeExpense && (<div className={`flex items-center gap-3 ${t.cardInner} p-3 rounded-xl shadow-inner`}><span className={`text-xs ${t.textM} font-bold px-1`}>單筆金額大於 $</span><input type="number" value={s.largeExpenseThreshold} onChange={e => setS({...s, largeExpenseThreshold: Number(e.target.value)})} className={`flex-1 bg-transparent font-bold text-base border-none outline-none`} /></div>)}</div><div className="space-y-4 pt-4"><div className="flex justify-between items-center"><span className={`font-bold text-sm ${t.text}`}>帳單到期提醒</span><ToggleSwitch checked={s.notifyBillDue} onChange={val => setS({...s, notifyBillDue: val})} isDark={isDark} /></div><div className="flex justify-between items-center"><span className={`font-bold text-sm ${t.text}`}>紀念日提前提醒</span><ToggleSwitch checked={s.notifyEvents} onChange={val => setS({...s, notifyEvents: val})} isDark={isDark} /></div>{s.notifyEvents && (<div className={`flex items-center gap-3 ${t.cardInner} p-3 rounded-xl shadow-inner`}><span className={`text-xs ${t.textM} font-bold px-1`}>提前幾天提醒？</span><input type="number" value={s.notifyAdvanceDays || 3} onChange={e => setS({...s, notifyAdvanceDays: Number(e.target.value)})} className={`w-16 ${t.bg} p-2 rounded-lg font-bold text-base border-none text-center outline-none`} /><span className={`text-xs ${t.textM} font-bold`}>天</span></div>)}</div></div>
      <button onClick={onRecurring} className={`w-full py-4 rounded-full border ${t.border} ${t.bg} font-bold text-sm flex justify-between items-center px-6 ${t.text} shadow-sm active:scale-95`}><div className="flex items-center gap-2"><Repeat className={`w-5 h-5 ${t.textM}`} /> 設定週期性自動記帳</div><ChevronRight className={`w-5 h-5 ${t.textM}`} /></button>
      <button onClick={() => onSave(s)} className={`w-full py-5 rounded-full font-bold text-lg text-white mt-2 shadow-lg ${t.primary} active:scale-95`}>儲存設定</button>
      <button onClick={onExport} className={`w-full py-5 rounded-full font-bold text-base border ${t.border} mt-2 shadow-sm flex items-center justify-center gap-2 text-[#10b981] ${t.bg} hover:opacity-80 active:scale-95`}><DownloadCloud className="w-5 h-5"/> 匯出 CSV (可匯入 Google Sheets)</button>
    </div>
  );
};

export const BarcodeDisplay = ({ code, t }) => {
  const safeCode = code ? encodeURIComponent(code) : ''; const barcodeUrl = safeCode ? `https://bwipjs-api.metafloor.com/?bcid=code39&text=${safeCode}&scale=3&height=12&includetext=false` : null;
  return (<div className="mb-4"><div className={`bg-white border-2 border-stone-200 rounded-[2rem] p-6 flex flex-col items-center justify-center shadow-sm min-h-[140px]`}>{barcodeUrl ? (<img src={barcodeUrl} alt="Barcode" className="w-full h-20 object-contain mb-4 mix-blend-multiply" />) : (<div className="flex gap-1.5 h-16 mb-4 w-full justify-center opacity-30">{[1,0,1,1,0,1,0,0,1,1,1,0,1,0,1,1,0,0,1,0,1,1].map((v,i) => <div key={i} className={`w-1.5 h-full ${v ? 'bg-[#2A2623]' : 'bg-transparent'}`}></div>)}</div>)}<span className="font-mono font-black text-2xl text-[#2A2623] tracking-[0.2em]">{code || '尚未設定'}</span></div></div>);
};

export const BarcodeForm = ({ codes, onSave, t }) => {
  const [tab, setTab] = useState('h'); const [h, setH] = useState(codes.h || ''); const [w, setW] = useState(codes.w || ''); const [mode, setMode] = useState('view'); 
  return (
    <div className="space-y-5">
      <div className={`flex ${t.bg} p-1.5 rounded-2xl shadow-sm`}><button onClick={() => setTab('h')} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-colors ${tab === 'h' ? `${t.cardInner} shadow-sm ${t.text}` : t.textM}`}>👨 老公</button><button onClick={() => setTab('w')} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-colors ${tab === 'w' ? `${t.cardInner} shadow-sm ${t.text}` : t.textM}`}>👩 老婆</button></div>
      {mode === 'view' ? (<div className={`p-6 rounded-[2rem] ${t.bg} space-y-4 shadow-inner`}><BarcodeDisplay code={tab === 'h' ? h : w} t={t} /><button onClick={() => setMode('edit')} className={`w-full py-4 rounded-xl font-bold text-sm border ${t.border} ${t.cardInner} ${t.text} shadow-sm active:scale-95`}>設定 / 修改條碼</button></div>) : (<div className={`p-6 rounded-[2rem] ${t.bg} space-y-5 shadow-inner`}><div className="space-y-2"><label className={`text-xs font-bold ${t.textM} px-1`}>{tab === 'h' ? '老公' : '老婆'} 手機條碼</label><input value={tab === 'h' ? h : w} onChange={e => tab === 'h' ? setH(e.target.value.toUpperCase()) : setW(e.target.value.toUpperCase())} className={`w-full p-4 rounded-xl uppercase font-mono text-base font-bold ${t.cardInner} border ${t.border} shadow-sm outline-none focus:ring-2 ${t.ring}`} placeholder="/..." /></div><button onClick={() => { onSave(h, w); setMode('view'); }} className={`w-full py-4 rounded-xl font-bold text-base text-white shadow-md ${t.primary} mt-2 active:scale-95`}>儲存設定</button></div>)}
    </div>
  );
};

export const RecurringForm = ({ rules, accounts, cats, onSave, onDelete, t }) => {
  const [view, setView] = useState('list'); const [step, setStep] = useState(1);
  const [r, setR] = useState({ name: '', frequency: 'monthly', interval: 1, txData: { type: 'expense', category: cats.expense[0].name, accountId: accounts[0]?.id||'', amount: '', note: '' } });

  if (view === 'list') return (
    <div className="space-y-5 h-full flex flex-col"><button onClick={() => setView('add')} className={`w-full py-4 rounded-2xl border-2 border-dashed ${t.border} ${t.textM} font-bold text-base flex justify-center items-center gap-2 hover:bg-black/5`}>+ 新增自動記帳規則</button><div className="flex-1 overflow-y-auto space-y-4 scrollbar-hide pb-5">{rules.length === 0 ? <div className={`text-center py-12 text-sm ${t.textM} font-bold border ${t.border} rounded-[2rem] ${t.bg}`}>尚無自動記帳規則</div> : rules.map(rule => (<div key={rule.id} className={`p-5 rounded-3xl border ${t.border} ${t.cardInner} flex justify-between items-center relative shadow-sm`}><div><h4 className="font-extrabold text-base">{rule.name}</h4><p className={`text-xs font-bold ${t.textM} mt-1.5`}>每 {rule.interval} {rule.frequency === 'monthly' ? '個月' : '週'}</p></div><div className="text-right pr-8"><span className="font-black text-xl">${rule.txData.amount}</span><p className={`text-xs font-bold ${t.textM} mt-1`}>{rule.txData.type === 'transfer' ? '轉帳' : rule.txData.category}</p></div><button onClick={() => onDelete(rule.id)} className={`absolute top-5 right-4 ${t.textM} hover:text-red-500 p-1`}><Trash2 className="w-5 h-5" /></button></div>))}</div></div>
  );

  return (
    <div className="space-y-5 h-full flex flex-col"><div className="flex items-center gap-3 mb-2"><button onClick={() => { setView('list'); setStep(1); }} className={`p-2 rounded-full border ${t.border} hover:bg-black/5`}><ChevronLeft className={`w-5 h-5 ${t.textM}`}/></button><span className="font-bold text-base">步驟 {step}/3: {step === 1 ? '基本設定' : step === 2 ? '記帳內容' : '確認規則'}</span></div>{step === 1 && (<div className="space-y-6 flex-1"><input value={r.name} onChange={e => setR({ ...r, name: e.target.value })} placeholder="規則名稱 (如: 每月房租)" className={`w-full p-5 rounded-2xl font-bold text-xl ${t.bg} border-none outline-none shadow-inner`} /><div className="space-y-3"><label className={`font-bold text-sm ${t.textM} px-1`}>多久發生一次？</label><div className="flex gap-4 items-center"><span className="font-bold text-lg px-2">每</span><input type="number" min="1" value={r.interval} onChange={e => setR({ ...r, interval: Number(e.target.value) })} className={`w-24 p-4 rounded-xl font-bold text-xl text-center ${t.bg} border-none outline-none shadow-inner`} /><div className={`flex p-1.5 rounded-xl border ${t.border} ${t.bg} flex-1 shadow-sm`}>{['monthly:個月', 'weekly:週'].map(i => { const [k, l] = i.split(':'); return <button key={k} onClick={() => setR({ ...r, frequency: k })} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${r.frequency === k ? `${t.cardInner} shadow-sm ${t.primaryText}` : t.textM}`}>{l}</button> })}</div></div></div><button onClick={() => setStep(2)} disabled={!r.name} className={`w-full py-5 rounded-2xl font-bold text-lg ${t.primary} text-white shadow-md disabled:opacity-50 mt-auto`}>下一步</button></div>)}{step === 2 && (<div className="space-y-5 flex-1 flex flex-col"><p className={`font-bold text-xs ${t.textM} px-1`}>設定時間到了要自動記下的內容：</p><div className={`flex-1 bg-black/5 rounded-2xl flex items-center justify-center`}><span className={t.textM}>點擊下一步確認即可</span></div><button onClick={() => setStep(3)} className={`w-full py-5 rounded-2xl font-bold text-lg ${t.primary} text-white shadow-md mt-auto`}>下一步</button></div>)}{step === 3 && (<div className="space-y-6 text-center flex-1 flex flex-col justify-center items-center"><Repeat className={`w-20 h-20 mb-2 ${t.textM}`} /><h3 className="font-black text-2xl mb-4">確認建立規則？</h3><div className={`p-6 rounded-[2rem] border ${t.border} ${t.bg} w-full text-left space-y-4 shadow-inner`}><p className="flex justify-between"><span className={`text-sm ${t.textM}`}>名稱：</span><span className="font-bold text-base">{r.name}</span></p><p className="flex justify-between"><span className={`text-sm ${t.textM}`}>頻率：</span><span className="font-bold text-base">每 {r.interval} {r.frequency === 'monthly' ? '個月' : '週'}</span></p><hr className={t.border} /><p className="flex justify-between items-center"><span className={`text-sm ${t.textM}`}>預設金額：</span><span className="font-black text-2xl">$0</span></p></div><button onClick={() => { onSave({ ...r, nextDueDate: new Date(), createdAt: serverTimestamp() }); setView('list'); }} className={`w-full py-5 rounded-2xl font-black text-lg ${t.primary} text-white shadow-md mt-auto active:scale-95`}>確認建立</button></div>)}</div>
  );
};

export const AccForm = ({ onSave, t }) => {
  const [n, setN] = useState(''); const [i, setI] = useState('🏦');
  return (<div className="space-y-5"><div className="space-y-2"><label className={`text-xs font-bold ${t.textM} px-2`}>帳戶名稱</label><input value={n} onChange={e => setN(e.target.value)} placeholder="例如：中信戶頭" className={`w-full p-4 rounded-xl font-bold text-base ${t.bg} border ${t.border} outline-none focus:ring-2 ${t.ring} shadow-inner`} /></div><div className="space-y-2"><label className={`text-xs font-bold ${t.textM} px-2`}>帳戶圖示</label><div className="flex gap-2 text-3xl overflow-x-auto py-2 hide-scrollbar">{['🏦','💳','💵','💼','💎', '🐖', '🪙', '📈', '🏠'].map(x => (<button key={x} onClick={() => setI(x)} className={`p-4 rounded-2xl shrink-0 transition-all ${i === x ? `${t.primaryText} bg-black/10 shadow-inner` : `${t.border} ${t.cardInner} border`}`}>{x}</button>))}</div></div><button onClick={() => onSave({name:n, type:'joint', icon:i, balance:0})} disabled={!n} className={`w-full py-4 rounded-full font-bold text-base text-white shadow-md ${t.primary} disabled:opacity-50 mt-2 active:scale-95`}>建立帳戶</button></div>);
};

export const BillForm = ({ onSave, t }) => {
  const [n, setN] = useState(''); const [a, setA] = useState(''); const [d, setD] = useState(1);
  return (<div className="space-y-5"><input value={n} onChange={e => setN(e.target.value)} placeholder="帳單名稱 (例如: 手機費)" className={`w-full p-4 rounded-xl font-bold text-base ${t.bg} border ${t.border} outline-none focus:ring-2 ${t.ring} shadow-inner`} /><div className="flex gap-3"><div className="flex-1 space-y-2"><label className={`text-xs font-bold ${t.textM} px-2`}>金額</label><input type="number" value={a} onChange={e => setA(e.target.value)} placeholder="0" className={`w-full p-4 rounded-xl font-bold text-base ${t.bg} border ${t.border} outline-none focus:ring-2 ${t.ring} shadow-inner`} /></div><div className="flex-1 space-y-2"><label className={`text-xs font-bold ${t.textM} px-2`}>每月幾號繳？</label><input type="number" min="1" max="31" value={d} onChange={e => setD(e.target.value)} className={`w-full p-4 rounded-xl font-bold text-base text-center ${t.bg} border ${t.border} outline-none focus:ring-2 ${t.ring} shadow-inner`} /></div></div><button onClick={() => onSave({name:n, amount:Number(a), dueDate:Number(d), icon:'🧾'})} disabled={!n || !a} className={`w-full py-4 rounded-full font-bold text-base text-white shadow-md ${t.primary} disabled:opacity-50 mt-2 active:scale-95`}>建立帳單</button></div>);
};

export const NoteForm = ({ data, onSave, onDelete, t }) => {
  const [ti, setTi] = useState(data?.title || ''); const [c, setC] = useState(data?.content || '');
  return (<div className={`space-y-4 flex flex-col h-full bg-[#FEF0C7] text-[#6B4E31] p-6 rounded-[2rem] border border-[#E9C46A] shadow-inner`}><div className={`flex justify-between items-center mb-2 border-b border-[#E9C46A]/50 pb-3`}><input value={ti} onChange={e => setTi(e.target.value)} placeholder="標題..." className={`w-full p-2 font-black text-xl bg-transparent border-none focus:outline-none text-[#6B4E31] placeholder:text-[#6B4E31]/40`} />{data && <Trash2 onClick={() => onDelete(data.id)} className={`text-[#6B4E31]/60 hover:text-red-500 cursor-pointer w-5 h-5 shrink-0`}/>}</div><textarea value={c} onChange={e => setC(e.target.value)} placeholder="內容..." className={`flex-1 w-full p-2 resize-none min-h-[300px] font-bold text-sm bg-transparent border-none focus:outline-none text-[#6B4E31] placeholder:text-[#6B4E31]/40`} /><button onClick={() => onSave({id:data?.id, title:ti, content:c})} disabled={!ti && !c} className={`w-full py-4 rounded-full font-bold text-base text-white shadow-md bg-[#6B4E31] disabled:opacity-50 mt-4 active:scale-95`}>儲存筆記</button></div>);
};

export const EventForm = ({ onSave, t }) => {
  const today = new Date(); const [ti, setTi] = useState(''); const [dateStr, setDateStr] = useState(getLocalYYYYMMDD(today)); const [displayDate, setDisplayDate] = useState(`${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`);
  const handleDateType = (e) => { let val = e.target.value.replace(/\D/g, ''); if (val.length > 8) val = val.slice(0, 8); let formatted = val; if (val.length >= 5) formatted = `${val.slice(0,2)}/${val.slice(2,4)}/${val.slice(4)}`; else if (val.length >= 3) formatted = `${val.slice(0,2)}/${val.slice(2)}`; setDisplayDate(formatted); if (val.length === 8) { const d = val.slice(0,2); const m = val.slice(2,4); const y = val.slice(4); setDateStr(`${y}-${m}-${d}`); } };
  const handleDateSelect = (e) => { const val = e.target.value; setDateStr(val); if (val) { const [y, m, d] = val.split('-'); setDisplayDate(`${d}/${m}/${y}`); } };
  return (<div className="space-y-5"><div className="space-y-2"><label className={`block text-xs font-bold ${t.textM} px-1`}>名稱</label><input value={ti} onChange={e => setTi(e.target.value)} placeholder="名稱 (例如: 結婚紀念日)" className={`w-full p-4 rounded-xl font-bold text-base ${t.bg} border ${t.border} outline-none focus:ring-2 ring-rose-500 shadow-inner`} /></div><div className="space-y-2"><label className={`block text-xs font-bold ${t.textM} px-1`}>日期 (DD/MM/YYYY)</label><div className="relative"><input type="text" value={displayDate} onChange={handleDateType} placeholder="DD/MM/YYYY" maxLength={10} className={`w-full p-4 pr-12 rounded-xl ${t.bg} border ${t.border} font-bold text-base outline-none focus:ring-2 ring-rose-500 shadow-inner`} /><div className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center overflow-hidden"><CalendarHeart className={`w-5 h-5 text-rose-500/50`} /><input type="date" value={dateStr} onChange={handleDateSelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" /></div></div></div><button onClick={() => onSave({title:ti, date:dateStr, icon:'🎉'})} disabled={!ti || !dateStr || displayDate.length !== 10} className={`w-full py-4 rounded-full font-bold text-base text-white shadow-md bg-rose-500 disabled:opacity-50 mt-2 active:scale-95`}>新增日子</button></div>);
};

export const GoalForm = ({ onSave, t }) => {
  const [ti, setTi] = useState(''); const [a, setA] = useState('');
  return (<div className="space-y-5"><input value={ti} onChange={e => setTi(e.target.value)} placeholder="目標名稱 (例如: 歐洲旅遊)" className={`w-full p-4 rounded-xl font-bold text-base ${t.bg} border ${t.border} outline-none focus:ring-2 ${t.ring} shadow-inner`} /><input type="number" value={a} onChange={e => setA(e.target.value)} placeholder="目標金額" className={`w-full p-4 rounded-xl font-bold text-base ${t.bg} border ${t.border} outline-none focus:ring-2 ${t.ring} shadow-inner`} /><button onClick={() => onSave({title:ti, targetAmount:Number(a)})} disabled={!ti || !a} className={`w-full py-4 rounded-full font-bold text-base text-white shadow-md ${t.primary} disabled:opacity-50 mt-2 active:scale-95`}>建立願望</button></div>);
};

export const FundForm = ({ goal, onSave, t }) => {
  const [a, setA] = useState('');
  return (<div className="space-y-6 text-center"><p className={`font-bold text-base ${t.textM} mb-4`}>存入資金到 <span className={`${t.primaryText} ml-1`}>{goal?.title}</span></p><input type="number" value={a} onChange={e => setA(e.target.value)} autoFocus placeholder="$0" className={`w-full py-8 text-center font-black text-6xl bg-transparent border-b-2 ${t.border} ${t.text} focus:outline-none`} /><button onClick={() => onSave(Number(a))} disabled={!a} className={`w-full py-5 rounded-full font-black text-xl text-white shadow-md ${t.primary} disabled:opacity-50 mt-8 active:scale-95`}>確認存入</button></div>);
};
