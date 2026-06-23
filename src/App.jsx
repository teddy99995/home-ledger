import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Plus, X, Loader2, Trash2, ReceiptText, Sparkles, ChevronLeft, ChevronRight, Target, Coins,
  PieChart as PieChartIcon, ArrowRightLeft, Home, Search, Settings, CheckCircle2, AlertCircle,
  Barcode, ClipboardList, Edit3, CalendarHeart, Wallet, CalendarClock, Check, ShoppingCart,
  DownloadCloud, Image as ImageIcon, AlertTriangle, ChevronDown, Moon, Sun, Filter, Bell,
  Archive, TrendingUp, TrendingDown, Globe, Bot, Send, Save, BellRing, Camera, Keyboard,
  Repeat, Tag, Calendar, Wand2
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore, collection, addDoc, onSnapshot, serverTimestamp, doc,
  deleteDoc, updateDoc, setDoc, arrayUnion, arrayRemove
} from 'firebase/firestore';

// ==========================================
// 1. Firebase 與基礎設定
// ==========================================
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyCegdtoILGfQEQqp7hzK5q--if0hViIOF8",
  authDomain: "our-home-ledger-2254a.firebaseapp.com",
  projectId: "our-home-ledger-2254a",
  storageBucket: "our-home-ledger-2254a.firebasestorage.app",
  messagingSenderId: "862648863577",
  appId: "1:862648863577:web:c72fe356874881ce429a48"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const apiKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) ||
  (typeof process !== 'undefined' && process.env?.REACT_APP_GEMINI_API_KEY) || "";

const isCanvas = typeof __app_id !== 'undefined';
const safeAppId = isCanvas ? String(__app_id) : '';

const getCol = (colName) => {
  return isCanvas
    ? collection(db, 'artifacts', safeAppId, 'public', 'data', String(colName))
    : collection(db, String(colName));
};

const getDocRef = (colName, docId) => {
  if (!docId) throw new Error("無效的資料 ID");
  return isCanvas
    ? doc(db, 'artifacts', safeAppId, 'public', 'data', String(colName), String(docId))
    : doc(db, String(colName), String(docId));
};

// ==========================================
// 2. 常數預設值與工具函數
// ==========================================
const DEFAULT_EXPENSE_CATEGORIES = [
  { name: '餐飲', icon: '🍽️', color: '#D4A373' },
  { name: '飲料', icon: '🧋', color: '#E9C46A' },
  { name: '購物', icon: '🛍️', color: '#A3B18A' },
  { name: '電話費', icon: '📱', color: '#CCD5AE' },
  { name: '居家', icon: '🏠', color: '#F4A261' },
  { name: '娛樂', icon: '🍿', color: '#EAE0D5' },
  { name: '交通', icon: '🚗', color: '#6366F1' },
  { name: '教育', icon: '📚', color: '#8B5CF6' },
  { name: '醫療', icon: '💊', color: '#EF4444' },
  { name: '其他', icon: '✨', color: '#9CA3AF' }
];

const DEFAULT_INCOME_CATEGORIES = [
  { name: '薪資', icon: '💰', color: '#10B981' },
  { name: '投資', icon: '📈', color: '#F59E0B' },
  { name: '獎金', icon: '🎁', color: '#3B82F6' },
  { name: '其他', icon: '✨', color: '#9CA3AF' }
];

function getLocalYYYYMM(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getLocalYYYYMMDD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getLocalHHmm(d) {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function calculateDaysDiff(target) {
  const targetDate = new Date(target).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.ceil((targetDate - today) / 86400000);
}

async function fetchWithBackoff(url, options, retries = 3) {
  const delays = [1000, 2000, 4000];
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
         const errData = await res.json().catch(() => ({}));
         throw new Error(errData.error?.message || `HTTP error! status: ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delays[i]));
    }
  }
}

function evaluateMath(str) {
  try {
    if (!str) return '';
    const safeStr = str.replace(/×/g, '*').replace(/÷/g, '/');
    if (/^[0-9+\-*/.()]+$/.test(safeStr)) {
      const result = new Function(`return ${safeStr}`)();
      return isNaN(result) || !isFinite(result) ? str : String(Math.round(result * 100) / 100);
    }
    return str;
  } catch {
    return str;
  }
}

// ==========================================
// 3. 共用 UI 渲染組件
// ==========================================
function ToggleSwitch({ checked, onChange, isDark }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      className={`w-14 h-8 rounded-full cursor-pointer relative transition-colors duration-300 ease-in-out shadow-inner ${checked ? (isDark ? 'bg-indigo-600' : 'bg-[#5C4033]') : (isDark ? 'bg-slate-700/50' : 'bg-stone-300/50')}`}
    >
      <div className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
    </div>
  );
}

function SwipeableItem({ children, onEdit, onDelete, t }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 80;
    }
  }, []);

  return (
    <div className="relative w-full rounded-[2rem] overflow-hidden group border border-transparent shadow-sm">
      {/* 手機版：背後滑動顯示的按鈕 */}
      <div className="absolute inset-0 flex justify-between items-center z-0 px-6 bg-stone-100 dark:bg-slate-800 rounded-[2rem]">
        <div
          className="flex flex-col items-center justify-center text-emerald-500 font-bold text-xs cursor-pointer hover:opacity-80"
          onClick={onEdit}
        >
          <Edit3 className="w-5 h-5 mb-1" />修改
        </div>
        <div
          className="flex flex-col items-center justify-center text-rose-500 font-bold text-xs cursor-pointer hover:opacity-80"
          onClick={onDelete}
        >
          <Trash2 className="w-5 h-5 mb-1" />刪除
        </div>
      </div>
      
      {/* 滑動容器 */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar relative z-10 w-full"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="snap-center shrink-0 w-[80px] flex items-center justify-center opacity-0" onClick={onEdit}>.</div>
        
        {/* 卡片本體 */}
        <div className={`snap-center shrink-0 w-full ${t.cardInner} shadow-sm border ${t.border} rounded-[2rem] transition-colors relative group-hover:border-indigo-500/30`}>
          {children}
          
          {/* 電腦版專屬：滑鼠移入時顯示的懸浮按鈕 (解決電腦無法滑動的問題) */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm p-1.5 rounded-2xl shadow-sm border border-stone-200 dark:border-slate-700 z-20">
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-2.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl transition-colors">
              <Edit3 className="w-5 h-5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="snap-center shrink-0 w-[80px] flex items-center justify-center opacity-0" onClick={onDelete}>.</div>
      </div>
    </div>
  );
}

function TrendLineChart({ data, year, t, isDark }) {
  const months = Array.from({ length: 12 }, (_, i) => i);
  const monthlyData = months.map(m => {
    const monthStr = `${year}-${String(m + 1).padStart(2, '0')}`;
    const txs = data.filter(tx => tx.month === monthStr);
    const exp = txs.reduce((sum, tx) => tx.type === 'expense' ? sum + (Number(tx.amount) || 0) : sum, 0);
    const inc = txs.reduce((sum, tx) => tx.type === 'income' ? sum + (Number(tx.amount) || 0) : sum, 0);
    return { month: m + 1, exp, inc };
  });

  const maxVal = Math.max(...monthlyData.map(d => Math.max(d.exp, d.inc)), 100);
  const height = 160;
  const width = 300;

  const getCoordinates = (value, index) => {
    const x = (index / 11) * width;
    const y = height - (value / maxVal) * height;
    return `${x},${y}`;
  };

  const expPath = monthlyData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getCoordinates(d.exp, i)}`).join(' ');
  const incPath = monthlyData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getCoordinates(d.inc, i)}`).join(' ');

  return (
    <div className={`w-full ${t.cardInner} rounded-[2rem] p-6 shadow-lg border ${t.border} relative overflow-hidden mt-6`}>
      <h3 className="font-extrabold text-base mb-6 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-indigo-500" /> 年度收支趨勢
      </h3>
      <div className="relative w-full overflow-x-auto hide-scrollbar pb-2">
        <svg viewBox={`-10 -10 ${width + 20} ${height + 30}`} className="w-full h-auto drop-shadow-md min-w-[300px]">
          {[0, 0.5, 1].map(ratio => (
            <line key={ratio} x1="0" y1={height * ratio} x2={width} y2={height * ratio} stroke={isDark ? "#334155" : "#e7e5e4"} strokeWidth="1" strokeDasharray="4 4" />
          ))}
          <path d={incPath} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {monthlyData.map((d, i) => {
            const [x, y] = getCoordinates(d.inc, i).split(',');
            return <circle key={`inc-${i}`} cx={x} cy={y} r="4" fill="#10b981" stroke={t.cardInner.replace('bg-', '')} strokeWidth="2" />;
          })}
          <path d={expPath} fill="none" stroke="#f43f5e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {monthlyData.map((d, i) => {
            const [x, y] = getCoordinates(d.exp, i).split(',');
            return <circle key={`exp-${i}`} cx={x} cy={y} r="4" fill="#f43f5e" stroke={t.cardInner.replace('bg-', '')} strokeWidth="2" />;
          })}
          {monthlyData.map((d, i) => {
            const x = (i / 11) * width;
            return <text key={`m-${i}`} x={x} y={height + 20} fontSize="10" fill={isDark ? "#94a3b8" : "#78716c"} textAnchor="middle" fontWeight="bold">{d.month}月</text>;
          })}
        </svg>
      </div>
      <div className="flex justify-center gap-6 mt-2 text-xs font-bold">
        <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-emerald-500 rounded-full"></span> 總收入</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-rose-500 rounded-full"></span> 總支出</div>
      </div>
    </div>
  );
}

// ==========================================
// 4. 所有獨立彈出視窗元件 (Modals) 
// ==========================================

function FilterTagsModal({ onClose, globalTags, filterTags, setFilterTags, onDeleteTag, t }) {
  const toggleTag = (tag) => {
    if (filterTags.includes(tag)) setFilterTags(filterTags.filter(tg => tg !== tag));
    else setFilterTags([...filterTags, tag]);
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`w-full max-w-md sm:max-w-lg ${t.cardInner} rounded-t-[2.5rem] sm:rounded-[2.5rem] p-7 pb-safe shadow-2xl border ${t.border}`}>
        <div className="flex justify-between items-center mb-6">
          <h3 className={`font-black text-xl ${t.text} flex items-center gap-2`}>
            <Filter className="w-6 h-6" /> 篩選特定標籤
          </h3>
          <button onClick={onClose} className={`p-2.5 ${t.bg} ${t.textM} hover:opacity-80 rounded-full`}>
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="flex flex-wrap gap-3 mb-8">
          {globalTags.length === 0 ? (
            <p className={`text-base ${t.textM} font-bold w-full text-center py-6`}>尚未建立任何標籤</p>
          ) : globalTags.map(tag => {
            const isSelected = filterTags.includes(tag);
            return (
              <div key={tag} className="relative group">
                <button
                  onClick={() => toggleTag(tag)}
                  className={`px-5 py-2.5 rounded-xl text-base font-extrabold transition-all border-2 ${isSelected ? `${t.primary} text-white border-transparent` : `${t.bg} ${t.text} ${t.border}`}`}
                >
                  #{tag}
                </button>
                <button
                  onClick={() => onDeleteTag(tag)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-rose-600"
                  title="徹底刪除此標籤"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
        <button
          onClick={() => { setFilterTags([]); onClose(); }}
          className={`w-full py-4 rounded-xl font-bold text-base ${t.textM} ${t.bg} active:scale-95 border ${t.border}`}
        >
          清除篩選並關閉
        </button>
      </div>
    </div>
  );
}

function DatePickerModal({ onClose, currentDate, onSelect, t }) {
  const [year, setYear] = useState(currentDate.getFullYear());
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`w-full max-w-md sm:max-w-lg ${t.cardInner} rounded-t-[2.5rem] sm:rounded-[2.5rem] p-7 pb-safe shadow-2xl border ${t.border}`}>
        <div className="flex justify-between items-center mb-6">
          <h3 className={`font-black text-xl ${t.text}`}>選擇年月</h3>
          <button onClick={onClose} className={`p-2.5 ${t.bg} ${t.textM} hover:opacity-80 rounded-full`}>
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className={`flex justify-between items-center ${t.bg} p-4 rounded-2xl mb-6 shadow-sm border ${t.border}`}>
          <button onClick={() => setYear(year - 1)} className={`p-2 ${t.textM} hover:bg-black/10 rounded-xl transition-colors`}><ChevronLeft className="w-6 h-6" /></button>
          <span className={`text-2xl font-black ${t.text}`}>{year} 年</span>
          <button onClick={() => setYear(year + 1)} className={`p-2 ${t.textM} hover:bg-black/10 rounded-xl transition-colors`}><ChevronRight className="w-6 h-6" /></button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {months.map(m => {
            const isCurrent = year === currentDate.getFullYear() && m === currentDate.getMonth() + 1;
            return (
              <button
                key={m}
                onClick={() => onSelect(new Date(year, m - 1, 1))}
                className={`py-5 rounded-2xl font-bold text-xl transition-all active:scale-95 border-2 ${isCurrent ? `${t.primary} text-white border-transparent shadow-md` : `${t.bg} ${t.border} ${t.text} hover:opacity-80`}`}
              >
                {m}月
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CategoryManagerModal({ settings, onSaveSettings, onClose, onShowToast, t }) {
  const [tab, setTab] = useState('expense');
  const [expCats, setExpCats] = useState(settings.expenseCategories || DEFAULT_EXPENSE_CATEGORIES);
  const [incCats, setIncCats] = useState(settings.incomeCategories || DEFAULT_INCOME_CATEGORIES);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('✨');
  const [newColor, setNewColor] = useState('#9CA3AF');

  const colors = [
    '#D4A373', '#E9C46A', '#A3B18A', '#F4A261', '#6366F1', '#8B5CF6', '#EF4444',
    '#10B981', '#F59E0B', '#3B82F6', '#9CA3AF', '#F472B6', '#2DD4BF', '#14B8A6'
  ];
  const currentCats = tab === 'expense' ? expCats : incCats;

  const handleAdd = () => {
    if (!newName) return;
    const newCat = { name: newName, icon: newIcon, color: newColor };
    if (tab === 'expense') setExpCats([...expCats, newCat]);
    else setIncCats([...incCats, newCat]);
    setNewName('');
    setNewIcon('✨');
  };

  const handleDelete = (name) => {
    if (tab === 'expense') setExpCats(expCats.filter(c => c.name !== name));
    else setIncCats(incCats.filter(c => c.name !== name));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`w-full max-w-md sm:max-w-lg ${t.cardInner} rounded-t-[2.5rem] sm:rounded-[2.5rem] p-7 pb-safe shadow-2xl border ${t.border} max-h-[90vh] overflow-y-auto hide-scrollbar flex flex-col`}>
        <div className="flex justify-between items-center mb-6 shrink-0">
          <h3 className={`font-black text-2xl ${t.text} flex items-center gap-2`}><Tag className="w-6 h-6" /> 自訂分類</h3>
          <button onClick={onClose} className={`p-2.5 ${t.bg} ${t.textM} rounded-full hover:opacity-80`}>
            <ChevronLeft className="w-6 h-6" />
          </button>
        </div>

        <div className={`flex ${t.bg} p-1.5 rounded-2xl border ${t.border} mb-6 shadow-sm shrink-0`}>
          <button
            onClick={() => setTab('expense')}
            className={`flex-1 py-3 rounded-xl text-base font-extrabold transition-all ${tab === 'expense' ? `${t.cardInner} shadow-sm text-rose-500` : t.textM}`}
          >
            支出分類
          </button>
          <button
            onClick={() => setTab('income')}
            className={`flex-1 py-3 rounded-xl text-base font-extrabold transition-all ${tab === 'income' ? `${t.cardInner} shadow-sm text-emerald-500` : t.textM}`}
          >
            收入分類
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 mb-6 hide-scrollbar">
          {currentCats.map(cat => (
            <div key={cat.name} className={`flex items-center justify-between p-4 rounded-2xl ${t.bg} border ${t.border}`}>
              <div className="flex items-center gap-4">
                <span className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-sm bg-white" style={{ border: `3px solid ${cat.color}` }}>
                  {cat.icon}
                </span>
                <span className={`font-bold text-lg ${t.text}`}>{cat.name}</span>
              </div>
              <button onClick={() => handleDelete(cat.name)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition-colors">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>

        <div className={`p-5 rounded-3xl border ${t.border} ${t.bg} shadow-sm mb-6 space-y-4 shrink-0`}>
          <h4 className={`font-bold text-sm ${t.text}`}>新增分類</h4>
          <div className="flex gap-3">
            <input
              type="text"
              value={newIcon}
              onChange={e => setNewIcon(e.target.value)}
              className={`w-16 text-center text-2xl ${t.cardInner} border ${t.border} rounded-xl outline-none`}
              maxLength={2}
              placeholder="圖示"
            />
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className={`flex-1 px-4 py-3 text-base font-bold ${t.cardInner} border ${t.border} ${t.text} rounded-xl outline-none focus:ring-2 ${t.ring}`}
              placeholder="輸入分類名稱 (如: 保險)"
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            {colors.map(color => (
              <button
                key={color}
                onClick={() => setNewColor(color)}
                className={`w-8 h-8 rounded-full shadow-sm transition-transform ${newColor === color ? `scale-125 ring-2 ring-offset-2 ${t.ring}` : ''}`}
                style={{ backgroundColor: color }}
              ></button>
            ))}
          </div>
          <button
            onClick={handleAdd}
            disabled={!newName}
            className={`w-full mt-2 py-3.5 rounded-xl font-bold text-white shadow-md active:scale-95 transition-colors disabled:opacity-50 ${t.primary}`}
          >
            + 新增至列表
          </button>
        </div>

        <button
          onClick={() => {
            onSaveSettings({ expenseCategories: expCats, incomeCategories: incCats });
            onClose();
            onShowToast('分類已更新！');
          }}
          className={`w-full py-4 shrink-0 rounded-2xl font-black text-lg text-white shadow-lg active:scale-95 ${t.primary}`}
        >
          儲存分類設定
        </button>
      </div>
    </div>
  );
}

function TxFormModal({ ui, settings, activeAccounts, expenseCategories, incomeCategories, globalTags, allTxs, onAddGlobalTag, user, onSave, onClose, onOpenAiChat, onShowToast, t }) {
  const defaultExp = expenseCategories[0] || { name: '未分類' };
  const defaultInc = incomeCategories[0] || { name: '未分類' };

  // 防呆：確保 activeAccounts 不為空，若為空則給予空字串防崩潰
  const safeAccountId1 = activeAccounts.length > 0 ? activeAccounts[0].id : '';
  const safeAccountId2 = activeAccounts.length > 1 ? activeAccounts[1].id : safeAccountId1;

  const [txData, setTxData] = useState({
    id: ui.selectedTx?.id || null,
    type: ui.selectedTx?.type || 'expense',
    category: ui.selectedTx?.category || defaultExp.name,
    accountId: ui.selectedTx?.accountId || safeAccountId1,
    fromAccountId: ui.selectedTx?.fromAccountId || safeAccountId1,
    toAccountId: ui.selectedTx?.toAccountId || safeAccountId2,
    amount: ui.selectedTx ? String(ui.selectedTx.amount) : '',
    note: ui.selectedTx?.note || '',
    tags: ui.selectedTx?.tags || [],
    recordDate: ui.selectedTx?.date || getLocalYYYYMMDD(new Date()),
    recordTime: ui.selectedTx?.recordTime || getLocalHHmm(new Date())
  });

  const [displayDate, setDisplayDate] = useState(() => {
    const dStr = ui.selectedTx?.date || getLocalYYYYMMDD(new Date());
    const [y, m, d] = dStr.split('-');
    return `${d}/${m}/${y}`;
  });

  const [splitBill, setSplitBill] = useState(ui.selectedTx ? (ui.selectedTx.split !== 'none') : false);
  const [splitRatio, setSplitRatio] = useState(ui.selectedTx?.splitRatio?.h ?? 50);
  const [payer, setPayer] = useState(ui.selectedTx?.payer || 'joint');
  const [split, setSplit] = useState(ui.selectedTx?.split || 'half');

  const safeTravelCurrencies = settings.travelCurrencies || [];
  const [currency, setCurrency] = useState('TWD');
  const [showKeypad, setShowKeypad] = useState(!ui.selectedTx);
  const [newTagInput, setNewTagInput] = useState('');
  const [calcStr, setCalcStr] = useState(ui.selectedTx ? String(ui.selectedTx.amount) : '');
  const [isCalculated, setIsCalculated] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(ui.selectedTx?.hasPhoto || false);

  const currentCategories = txData.type === 'expense' ? expenseCategories : incomeCategories;

  const handlePayerChange = (newPayer) => {
    setPayer(newPayer);
    if (newPayer === 'joint') setSplit('joint');
    if (newPayer !== 'joint' && split === 'joint') setSplit('half');
  };

  const handleKeypadClick = (key) => {
    if (key === 'C') {
      setCalcStr('');
      setIsCalculated(false);
    } else if (key === '⌫') {
      if (isCalculated) {
        setCalcStr('');
        setIsCalculated(false);
      } else {
        setCalcStr(prev => prev.slice(0, -1));
      }
    } else if (key === '=') {
      try {
        const result = new Function(`return ${calcStr.replace(/×/g, '*').replace(/÷/g, '/')}`)();
        if (!isNaN(result)) {
          setCalcStr(String(Math.round(result * 100) / 100));
          setIsCalculated(true);
        }
      } catch (e) { }
    } else {
      if (isCalculated && !['+', '-', '×', '÷'].includes(key)) {
        setCalcStr(key);
        setIsCalculated(false);
      } else {
        setCalcStr(prev => prev + key);
        setIsCalculated(false);
      }
    }
  };

  const submitTx = async () => {
    let finalAmount = Number(evaluateMath(calcStr));

    if (settings.travelMode && currency !== 'TWD' && finalAmount > 0) {
      const c = safeTravelCurrencies.find(x => x.code === currency);
      if (c) {
        finalAmount = Math.round(finalAmount * c.rate);
        txData.note = `[${c.code} ${calcStr}] ${txData.note}`;
      }
    }

    if (finalAmount > 0) {
      // 1. 防呆：天價防護罩
      if (finalAmount > (settings.largeExpenseThreshold || 50000)) {
        if (!window.confirm(`⚠️ 警告：金額高達 $${finalAmount.toLocaleString()}，請確認是否輸入正確？`)) return;
      }

      // 2. 防呆：未來日期防穿梭
      const diffDays = (new Date(txData.recordDate).getTime() - new Date().getTime()) / 86400000;
      if (diffDays > 7) {
        if (!window.confirm(`⚠️ 提示：您選擇了未來的日期 (${txData.recordDate})，確定要記帳嗎？`)) return;
      }

      // 3. 防呆：重複記帳攔截 (僅限新增)
      if (!ui.selectedTx) {
        const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
        const isDuplicate = allTxs.some(t =>
          Number(t.amount) === finalAmount &&
          t.category === txData.category &&
          (t.createdAt?.toMillis() || 0) > fiveMinsAgo
        );
        if (isDuplicate) {
          if (!window.confirm("⚠️ 提示：您在5分鐘內似乎記過一筆一模一樣的帳目，確定要重複記帳嗎？")) return;
        }
      }

      const acc = activeAccounts.find(a => a.id === txData.accountId);
      const autoPayer = acc ? acc.type : 'joint';

      const finalPayer = payer || autoPayer;
      let autoSplit = splitBill ? 'custom' : (txData.type === 'expense' ? split : 'none');
      let payloadSplitRatio = splitBill ? { h: splitRatio, w: 100 - splitRatio } : null;

      const payload = {
        ...txData,
        amount: finalAmount,
        payer: finalPayer,
        split: autoSplit,
        splitRatio: payloadSplitRatio,
        hasPhoto,
        date: txData.recordDate,
        month: txData.recordDate.substring(0, 7)
      };

      delete payload.recordDate;
      delete payload.id;

      onSave(payload, ui.selectedTx?.id);
    }
  };

  const getRoleStyle = (role) => role === 'husband' ? 'bg-[#EAE0D5] text-[#6B4E31]' : role === 'wife' ? 'bg-[#FEF0C7] text-[#B57C00]' : 'bg-stone-200 text-stone-600';
  const getRoleName = (role) => role === 'husband' ? '👨 老公' : role === 'wife' ? '👩 老婆' : role === 'half' ? '平分' : '🤝 共同';

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`w-full max-w-md sm:max-w-lg ${t.cardInner} rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col max-h-[96vh] border ${t.border} transition-all duration-300`}>

        {/* 頂部切換 */}
        <div className={`px-7 pt-7 pb-4 shrink-0 border-b ${t.border}`}>
          <div className="flex justify-between items-center mb-4">
            <div className={`flex ${t.bg} p-1.5 rounded-xl border ${t.border}`}>
              <button
                type="button"
                className={`px-6 py-2 rounded-lg text-base font-extrabold transition-all ${txData.type === 'expense' ? `${t.cardInner} shadow-sm ${t.text}` : t.textM}`}
                onClick={() => { setTxData({ ...txData, type: 'expense', category: defaultExp.name }); }}
              >支出</button>
              <button
                type="button"
                className={`px-6 py-2 rounded-lg text-base font-extrabold transition-all ${txData.type === 'income' ? `${t.cardInner} shadow-sm ${t.text}` : t.textM}`}
                onClick={() => { setTxData({ ...txData, type: 'income', category: defaultInc.name }); }}
              >收入</button>
              <button
                type="button"
                className={`px-6 py-2 rounded-lg text-base font-extrabold transition-all ${txData.type === 'transfer' ? `${t.cardInner} shadow-sm ${t.text}` : t.textM}`}
                onClick={() => { setTxData({ ...txData, type: 'transfer', category: '' }); }}
              >轉帳</button>
            </div>
            <button onClick={onClose} className={`p-2.5 ${t.bg} ${t.textM} hover:opacity-80 rounded-full`}>
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* 表單內容 */}
        <div className="flex-1 overflow-y-auto px-7 py-5 space-y-6 hide-scrollbar">

          <div className="flex gap-3 items-center w-full">
            {!ui.selectedTx && (
              <button onClick={onOpenAiChat} className={`shrink-0 p-3 rounded-xl border border-indigo-500/30 text-indigo-500 bg-indigo-500/10 active:scale-95 shadow-sm`}>
                <Bot className="w-5 h-5" />
              </button>
            )}
            {/* 隱藏範本功能，讓介面乾淨 */}
            <div className="flex gap-2 overflow-x-auto hide-scrollbar flex-1 items-center">
               <span className={`text-sm font-bold ${t.textM}`}>記帳好幫手就在左邊 👉</span>
            </div>
          </div>

          <div onClick={() => setShowKeypad(true)} className={`flex flex-col items-center py-5 ${t.bg} rounded-[2rem] border ${t.border} cursor-pointer hover:opacity-80 transition-opacity`}>
            <div className={`flex items-center justify-center gap-1.5 ${t.textM} mb-2`}>
              <Calculator className="w-5 h-5" />
              <span className="text-sm font-bold">{showKeypad ? '輸入中...' : '點擊展開算盤'}</span>
            </div>
            <div className="flex items-baseline justify-center w-full px-4 overflow-hidden">
              <span className={`text-4xl mr-2 font-light ${t.textM}`}>$</span>
              <div className={`text-7xl font-black truncate max-w-[280px] ${!calcStr ? 'opacity-30' : ''} ${txData.type === 'expense' ? 'text-rose-500' : 'text-emerald-500'}`}>
                {calcStr || '0'}
              </div>
            </div>
          </div>

          {txData.type === 'transfer' ? (
            <div className="flex flex-col gap-2">
              <div className="space-y-1">
                <label className={`font-bold text-xs ${t.textM} px-1`}>從 (轉出)</label>
                <div className={`flex p-1.5 rounded-2xl border ${t.border} ${t.bg} overflow-x-auto hide-scrollbar gap-1 shadow-inner`}>
                  {activeAccounts.map(a => (
                    <button
                      key={`from-${a.id}`}
                      onClick={() => setTxData({ ...txData, fromAccountId: a.id })}
                      className={`shrink-0 px-4 py-3 font-bold text-sm rounded-xl transition-all ${txData.fromAccountId === a.id ? `${t.cardInner} shadow-sm ${t.primaryText}` : t.textM}`}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-center my-1"><ChevronDown className={`w-5 h-5 ${t.textM}`} /></div>
              <div className="space-y-1">
                <label className={`font-bold text-xs ${t.textM} px-1`}>到 (轉入)</label>
                <div className={`flex p-1.5 rounded-2xl border ${t.border} ${t.bg} overflow-x-auto hide-scrollbar gap-1 shadow-inner`}>
                  {activeAccounts.filter(a => a.id !== txData.fromAccountId).map(a => (
                    <button
                      key={`to-${a.id}`}
                      onClick={() => setTxData({ ...txData, toAccountId: a.id })}
                      className={`shrink-0 px-4 py-3 font-bold text-sm rounded-xl transition-all ${txData.toAccountId === a.id ? `${t.cardInner} shadow-sm ${t.primaryText}` : t.textM}`}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className={`block text-sm font-bold ${t.textM} mb-3`}>分類</label>
              <div className="grid grid-cols-4 gap-3">
                {currentCategories.map(cat => (
                  <button
                    key={cat.id || cat.name}
                    type="button"
                    onClick={() => setTxData({ ...txData, category: cat.name })}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${txData.category === cat.name ? `border-[#5C4033] bg-[#5C4033]/10` : `border-transparent ${t.textM} ${t.bg}`}`}
                  >
                    <span className="text-2xl mb-1.5">{cat.icon}</span>
                    <span className="text-xs font-extrabold">{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {txData.type !== 'transfer' && (
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-bold ${t.textM} mb-3`}>帳戶</label>
                <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
                  {activeAccounts.map(acc => {
                    const isSelected = txData.accountId === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          setTxData({ ...txData, accountId: acc.id });
                          setPayer(acc.type);
                        }}
                        className={`flex items-center gap-2 shrink-0 px-4 py-2.5 rounded-xl border-2 transition-all ${isSelected ? 'border-[#5C4033] bg-[#5C4033]/10 text-[#5C4033]' : `border-transparent ${t.bg} ${t.textM}`}`}
                      >
                        <span className="text-base">{acc.icon}</span>
                        <span className="text-sm font-extrabold">{acc.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className={`${t.bg} rounded-[2rem] p-5 space-y-5 border ${t.border}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-bold ${t.textM} w-20`}>付款人</span>
                  <div className="flex gap-2">
                    {['husband', 'wife', 'joint'].map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => handlePayerChange(role)}
                        className={`px-4 py-2 rounded-xl text-sm font-extrabold transition-all ${payer === role ? `${getRoleStyle(role)} shadow-sm` : `${t.cardInner} ${t.textM} border ${t.border}`}`}
                      >
                        {getRoleName(role)}
                      </button>
                    ))}
                  </div>
                </div>

                {txData.type === 'expense' && (
                  <div className={`flex flex-col pt-4 border-t ${t.border}`}>
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-sm font-bold ${t.text} w-20`}>進階拆帳？</span>
                      <ToggleSwitch checked={splitBill} onChange={setSplitBill} isDark={ui.isDark} />
                    </div>

                    {splitBill ? (
                      <div className={`space-y-4 animate-in fade-in`}>
                        <div className="flex justify-between text-sm font-black">
                          <span className={t.primaryText}>👨 老公負擔 {splitRatio}%</span>
                          <span className="text-pink-500">👩 老婆負擔 {100 - splitRatio}%</span>
                        </div>
                        <input
                          type="range"
                          min="0" max="100" step="5"
                          value={splitRatio}
                          onChange={e => setSplitRatio(Number(e.target.value))}
                          className="w-full accent-indigo-500"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-bold ${t.textM} w-20`}>負責人</span>
                        <div className="flex gap-2">
                          {payer === 'joint' ? (
                            <span className={`text-sm ${t.textM} italic font-bold px-2 py-1`}>共同負責</span>
                          ) : (
                            ['husband', 'wife', 'half'].map((role) => (
                              <button
                                key={role}
                                type="button"
                                onClick={() => setSplit(role)}
                                className={`px-4 py-2 rounded-xl text-sm font-extrabold transition-all ${split === role ? 'bg-stone-700 text-white shadow-sm' : `${t.cardInner} ${t.textM} border ${t.border}`}`}
                              >
                                {getRoleName(role)}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className={`block text-sm font-bold ${t.textM} mb-3 flex items-center gap-1.5`}><Tag className="w-4 h-4" /> 標籤 (選填)</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {globalTags.map(tag => {
                const isSelected = txData.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (isSelected) setTxData({ ...txData, tags: txData.tags.filter(t => t !== tag) });
                      else setTxData({ ...txData, tags: [...txData.tags, tag] });
                    }}
                    className={`px-4 py-2 rounded-xl text-sm font-extrabold border-2 transition-all ${isSelected ? `${t.primary} text-white border-transparent shadow-sm` : `${t.bg} ${t.textM} border-transparent hover:border-stone-300`}`}
                  >
                    #{tag}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                placeholder="新增新標籤..."
                className={`flex-1 ${t.input} text-base px-4 py-3 rounded-xl focus:outline-none focus:ring-2 ring-black/10 font-bold`}
              />
              <button
                type="button"
                onClick={() => {
                  if (newTagInput.trim() && !globalTags.includes(newTagInput.trim())) {
                    onAddGlobalTag(newTagInput.trim());
                    setTxData({ ...txData, tags: [...txData.tags, newTagInput.trim()] });
                    setNewTagInput('');
                  }
                }}
                disabled={!newTagInput.trim()}
                className={`px-5 rounded-xl ${t.bg} ${t.text} font-black text-lg disabled:opacity-50 active:scale-95 border ${t.border}`}
              >
                +
              </button>
            </div>
          </div>

          <div className="flex gap-3 relative">
            <div className="flex-1 space-y-2 relative">
              <label className={`font-bold text-xs ${t.textM} px-1`}>日期</label>
              <div className="relative">
                <input
                  type="text"
                  value={displayDate}
                  onChange={e => {
                    let val = e.target.value.replace(/\D/g, '');
                    if (val.length > 8) val = val.slice(0, 8);
                    let formatted = val;
                    if (val.length >= 5) formatted = `${val.slice(0, 2)}/${val.slice(2, 4)}/${val.slice(4)}`;
                    else if (val.length >= 3) formatted = `${val.slice(0, 2)}/${val.slice(2)}`;
                    setDisplayDate(formatted);
                    if (val.length === 8) {
                      setTxData({ ...txData, recordDate: `${val.slice(4)}-${val.slice(2, 4)}-${val.slice(0, 2)}` });
                    }
                  }}
                  placeholder="DD/MM/YYYY"
                  maxLength={10}
                  className={`w-full p-4 pr-12 rounded-2xl ${t.bg} border ${t.border} font-bold text-sm outline-none focus:ring-2 ${t.ring} shadow-inner`}
                />
                <div className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center overflow-hidden pointer-events-none">
                  <Calendar className={`w-5 h-5 ${t.textM}`} />
                </div>
                <input
                  type="date"
                  value={txData.recordDate}
                  onChange={e => {
                    setTxData({ ...txData, recordDate: e.target.value });
                    if (e.target.value) {
                      const [y, m, d] = e.target.value.split('-');
                      setDisplayDate(`${d}/${m}/${y}`);
                    }
                  }}
                  className="absolute right-0 top-0 w-12 h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <label className={`font-bold text-xs ${t.textM} px-1`}>時間</label>
              <input
                type="time"
                value={txData.recordTime}
                onChange={e => setTxData({ ...txData, recordTime: e.target.value })}
                className={`w-full p-4 rounded-2xl ${t.bg} border ${t.border} font-bold text-sm outline-none focus:ring-2 ${t.ring} shadow-inner`}
              />
            </div>
          </div>

          <div className="relative flex items-center gap-3 pb-4">
            <div className="relative flex-1">
              <ReceiptText className={`w-5 h-5 ${t.textM} absolute left-4 top-1/2 -translate-y-1/2`} />
              <input
                type="text"
                value={txData.note}
                onChange={(e) => setTxData({ ...txData, note: e.target.value })}
                placeholder="備註 (選填)"
                className={`w-full ${t.input} text-base py-4 pl-12 pr-4 rounded-xl focus:outline-none focus:ring-2 ring-black/10 font-bold border ${t.border}`}
              />
            </div>
            <button
              type="button"
              onClick={() => setHasPhoto(!hasPhoto)}
              className={`p-4 rounded-xl transition-all border ${hasPhoto ? `${t.primary} border-transparent text-white shadow-md` : `${t.cardInner} border ${t.border} ${t.textM}`}`}
            >
              <Camera className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* 數字鍵盤區 */}
        <div className={`shrink-0 ${t.bg} border-t ${t.border} p-5 pb-safe transition-all duration-300`}>
          <div className="flex justify-between items-center mb-4">
            <span className={`text-sm font-bold ${t.textM}`}>金額輸入</span>
            <button
              type="button"
              onClick={() => setShowKeypad(!showKeypad)}
              className={`p-2 rounded-full ${t.cardInner} ${t.textM} border ${t.border} hover:opacity-80`}
            >
              {showKeypad ? <ChevronDown className="w-5 h-5" /> : <Keyboard className="w-5 h-5" />}
            </button>
          </div>

          {settings.travelMode && txData.type === 'expense' && safeTravelCurrencies.length > 0 && (
            <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-4 -mx-2 px-2">
              <button
                onClick={() => setCurrency('TWD')}
                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${currency === 'TWD' ? `bg-indigo-500 text-white shadow-sm` : `bg-[#2a303c] text-slate-400 border border-white/5`}`}
              >
                TWD 台幣
              </button>
              {safeTravelCurrencies.map(c => (
                <button
                  key={c.code}
                  onClick={() => setCurrency(c.code)}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${currency === c.code ? `bg-[#0074D9] text-white shadow-sm` : `bg-[#2a303c] text-slate-400 border border-white/5`}`}
                >
                  {c.code}
                </button>
              ))}
            </div>
          )}

          <div className={`flex justify-between items-end mb-4`}>
            <span className={`font-bold text-sm ${currency !== 'TWD' ? 'text-[#0074D9]' : 'text-slate-400'}`}>
              {currency !== 'TWD' ? `輸入外幣 (${currency})` : '輸入金額'}
            </span>
            <div className="flex items-baseline overflow-hidden px-2">
              <span className={`text-4xl mr-2 font-light ${currency !== 'TWD' ? 'text-[#0074D9]/50' : 'text-slate-500'}`}>$</span>
              <div className={`text-6xl font-black truncate max-w-[220px] ${!calcStr ? 'opacity-30' : ''} ${currency !== 'TWD' ? 'text-[#0074D9]' : (txData.type === 'expense' ? 'text-rose-500' : 'text-emerald-500')}`}>
                {calcStr || '0'}
              </div>
            </div>
          </div>

          {showKeypad && (
            <div className="grid grid-cols-4 gap-3 mb-3 animate-in slide-in-from-bottom-2">
              {['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', 'C', '0', '.', '+'].map((key) => {
                const isOperator = ['+', '-', '×', '÷', '='].includes(key);
                const isAction = ['C', '⌫'].includes(key);
                const btnClass = isOperator ? `bg-black/10 ${t.primaryText} shadow-sm` : isAction ? `bg-black/20 ${t.textM} shadow-sm` : `${t.cardInner} ${t.text} shadow-sm`;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKeypadClick(key)}
                    className={`h-14 rounded-2xl text-2xl font-black flex items-center justify-center transition-transform active:scale-95 border ${t.border} ${btnClass}`}
                  >
                    {key}
                  </button>
                )
              })}
            </div>
          )}

          <button
            type="button"
            onClick={submitTx}
            disabled={!calcStr}
            className={`w-full text-white py-4 rounded-2xl font-black active:scale-95 text-xl mt-2 disabled:opacity-50 transition-colors shadow-lg ${t.primary} shadow-stone-800/20 flex items-center justify-center gap-2`}
          >
            確認記帳
          </button>
        </div>
      </div>
    </div>
  );
}

function AiChatModal({ expenseCategories, activeAccounts, user, apiKey, onSave, onClose, onShowToast, t }) {
  const [messages, setMessages] = useState([{ id: '1', role: 'ai', text: '哈囉！我是您的家庭理財管家。您可以跟我說：「今天去全聯買菜花了 500 元，老婆付的」，我會自動幫您解析喔！' }]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    if (!apiKey) {
      onShowToast("系統未設定 API 金鑰", "error");
      return;
    }
    if (!inputText.trim()) return;

    const userText = inputText.trim();
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: userText }]);
    setInputText('');
    setLoading(true);

    try {
      const prompt = `您是一個家庭理財機器人。請解析記帳資訊。
      分類選項：${expenseCategories.map(c => c.name).join(', ')}。
      帳戶選項：${activeAccounts.map(a => `${a.name}(${a.id})`).join(', ')}。
      請以 JSON 格式回覆：
      { "message": "給使用者的對話回覆", "isTransaction": boolean, "transaction": { "type": "expense", "amount": 數字, "category": "分類", "accountId": "帳戶ID", "payer": "husband/wife/joint", "split": "none/half", "note": "備註" } }`;

      const res = await fetchWithBackoff(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { text: `User: ${userText}` }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      const resJson = await res.json();
      if (resJson.error) throw new Error(resJson.error.message);

      const result = JSON.parse(resJson.candidates[0].content.parts[0].text.match(/\{[\s\S]*\}/)[0]);
      if (result.isTransaction && result.transaction && !result.transaction.split) result.transaction.split = 'none';

      setMessages(prev => [...prev, {
        id: Date.now().toString() + 'ai',
        role: 'ai',
        text: result.message,
        txData: result.isTransaction ? result.transaction : null
      }]);
    } catch (e) {
      setMessages(prev => [...prev, { id: Date.now().toString() + 'err', role: 'ai', text: '抱歉，我剛剛當機了，請再試一次好嗎？' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200`}>
      <div className={`w-full max-w-md sm:max-w-lg ${t.cardInner} rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col h-[90vh] sm:h-[80vh] border ${t.border}`}>
        <div className={`flex justify-between items-center px-6 py-5 shrink-0 border-b ${t.border} z-10`}>
          <h3 className={`font-black text-xl flex items-center gap-2 ${t.text}`}>
            <Bot className="w-6 h-6 text-indigo-500" /> AI 理財管家
          </h3>
          <button onClick={onClose} className={`p-2.5 ${t.bg} ${t.textM} hover:opacity-80 rounded-full`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-[2rem] p-4 ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : `${t.bg} border ${t.border} shadow-sm rounded-tl-sm`}`}>
                <p className={`text-[15px] leading-relaxed font-bold ${msg.role === 'user' ? 'text-white' : t.text}`}>{msg.text}</p>
                {msg.txData && (
                  <div className="mt-4 pt-4 border-t border-black/10 dark:border-white/10 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="opacity-70">分類</span>
                      <span className="font-black">{msg.txData.category}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="opacity-70">金額</span>
                      <span className="font-black text-rose-500">${msg.txData.amount}</span>
                    </div>
                    <button
                      onClick={() => {
                        const payload = {
                          ...msg.txData,
                          date: getLocalYYYYMMDD(new Date()),
                          month: getLocalYYYYMMDD(new Date()).substring(0, 7),
                          recordTime: getLocalHHmm(new Date())
                        };
                        onSave(payload, null);
                      }}
                      className="w-full mt-3 bg-emerald-500 text-white font-black py-3 rounded-xl active:scale-95 shadow-md flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> 確認並記帳
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className={`max-w-[85%] rounded-[2rem] rounded-tl-sm p-4 ${t.bg} border ${t.border} shadow-sm`}>
                <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
              </div>
            </div>
          )}
        </div>

        <div className={`shrink-0 p-4 pb-safe bg-transparent border-t ${t.border}`}>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSend()}
              placeholder="跟管家說說話..."
              className={`flex-1 ${t.bg} border ${t.border} ${t.text} rounded-full px-5 py-4 font-bold text-sm focus:outline-none focus:ring-2 ring-indigo-500 shadow-sm`}
            />
            <button
              onClick={handleSend}
              disabled={loading || !inputText.trim()}
              className="w-14 h-14 shrink-0 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg disabled:opacity-50 active:scale-90"
            >
              <Send className="w-5 h-5 ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ onClose, settings, onSave, onExport, theme: t }) {
  const [budget, setBudget] = useState(settings.monthlyBudget || '');
  const [enableRollover, setEnableRollover] = useState(settings.enableRollover !== false);
  const [notifyBillDue, setNotifyBillDue] = useState(settings.notifyBillDue !== false);
  const [notifyEvents, setNotifyEvents] = useState(settings.notifyEvents !== false);
  const [notifyLargeExpense, setNotifyLargeExpense] = useState(settings.notifyLargeExpense !== false);
  const [largeExpenseThreshold, setLargeExpenseThreshold] = useState(settings.largeExpenseThreshold || 3000);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className={`w-full max-w-sm sm:max-w-lg ${t.cardInner} rounded-t-[2.5rem] sm:rounded-[2.5rem] p-7 pb-safe shadow-2xl border ${t.border} max-h-[90vh] overflow-y-auto hide-scrollbar`}>
        <div className="flex justify-between items-center mb-6">
          <h3 className={`font-black text-2xl ${t.text}`}>⚙️ 設定與管理</h3>
          <button onClick={onClose} className={`p-2.5 ${t.bg} ${t.textM} rounded-full hover:opacity-80`}>
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="space-y-5">
          <div className={`${t.bg} p-5 rounded-3xl border ${t.border} shadow-sm`}>
            <label className={`block text-base font-bold ${t.text} mb-3`}>每月家庭總預算</label>
            <div className="flex items-center gap-3 mb-5">
              <div className="relative flex-1">
                <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${t.textM} font-black text-lg`}>$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                  className={`w-full ${t.cardInner} border ${t.border} ${t.text} rounded-2xl pl-9 pr-4 py-4 text-base font-black focus:outline-none shadow-inner`}
                />
              </div>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-black/5">
              <span className={`text-sm font-extrabold ${t.textM}`}>預算結轉機制</span>
              <ToggleSwitch checked={enableRollover} onChange={() => setEnableRollover(!enableRollover)} />
            </div>
          </div>

          <div className={`${t.bg} p-5 rounded-3xl border ${t.border} shadow-sm`}>
            <div className="flex items-center gap-2 mb-4 border-b border-black/5 pb-3">
              <BellRing className={`w-6 h-6 ${t.text}`} />
              <h4 className={`font-black text-lg ${t.text}`}>推播與通知中心</h4>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-black/5">
              <span className={`text-sm font-extrabold ${t.textM}`}>帳單到期提醒</span>
              <ToggleSwitch checked={notifyBillDue} onChange={() => setNotifyBillDue(!notifyBillDue)} />
            </div>

            <div className="flex items-center justify-between py-3 border-b border-black/5">
              <span className={`text-sm font-extrabold ${t.textM}`}>紀念日提前提醒</span>
              <ToggleSwitch checked={notifyEvents} onChange={() => setNotifyEvents(!notifyEvents)} />
            </div>

            <div className="flex items-center justify-between pt-3">
              <span className={`text-sm font-extrabold ${t.textM}`}>大額消費防護網</span>
              <ToggleSwitch checked={notifyLargeExpense} onChange={() => setNotifyLargeExpense(!notifyLargeExpense)} />
            </div>
            {notifyLargeExpense && (
              <div className="ml-2 mt-3 flex items-center gap-3 bg-black/5 p-3 rounded-xl border border-black/5">
                <span className={`text-sm font-bold ${t.textM}`}>觸發大於 $</span>
                <input
                  type="number"
                  value={largeExpenseThreshold}
                  onChange={(e) => setLargeExpenseThreshold(Number(e.target.value))}
                  className={`w-24 px-3 py-2 text-base font-black rounded-xl ${t.input} focus:outline-none text-center shadow-inner`}
                />
              </div>
            )}
          </div>

          <button
            onClick={() => onSave({
              monthlyBudget: Number(budget), enableRollover,
              notifyBillDue, notifyEvents, notifyLargeExpense, largeExpenseThreshold
            })}
            className={`w-full ${t.primary} text-white py-4 rounded-2xl font-black text-lg active:scale-95 shadow-lg`}
          >
            儲存所有設定
          </button>

          <div className="bg-emerald-500/10 p-5 rounded-3xl border border-emerald-500/20 flex flex-col items-start mt-8">
            <div className="flex items-center gap-2 mb-2"><DownloadCloud className="w-6 h-6 text-emerald-600" /><span className="font-black text-emerald-600 text-lg">資料匯出</span></div>
            <p className="text-sm text-emerald-600/80 mb-5 font-bold leading-relaxed">將所有帳目下載為 CSV 檔案，可直接丟進 Google Sheets 或是 Excel 進行進階分析。</p>
            <button
              onClick={onExport}
              className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors active:scale-95 shadow-md"
            >
              匯出至 Excel / Sheets
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BarcodeModal({ onClose, barcodes, onSaveSettings, t }) {
  const [activeTab, setActiveTab] = useState('husband');
  const [isEditing, setIsEditing] = useState(false);

  const [hCode, setHCode] = useState(barcodes.husbandBarcode || '');
  const [wCode, setWCode] = useState(barcodes.wifeBarcode || '');

  const displayCode = activeTab === 'husband' ? hCode || '/HUSBAND' : wCode || '/WIFEXXX';
  const safeCode = displayCode ? encodeURIComponent(displayCode) : '';
  const barcodeUrl = safeCode ? `https://bwipjs-api.metafloor.com/?bcid=code39&text=${safeCode}&scale=3&height=12&includetext=false` : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`w-full max-w-md sm:max-w-lg ${t.cardInner} rounded-t-[2.5rem] sm:rounded-[2.rem] p-7 pb-safe shadow-2xl border ${t.border}`}>
        <div className="flex justify-between items-center mb-6">
          <h3 className={`font-black text-xl ${t.text} flex items-center gap-2`}>
            <Barcode className={`w-6 h-6 ${t.textM}`} /> 發票載具
          </h3>
          <button onClick={onClose} className={`p-2.5 ${t.bg} ${t.textM} rounded-full`}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className={`flex ${t.bg} p-1.5 rounded-2xl border ${t.border} mb-6 shadow-sm`}>
          <button
            onClick={() => setActiveTab('husband')}
            className={`flex-1 py-3 rounded-xl text-base font-extrabold transition-all ${activeTab === 'husband' ? `${t.cardInner} shadow-sm text-[#6B4E31]` : t.textM}`}
          >👨 老公</button>
          <button
            onClick={() => setActiveTab('wife')}
            className={`flex-1 py-3 rounded-xl text-base font-extrabold transition-all ${activeTab === 'wife' ? `${t.cardInner} shadow-sm text-[#B57C00]` : t.textM}`}
          >👩 老婆</button>
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div className={`p-5 rounded-3xl border ${t.border} ${t.bg} shadow-sm`}>
              <h4 className={`text-base font-extrabold mb-4 ${t.text}`}>👨 老公載具設定</h4>
              <input
                type="text"
                value={hCode}
                onChange={e => setHCode(e.target.value)}
                className={`w-full ${t.cardInner} border ${t.border} ${t.text} rounded-xl px-4 py-4 font-mono text-base uppercase font-bold focus:outline-none`}
                placeholder="輸入手機條碼"
              />
            </div>

            <div className={`p-5 rounded-3xl border ${t.border} ${t.bg} shadow-sm`}>
              <h4 className={`text-base font-extrabold mb-4 ${t.text}`}>👩 老婆載具設定</h4>
              <input
                type="text"
                value={wCode}
                onChange={e => setWCode(e.target.value)}
                className={`w-full ${t.cardInner} border ${t.border} ${t.text} rounded-xl px-4 py-4 font-mono text-base uppercase font-bold focus:outline-none`}
                placeholder="輸入手機條碼"
              />
            </div>

            <button
              onClick={() => {
                onSaveSettings({ husbandBarcode: hCode, wifeBarcode: wCode });
                setIsEditing(false);
              }}
              className={`w-full mt-4 ${t.primary} text-white font-black py-4 rounded-2xl active:scale-95 shadow-md`}
            >儲存設定</button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="bg-white border-2 border-stone-200 rounded-[2rem] p-5 w-full flex flex-col items-center justify-center py-10 shadow-sm relative overflow-hidden">
              {barcodeUrl ? (
                <img src={barcodeUrl} alt="Barcode" className="w-full h-24 object-contain mb-4 mix-blend-multiply" />
              ) : (
                <div className="flex h-24 w-full justify-center overflow-hidden mb-5 opacity-30">
                  {Array.from({ length: 40 }).map((_, i) => (<div key={i} className="h-full bg-black" style={{ width: `${Math.random() * 4 + 1}px`, marginRight: `${Math.random() * 4 + 1}px` }}></div>))}
                </div>
              )}
              <span className="font-mono text-3xl tracking-[0.2em] font-black text-stone-800">{displayCode}</span>
            </div>

            <button
              onClick={() => setIsEditing(true)}
              className={`text-sm font-extrabold ${t.primaryText} mt-5 px-5 py-2.5 bg-black/5 rounded-full hover:bg-black/10 transition-colors`}
            >
              修改手機條碼
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 5. Main App Component
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  
  // Data States
  const [data, setData] = useState({
    tx: [], accounts: [], bills: [], notes: [], shopping: [], goals: [], events: [], tags: [], recurringRules: [], templates: []
  });
  
  // UI States
  const [ui, setUi] = useState(() => ({
    date: new Date(), endDate: new Date(), dateFilterMode: 'month',
    tab: 'home', subTab: 'bills', statsView: 'month', chartView: 'expense',
    modal: null, search: '', filterTags: [], filterAccount: 'all',
    isDark: localStorage.getItem('homeLedgerTheme') !== 'light',
    confirm: null, toast: null, selectedTx: null, selectedItem: null
  }));
  
  // Settings State
  const [settings, setSettings] = useState({
    monthlyBudget: 50000, husbandBarcode: '', wifeBarcode: '',
    enableRollover: true, notifyLargeExpense: true, largeExpenseThreshold: 3000,
    notifyBillDue: true, notifyEvents: true, notifyAdvanceDays: 3,
    travelMode: false, travelCurrencies: [], uiFontSize: 'md',
    expenseCategories: DEFAULT_EXPENSE_CATEGORIES, incomeCategories: DEFAULT_INCOME_CATEGORIES
  });
  
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const processedRecurring = useRef(false);

  const expenseCategories = settings.expenseCategories && settings.expenseCategories.length > 0 ? settings.expenseCategories : DEFAULT_EXPENSE_CATEGORIES;
  const incomeCategories = settings.incomeCategories && settings.incomeCategories.length > 0 ? settings.incomeCategories : DEFAULT_INCOME_CATEGORIES;

  const updateUi = (updates) => {
    setUi(prev => {
      const next = { ...prev, ...updates };
      if (updates.hasOwnProperty('isDark')) localStorage.setItem('homeLedgerTheme', updates.isDark ? 'dark' : 'light');
      return next;
    });
  };

  const showToast = (msg, type = 'success') => {
    updateUi({ toast: { msg, type } });
    setTimeout(() => updateUi({ toast: null }), 4000);
  };

  // Auth Effect
  useEffect(() => {
    if (navigator.userAgent.includes("Line") && !window.location.href.includes("openExternalBrowser=1")) {
      window.location.replace(window.location.href + (window.location.href.includes("?") ? "&" : "?") + "openExternalBrowser=1");
    }
    signInAnonymously(auth).catch(() => showToast("登入失敗", "error"));
    return onAuthStateChanged(auth, setUser);
  }, []);

  // Data Sync Effect
  useEffect(() => {
    if (!user) return;
    const unsubs = [
      onSnapshot(getCol('shared_accounts'), snap => {
        if (snap.empty) {
          [{ id: 'acc_joint', name: '共同生活金', type: 'joint', icon: '🏦', archived: false },
           { id: 'acc_h', name: '老公帳戶', type: 'husband', icon: '👨', archived: false },
           { id: 'acc_w', name: '老婆帳戶', type: 'wife', icon: '👩', archived: false }]
           .forEach(d => setDoc(getDocRef('shared_accounts', d.id), { ...d, createdAt: serverTimestamp() }));
        } else {
          const arr = []; snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
          setData(prev => ({ ...prev, accounts: arr.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0)) }));
        }
      }),
      onSnapshot(getDocRef('shared_settings', 'main'), docSnap => {
        if (docSnap.exists()) setSettings(prev => ({ ...prev, ...docSnap.data() }));
      }),
      onSnapshot(getCol('shared_ledger'), snap => {
        const arr = []; snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
        setData(p => ({ ...p, tx: arr.sort((a, b) => (a.date !== b.date) ? (b.date || '').localeCompare(a.date || '') : (b.recordTime || '').localeCompare(a.recordTime || '')) }));
      }),
      onSnapshot(getCol('shared_bills'), snap => {
        const arr = []; snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
        setData(p => ({ ...p, bills: arr.sort((a, b) => a.dueDate - b.dueDate) }));
      }),
      onSnapshot(getCol('shared_goals'), snap => {
        const arr = []; snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
        setData(p => ({ ...p, goals: arr.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0)) }));
      }),
      onSnapshot(getCol('shared_events'), snap => {
        const arr = []; snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
        setData(p => ({ ...p, events: arr.sort((a, b) => calculateDaysDiff(a.date) - calculateDaysDiff(b.date)) }));
      }),
      onSnapshot(getDocRef('shared_tags', 'main'), docSnap => {
        setData(prev => ({ ...prev, tags: docSnap.exists() ? (docSnap.data().tags || []) : [] }));
      }),
      onSnapshot(getCol('shared_notes'), snap => {
        const arr = []; snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
        setData(p => ({ ...p, notes: arr.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0)) }));
      }),
      onSnapshot(getCol('shared_shopping'), snap => {
        const arr = []; snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
        setData(p => ({ ...p, shopping: arr.sort((a, b) => a.completed === b.completed ? ((b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)) : (a.completed ? 1 : -1)) }));
      }),
      onSnapshot(getCol('recurring_rules'), snap => {
        const arr = []; snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
        setData(prev => ({ ...prev, recurringRules: arr }));
      })
    ];
    return () => unsubs.forEach(u => u());
  }, [user]);

  // Recurring Processing Effect
  useEffect(() => {
    if (!user || data.recurringRules.length === 0 || processedRecurring.current) return;
    const processRules = async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      let processedCount = 0;
      for (const rule of data.recurringRules) {
        if (!rule.nextDueDate) continue;
        const dueDate = rule.nextDueDate.toDate(); dueDate.setHours(0, 0, 0, 0);
        if (dueDate <= today) {
          await addDoc(getCol('shared_ledger'), {
            ...rule.txData, date: getLocalYYYYMMDD(dueDate), month: getLocalYYYYMM(dueDate),
            recordTime: "08:00", createdAt: serverTimestamp(), createdBy: user.uid, tags: [...(rule.txData.tags || []), '週期性']
          });
          const next = new Date(dueDate);
          if (rule.frequency === 'monthly') next.setMonth(next.getMonth() + rule.interval);
          else next.setDate(next.getDate() + rule.interval * 7);
          await updateDoc(getDocRef('recurring_rules', rule.id), { nextDueDate: next });
          processedCount++;
        }
      }
      if (processedCount > 0) showToast(`已自動建立 ${processedCount} 筆週期性記帳！`);
      processedRecurring.current = true;
    };
    processRules();
  }, [user, data.recurringRules]);

  // Calculations & Filtering
  const activeAccounts = useMemo(() => data.accounts.filter(a => !a.archived), [data.accounts]);
  const cMonth = getLocalYYYYMM(ui.date);
  const cYear = String(ui.date.getFullYear());

  const activeTxs = useMemo(() => {
    if (ui.dateFilterMode === 'month') return data.tx.filter(t => t.month === cMonth);
    if (ui.dateFilterMode === 'year') return data.tx.filter(t => t.date?.startsWith(cYear));
    if (ui.dateFilterMode === 'custom') return data.tx.filter(t => t.date >= getLocalYYYYMMDD(ui.date) && t.date <= getLocalYYYYMMDD(ui.endDate));
    return [];
  }, [data.tx, ui.dateFilterMode, cMonth, cYear, ui.date, ui.endDate]);

  const filteredActiveTxs = useMemo(() => (!ui.filterAccount || ui.filterAccount === 'all') ? activeTxs : activeTxs.filter(t => t.accountId === ui.filterAccount), [activeTxs, ui.filterAccount]);
  const displayTx = useMemo(() => filteredActiveTxs.filter(t => (!ui.search || t.category?.includes(ui.search) || t.note?.includes(ui.search)) && (ui.filterTags.length === 0 || ui.filterTags.every(tag => t.tags?.includes(tag)))), [filteredActiveTxs, ui.search, ui.filterTags]);

  const calcStats = (txs) => txs.reduce((s, t) => {
    if (t.type === 'transfer') return s;
    const amount = Number(t.amount) || 0;
    if (t.type === 'expense') { s.exp += amount; s.expCat[t.category] = (s.expCat[t.category] || 0) + amount; }
    else if (t.type === 'income') { s.inc += amount; s.incCat[t.category] = (s.incCat[t.category] || 0) + amount; }
    return s;
  }, { exp: 0, inc: 0, expCat: {}, incCat: {} });

  const hStats = calcStats(filteredActiveTxs);
  const tStats = calcStats(filteredActiveTxs);

  const chartData = useMemo(() => {
    const isExp = ui.chartView === 'expense';
    const targetTotal = isExp ? tStats.exp : tStats.inc;
    const targetCat = isExp ? tStats.expCat : tStats.incCat;
    return Object.entries(targetCat).map(([name, value]) => {
      const catObj = (isExp ? expenseCategories : incomeCategories).find(c => c.name === name);
      return { name, value, percentage: Math.round((value / (targetTotal || 1)) * 100), color: catObj?.color || '#9CA3AF', icon: catObj?.icon || '✨' };
    }).sort((a, b) => b.value - a.value);
  }, [tStats, ui.chartView, expenseCategories, incomeCategories]);

  const rollover = useMemo(() => {
    if (!settings.enableRollover) return { enabled: false, amt: 0, budget: settings.monthlyBudget };
    const pMonth = getLocalYYYYMM(new Date(ui.date.getFullYear(), ui.date.getMonth() - 1, 1));
    const pExp = data.tx.filter(t => t.month === pMonth && t.type === 'expense').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const amt = (pExp < settings.monthlyBudget && pExp > 0) ? settings.monthlyBudget - pExp : 0;
    return { enabled: true, amt, budget: settings.monthlyBudget + amt };
  }, [settings.monthlyBudget, settings.enableRollover, ui.date, data.tx]);

  const accBal = useMemo(() => {
    const balances = {}; data.accounts.forEach(a => balances[a.id] = Number(a.balance) || 0);
    data.tx.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'transfer') {
        if (balances[t.fromAccountId] !== undefined) balances[t.fromAccountId] -= amt;
        if (balances[t.toAccountId] !== undefined) balances[t.toAccountId] += amt;
      }
      else if (balances[t.accountId] !== undefined) balances[t.accountId] += (t.type === 'expense' ? -amt : amt);
    });
    return balances;
  }, [data.accounts, data.tx]);
  const totalAssets = Object.values(accBal).reduce((s, b) => s + b, 0);

  const settlement = useMemo(() => {
    let hOwesW = 0, wOwesH = 0;
    activeTxs.forEach(t => {
      if (t.type !== 'expense' || t.split === 'none') return;
      let ratioH = 0.5, ratioW = 0.5;
      if (t.split === 'custom' && t.splitRatio) { ratioH = Number(t.splitRatio.h) / 100; ratioW = Number(t.splitRatio.w) / 100; }
      const amt = Number(t.amount) || 0;
      if (t.payer === 'husband') wOwesH += (amt * ratioW); else if (t.payer === 'wife') hOwesW += (amt * ratioH);
    });
    const net = wOwesH - hOwesW;
    if (net > 0.01) return { status: 'unsettled', who: 'wife', to: 'husband', amt: net };
    if (net < -0.01) return { status: 'unsettled', who: 'husband', to: 'wife', amt: Math.abs(net) };
    return { status: 'settled' };
  }, [activeTxs]);

  const activeAlerts = useMemo(() => {
    const a = []; const today = new Date().getDate(); const notifyDays = settings.notifyAdvanceDays || 3;
    if (settings.notifyBillDue) {
      data.bills.forEach(b => { if (!b.isPaid && b.dueDate - today >= 0 && b.dueDate - today <= notifyDays) a.push({ id: `b_${b.id}`, icon: b.icon || '🧾', title: '帳單到期', desc: `${b.name} 將在 ${b.dueDate - today === 0 ? '今天' : `${b.dueDate - today} 天後`} 到期` }); });
    }
    if (settings.notifyEvents) {
      data.events.forEach(e => { const d = calculateDaysDiff(e.date); if (d >= 0 && d <= notifyDays) a.push({ id: `e_${e.id}`, icon: e.icon || '🎉', title: '紀念日提醒', desc: `${e.title} 還有 ${d} 天` }); });
    }
    if (settings.notifyLargeExpense) {
      data.tx.filter(t => t.month === cMonth).slice(0, 15).forEach(t => { if (t.type === 'expense' && Number(t.amount) >= (settings.largeExpenseThreshold || 3000)) a.push({ id: `t_${t.id}`, icon: '💸', title: '大額消費防護', desc: `${t.payer === 'husband' ? '老公' : t.payer === 'wife' ? '老婆' : '共同'} 記了一筆 $${Number(t.amount).toLocaleString()}` }); });
    }
    return a.filter(al => !dismissedAlerts.includes(al.id));
  }, [data, settings, cMonth, dismissedAlerts]);

  // Handlers
  const confirmAction = (msg, action, requireText = null) => { updateUi({ confirm: { message: msg, requireText, onConfirm: async () => { try { await action(); showToast("操作已成功執行"); } catch (e) { showToast(`操作失敗: ${e.message}`, "error"); } finally { updateUi({ confirm: null }); } } } }); };
  
  const handleAddGlobalTag = async (tagName) => {
    if (!tagName.trim() || data.tags.includes(tagName)) return;
    try { await setDoc(getDocRef('shared_tags', 'main'), { tags: arrayUnion(tagName) }, { merge: true }); showToast(`標籤 #${tagName} 已建立`); } catch (err) {}
  };

  const handleCallAI = async () => {
    if (!apiKey) return showToast("系統未設定 API 金鑰！請在環境變數設定", "error");
    setIsAiLoading(true); setAiAnalysis('');
    try {
      const topExpCats = Object.entries(tStats.expCat).map(([n,v]) => ({name:n, val:v})).sort((a,b)=>b.val-a.val).slice(0,3).map(c => `${c.name}(${Math.round(c.val/(tStats.exp||1)*100)}%)`).join('、');
      let stext = settlement.status === 'settled' ? "無欠款" : (settlement.who === 'husband' ? `老婆需給老公${Math.round(settlement.amt)}` : `老公需給老婆${Math.round(settlement.amt)}`);
      const prompt = `這是家庭帳本本月紀錄：支出${tStats.exp}元。前三花費:${topExpCats || '無'}。結算:${stext}。請用溫馨朋友語氣給一段50字理財建議(不列點)。`;
      
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`;
      const options = {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      };

      const resData = await fetchWithBackoff(url, options);
      if (!resData || !resData.candidates) throw new Error("API 回傳格式錯誤或遭拒絕，請確認金鑰權限");
      setAiAnalysis(resData.candidates[0].content.parts[0].text);
    } catch (err) { setAiAnalysis(`AI 服務連線異常：${err.message}`); } finally { setIsAiLoading(false); }
  };

  const handleSaveTx = async (payload, id) => {
    try {
      if (id) await updateDoc(getDocRef('shared_ledger', id), { ...payload, updatedAt: serverTimestamp() });
      else await addDoc(getCol('shared_ledger'), { ...payload, createdAt: serverTimestamp(), createdBy: user?.uid || 'unknown' });
      updateUi({ modal: null, selectedTx: null }); showToast('記帳成功');
    } catch (e) { showToast(`失敗: ${e.message}`, "error"); }
  };

  const handleToggleArchiveAccount = async (accId, isArchived) => {
    try { await updateDoc(getDocRef('shared_accounts', accId), { archived: !isArchived }); showToast(isArchived ? "帳戶已解封" : "帳戶已封存，歷史明細將被保留"); } catch (e) {}
  };

  const handleExportToSheets = () => {
    if (data.tx.length === 0) return showToast("目前沒有資料可以匯出喔！", "error");
    const BOM = "\uFEFF";
    const headers = ['日期', '時間', '類型', '分類/轉出', '帳戶/轉入', '金額', '備註', '付款人', '結算', '標籤'];
    const rows = data.tx.map(tx => {
      const typeLabel = tx.type === 'expense' ? '支出' : tx.type === 'income' ? '收入' : '轉帳';
      const catOrFrom = tx.type === 'transfer' ? data.accounts.find(a => a.id === tx.fromAccountId)?.name : tx.category;
      const accOrTo = tx.type === 'transfer' ? data.accounts.find(a => a.id === tx.toAccountId)?.name : data.accounts.find(a => a.id === tx.accountId)?.name;
      const payerLabel = tx.payer === 'husband' ? '老公' : tx.payer === 'wife' ? '老婆' : '共同';
      let splitLabel = '-';
      if (tx.type === 'expense') {
        if (tx.split === 'none') splitLabel = '不平分';
        else if (tx.split === 'custom' && tx.splitRatio) splitLabel = `男${tx.splitRatio.h}女${tx.splitRatio.w}`;
        else splitLabel = '平分';
      }
      return [tx.date, tx.recordTime || '', typeLabel, catOrFrom || '', accOrTo || '', tx.amount, `"${tx.note || ''}"`, payerLabel, splitLabel, tx.tags ? `"${tx.tags.join(';')}"` : ''].join(",");
    });
    const csvContent = BOM + headers.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url;
    link.setAttribute('download', `HomeLedger_${getLocalYYYYMMDD(new Date())}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    showToast("匯出成功！");
  };

  // Theme Generation
  let t = ui.isDark ? { bg: 'bg-[#0f172a]', cardInner: 'bg-[#1e293b]', text: 'text-[#f8fafc]', textM: 'text-[#94a3b8]', primary: 'bg-[#6366f1]', primaryText: 'text-[#818cf8]', border: 'border-[#334155]', input: 'bg-[#0f172a] text-white', ring: 'focus:ring-indigo-500' } : { bg: 'bg-[#fafaf9]', cardInner: 'bg-white', text: 'text-[#292524]', textM: 'text-[#78716c]', primary: 'bg-[#0f172a]', primaryText: 'text-[#0f172a]', border: 'border-[#e7e5e4]', input: 'bg-[#fafaf9] text-[#292524]', ring: 'focus:ring-[#0f172a]' };
  if (settings.travelMode) t = { ...t, bg: ui.isDark ? 'bg-[#020617]' : 'bg-[#f0f9ff]', primary: ui.isDark ? 'bg-[#3b82f6]' : 'bg-[#2563eb]', primaryText: ui.isDark ? 'text-[#60a5fa]' : 'text-[#2563eb]' };
  const rootFontSize = settings.uiFontSize === 'sm' ? '14px' : settings.uiFontSize === 'lg' ? '18px' : '16px';

  return (
    <React.Fragment>
      <style dangerouslySetInnerHTML={{
        __html: `:root { font-size: ${rootFontSize} !important; } .pb-safe { padding-bottom: calc(1.5rem + env(safe-area-inset-bottom)); } .pt-safe { padding-top: calc(1rem + env(safe-area-inset-top)); } .hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; } body { background-color: ${t.bg.replace('bg-[', '').replace(']', '')}; margin: 0; padding: 0; transition: background-color 0.5s ease; } input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 24px; height: 24px; border-radius: 50%; background: white; box-shadow: 0 2px 6px rgba(0,0,0,0.2); cursor: pointer; border: 2px solid #6366F1; margin-top: -8px; } input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 8px; cursor: pointer; background: #334155; border-radius: 4px; }`
      }} />

      <div className={`min-h-[100dvh] w-full flex justify-center ${t.bg} transition-colors duration-500 overflow-x-hidden font-sans`}>
        <div className={`w-full max-w-md md:max-w-xl ${t.text} relative flex flex-col min-h-[100dvh] ${t.cardInner} md:border-x md:shadow-2xl ${t.border}`}>

          {/* 刪除確認 Modal */}
          {ui.confirm && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-5 animate-in fade-in duration-200">
              <div className={`${t.cardInner} rounded-[2rem] p-8 w-full max-w-sm shadow-2xl text-center border ${t.border}`}>
                <AlertTriangle className="w-16 h-16 text-rose-500 mx-auto mb-5 bg-rose-500/10 p-3 rounded-full" />
                <h3 className={`text-xl font-black ${t.text} mb-4`}>{ui.confirm.message}</h3>
                {ui.confirm.requireText && (
                  <div className="mb-6">
                    <p className={`text-xs ${t.textM} mb-2`}>請輸入 <span className="font-black text-rose-500">{ui.confirm.requireText}</span>：</p>
                    <input type="text" id="confirmInput" placeholder={ui.confirm.requireText} className={`w-full text-center p-3 rounded-xl font-bold ${t.bg} border ${t.border} outline-none focus:ring-2 ring-rose-500`} onChange={(e) => { const btn = document.getElementById('confirmDangerBtn'); if (btn) btn.disabled = e.target.value !== ui.confirm.requireText; }} />
                  </div>
                )}
                <div className="flex gap-3">
                  <button onClick={() => updateUi({ confirm: null })} className={`flex-1 py-4 rounded-xl font-bold text-base ${t.textM} ${t.bg} hover:opacity-80 transition-all`}>取消</button>
                  <button id="confirmDangerBtn" onClick={ui.confirm.onConfirm} disabled={!!ui.confirm.requireText} className={`flex-1 py-4 rounded-xl font-bold text-base text-white bg-rose-500 shadow-md active:scale-95 transition-all disabled:opacity-30`}>{ui.confirm.requireText ? '確認執行' : '刪除'}</button>
                </div>
              </div>
            </div>
          )}

          {/* Toast */}
          {ui.toast && (
            <div className="fixed top-8 left-0 right-0 z-[100] flex justify-center px-4 animate-in slide-in-from-top-4 fade-in pointer-events-none">
              <div className={`flex items-center gap-3 px-6 py-4 rounded-full shadow-2xl border ${t.cardInner} ${t.border} ${t.text} backdrop-blur-md`}>
                {ui.toast.type === 'error' ? <AlertCircle className="w-6 h-6 text-rose-500" /> : <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
                <span className="font-bold text-sm tracking-wide">{ui.toast.msg}</span>
              </div>
            </div>
          )}

          {/* 頂部 Header */}
          <header className={`px-6 pt-safe pb-4 flex justify-between items-center ${t.cardInner} z-10 shrink-0`}>
            <div className="flex gap-2 w-24">
              <button onClick={() => updateUi({ isDark: !ui.isDark })} className={`p-2.5 rounded-full border ${t.border} ${t.bg} active:scale-95 transition-transform`}>{ui.isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
              <button onClick={() => updateUi({ modal: 'settings' })} className={`p-2.5 rounded-full border ${t.border} ${t.bg} active:scale-95 transition-transform`}><Settings className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 text-center">
              <h1 className="text-xl font-black tracking-wider flex items-center justify-center gap-1.5 uppercase">
                {settings.travelMode && <Globe className="w-5 h-5 text-[#3b82f6]" />} Home Ledger {!settings.travelMode && <span className="text-rose-500 animate-pulse">♡</span>}
              </h1>
            </div>
            <div className="flex gap-2 w-24 justify-end relative">
              <button onClick={() => updateUi({ modal: 'barcode' })} className={`p-2.5 rounded-full border ${t.border} ${t.bg} active:scale-95 transition-transform`}><Barcode className="w-5 h-5" /></button>
              <button onClick={() => updateUi({ modal: 'notify' })} className={`p-2.5 rounded-full border ${t.border} ${t.bg} active:scale-95 transition-transform relative`}>
                <Bell className="w-5 h-5" />
                {activeAlerts.length > 0 && <span className={`absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 border-2 ${t.cardInner.replace('bg-', 'border-')} rounded-full`}></span>}
              </button>
            </div>
          </header>

          {/* 主畫面 */}
          <main className={`px-6 space-y-8 flex-1 overflow-y-auto pb-40 pt-2 hide-scrollbar ${t.bg}`}>
            
            {/* --- 🏠 首頁 Tab --- */}
            {ui.tab === 'home' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className={`flex p-1.5 rounded-2xl border ${t.border} ${t.cardInner} overflow-x-auto hide-scrollbar gap-1 shadow-sm`}>
                  <button onClick={() => updateUi({ filterAccount: 'all' })} className={`shrink-0 px-6 py-2.5 font-bold text-sm rounded-xl transition-all ${(!ui.filterAccount || ui.filterAccount === 'all') ? `${t.bg} shadow-sm ${t.text}` : t.textM}`}>全部帳戶</button>
                  {activeAccounts.map(a => (
                    <button key={a.id} onClick={() => updateUi({ filterAccount: a.id })} className={`shrink-0 px-6 py-2.5 font-bold text-sm rounded-xl transition-all flex items-center gap-1.5 ${ui.filterAccount === a.id ? `${t.bg} shadow-sm ${t.text}` : t.textM}`}>
                      {a.icon} {a.name}
                    </button>
                  ))}
                </div>

                <section className={`${t.cardInner} rounded-[2.5rem] p-7 shadow-lg border ${t.border}`}>
                  <div className="flex justify-between items-center mb-6">
                    <button onClick={() => updateUi({ modal: 'date' })} className={`flex items-center gap-2 font-bold text-base ${t.text} ${t.bg} px-4 py-2.5 rounded-xl border ${t.border} active:scale-95 shadow-sm`}>
                      {ui.dateFilterMode === 'month' ? `${ui.date.getFullYear()}年${ui.date.getMonth() + 1}月` : ui.dateFilterMode === 'year' ? `${ui.date.getFullYear()}年度` : '自訂區間'} <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className={`p-5 rounded-[2rem] border ${t.border} ${t.bg} shadow-sm relative overflow-hidden`}>
                      <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-bl-[100%]"></div>
                      <p className={`text-xs font-bold ${t.textM} mb-1 flex items-center gap-1.5`}><TrendingUp className="w-4 h-4 text-emerald-500" />總收入</p>
                      <h2 className="text-3xl font-black text-emerald-500">${hStats.inc.toLocaleString()}</h2>
                    </div>
                    <div className={`p-5 rounded-[2rem] border ${t.border} ${t.bg} shadow-sm relative overflow-hidden`}>
                      <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/10 rounded-bl-[100%]"></div>
                      <p className={`text-xs font-bold ${t.textM} mb-1 flex items-center gap-1.5`}><TrendingDown className="w-4 h-4 text-rose-500" />總支出</p>
                      <h2 className="text-3xl font-black text-rose-500">${hStats.exp.toLocaleString()}</h2>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-3 mb-2 px-2">
                    <span className={`text-sm font-black ${t.textM}`}>結餘</span>
                    <h2 className={`text-[3.5rem] leading-none font-black tracking-tighter ${hStats.inc - hStats.exp >= 0 ? t.text : 'text-rose-500'}`}>${(hStats.inc - hStats.exp).toLocaleString()}</h2>
                  </div>
                  {rollover.enabled && !settings.travelMode && (!ui.filterAccount || ui.filterAccount === 'all') && ui.dateFilterMode === 'month' && (
                    <div className={`mt-6 pt-5 border-t ${t.border}`}>
                      <div className="flex items-center gap-2 mb-3"><Sparkles className={`w-4 h-4 text-amber-500`} /><span className={`text-xs font-bold ${t.text}`}>上月預算結轉機制</span></div>
                      <div className="flex justify-between items-center mb-3">
                        <span className={`text-xs font-bold ${t.textM}`}>上月省下：<strong className="text-emerald-500">${rollover.amt.toLocaleString()}</strong></span>
                        <span className={`text-xs font-bold ${t.textM}`}>本月可用：<strong className={t.text}>${rollover.budget.toLocaleString()}</strong></span>
                      </div>
                      <div className={`w-full h-2.5 ${t.bg} rounded-full overflow-hidden shadow-inner`}>
                        <div className={`h-full ${t.primary} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${Math.min((hStats.exp / rollover.budget) * 100, 100)}%` }}></div>
                      </div>
                    </div>
                  )}
                </section>

                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className={`w-5 h-5 ${t.textM} absolute left-4 top-1/2 -translate-y-1/2`} />
                    <input type="text" value={ui.search} onChange={e => updateUi({ search: e.target.value })} placeholder="搜尋明細、備註..." className={`w-full ${t.cardInner} font-bold py-4 pl-12 pr-4 text-sm rounded-2xl border ${t.border} focus:outline-none focus:ring-2 ${t.ring} shadow-sm`} />
                  </div>
                  <button onClick={() => updateUi({ modal: 'tags' })} className={`p-4 rounded-2xl border shadow-sm transition-all ${ui.filterTags.length > 0 ? `${t.primary} text-white border-transparent` : `${t.cardInner} ${t.textM} ${t.border}`} active:scale-95 relative`}>
                    <Filter className="w-5 h-5" />
                    {ui.filterTags.length > 0 && (<span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 border-2 border-white rounded-full flex items-center justify-center text-[10px] text-white">{ui.filterTags.length}</span>)}
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center px-2">
                    <h3 className="text-xl font-black">最近明細 (左右滑動可修改)</h3>
                    <div className="flex gap-2"><span className={`text-xs font-bold ${t.textM} bg-black/5 px-3 py-1 rounded-full`}>共 {displayTx.length} 筆</span></div>
                  </div>
                  {displayTx.length === 0 ? (
                    <div className={`text-center py-16 font-bold text-sm ${t.textM} ${t.cardInner} rounded-[2rem] border ${t.border} shadow-sm`}>沒有符合的紀錄</div>
                  ) : displayTx.map(tx => {
                    const catObj = expenseCategories.find(c => c.name === tx.category) || incomeCategories.find(c => c.name === tx.category);
                    const icon = catObj ? catObj.icon : '📝';
                    let displayDateStr = tx.date; 
                    if (tx.date && tx.date.includes('-')) { const [y, m, d] = tx.date.split('-'); displayDateStr = `${d}/${m}/${y}`; }
                    
                    let splitText = ''; 
                    if (tx.type === 'expense') { 
                      if (tx.split === 'none') splitText = '不平分'; 
                      else if (tx.split === 'custom' && tx.splitRatio) splitText = `男${tx.splitRatio.h}女${tx.splitRatio.w}`; 
                      else splitText = '平分'; 
                    }
                    
                    return (
                      <SwipeableItem key={tx.id} t={t} onEdit={() => updateUi({ modal: 'tx', selectedTx: tx })} onDelete={() => confirmAction('確定刪除此紀錄？', () => deleteDoc(getDocRef('shared_ledger', tx.id)))}>
                        <div className="p-5 flex flex-col">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 truncate">
                              <div className={`w-14 h-14 rounded-full ${t.bg} border ${t.border} flex items-center justify-center text-2xl shrink-0 shadow-inner`}>
                                {tx.type === 'transfer' ? <ArrowRightLeft className="w-5 h-5 text-stone-500" /> : icon}
                              </div>
                              <div className="truncate">
                                <p className="font-extrabold text-lg truncate mb-1">
                                  {tx.type === 'transfer' ? '轉帳' : tx.category}
                                  <span className={`text-xs ${t.textM} ml-2 font-bold opacity-80`}>
                                    {tx.type === 'transfer' ? `${data.accounts.find(a => a.id === tx.fromAccountId)?.name || '未知'} ➔ ${data.accounts.find(a => a.id === tx.toAccountId)?.name || '未知'}` : `(${data.accounts.find(a => a.id === tx.accountId)?.name || '未知'})`}
                                  </span>
                                </p>
                                <div className="flex gap-1.5 mt-1.5 flex-wrap items-center">
                                  {tx.type !== 'transfer' && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold shadow-sm ${tx.type === 'expense' ? 'bg-stone-100 text-stone-600' : 'bg-emerald-100 text-emerald-700'}`}>
                                      {tx.type === 'expense' ? '付:' : '收:'}{tx.payer === 'husband' ? '老公' : tx.payer === 'wife' ? '老婆' : '共同'}
                                      {tx.type === 'expense' ? ` (${splitText})` : ''}
                                    </span>
                                  )}
                                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${t.bg} ${t.textM} shadow-sm`}>{displayDateStr} {tx.recordTime || ''}</span>
                                  {tx.tags && tx.tags.map(tg => (
                                    <span key={tg} className={`text-[10px] px-2 py-0.5 rounded-md font-bold text-white bg-[#6366f1] shadow-sm`}>#{tg}</span>
                                  ))}
                                  <span className={`text-xs ${t.textM} font-bold truncate max-w-[120px] ml-1`}>{tx.note}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                              <span className={`font-black text-xl ${tx.type === 'expense' ? t.text : tx.type === 'income' ? 'text-emerald-500' : t.textM}`}>
                                {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}{(Number(tx.amount) || 0).toLocaleString()}
                              </span>
                              {tx.hasPhoto && <ImageIcon className={`w-3.5 h-3.5 ${t.textM}`} />}
                            </div>
                          </div>
                        </div>
                      </SwipeableItem>
                    );
                  })}
                </div>
              </div>
            )}

            {/* --- 🏦 帳戶 Tab --- */}
            {ui.tab === 'wallets' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex justify-between items-center px-2">
                  <h2 className="text-2xl font-black">總資產</h2>
                  <span className={`text-3xl font-black ${t.primaryText}`}>${totalAssets.toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {data.accounts.map(a => (
                    <div key={a.id} className={`p-6 rounded-[2rem] ${t.cardInner} shadow-sm border ${t.border} relative group flex flex-col justify-between min-h-[140px] ${a.archived ? 'opacity-50 grayscale' : ''}`}>
                      <div>
                        <div className="flex items-center gap-3 mb-3 pr-6">
                          <span className="text-3xl bg-black/5 w-10 h-10 flex items-center justify-center rounded-full shadow-sm">{a.icon}</span>
                          <span className="font-bold text-sm truncate">{a.name} {a.archived && '(已封存)'}</span>
                        </div>
                        <div className="text-2xl font-black">${(accBal[a.id] || 0).toLocaleString()}</div>
                      </div>
                      <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleToggleArchiveAccount(a.id, a.archived)} className={`w-8 h-8 rounded-full flex items-center justify-center ${t.bg} shadow-sm hover:opacity-80`}>
                          <Archive className={`w-4 h-4 ${t.textM}`} />
                        </button>
                        <button onClick={() => confirmAction(`確定要永久刪除【${a.name}】嗎？建議使用封存。`, () => deleteDoc(getDocRef('shared_accounts', a.id)), '刪除')} className={`w-8 h-8 rounded-full flex items-center justify-center bg-rose-500/10 text-rose-500 shadow-sm hover:bg-rose-500 hover:text-white`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div onClick={() => updateUi({ modal: 'account' })} className={`bg-transparent border-2 border-dashed ${t.border} rounded-[2rem] p-6 flex flex-col items-center justify-center ${t.textM} cursor-pointer min-h-[140px] hover:bg-black/5 transition-colors active:scale-95`}>
                    <Plus className="w-8 h-8 mb-2 opacity-50" />
                    <span className="text-sm font-bold">新增帳戶</span>
                  </div>
                </div>
              </div>
            )}

            {/* --- 📊 統計 Tab --- */}
            {ui.tab === 'stats' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className={`flex p-1.5 rounded-2xl border ${t.border} ${t.cardInner} overflow-x-auto hide-scrollbar gap-1 shadow-sm`}>
                  <button onClick={() => updateUi({ filterAccount: 'all' })} className={`shrink-0 px-5 py-2 font-bold text-xs rounded-xl transition-all ${(!ui.filterAccount || ui.filterAccount === 'all') ? `${t.bg} shadow-sm ${t.text}` : t.textM}`}>全部帳戶</button>
                  {activeAccounts.map(a => (
                    <button key={a.id} onClick={() => updateUi({ filterAccount: a.id })} className={`shrink-0 px-5 py-2 font-bold text-xs rounded-xl transition-all ${ui.filterAccount === a.id ? `${t.bg} shadow-sm ${t.text}` : t.textM}`}>{a.name}</button>
                  ))}
                </div>
                
                <div className={`flex ${t.cardInner} p-1.5 rounded-xl border ${t.border} shadow-sm`}>
                  <button onClick={() => updateUi({ statsView: 'month' })} className={`flex-1 py-3 rounded-lg text-sm font-bold ${ui.statsView === 'month' ? `${t.bg} ${t.text} shadow-sm` : t.textM}`}>單月分析</button>
                  <button onClick={() => updateUi({ statsView: 'year' })} className={`flex-1 py-3 rounded-lg text-sm font-bold ${ui.statsView === 'year' ? `${t.bg} ${t.text} shadow-sm` : t.textM}`}>年度總結</button>
                </div>
                
                <div className="flex justify-between items-center px-1 mb-2">
                  <button onClick={() => updateUi({ modal: 'date' })} className={`flex items-center gap-2 font-bold text-base ${t.cardInner} px-5 py-3 rounded-2xl shadow-sm border ${t.border} active:scale-95`}>
                    {ui.dateFilterMode === 'month' ? `${ui.date.getFullYear()}年${ui.date.getMonth() + 1}月` : ui.dateFilterMode === 'year' ? `${ui.date.getFullYear()}年度` : '自訂區間'} <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                <div className={`flex ${t.cardInner} p-1.5 rounded-2xl border ${t.border} shadow-sm mb-4`}>
                  <button onClick={() => updateUi({ chartView: 'expense' })} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${ui.chartView === 'expense' ? `bg-rose-500/10 text-rose-500 shadow-sm` : t.textM}`}>支出分析</button>
                  <button onClick={() => updateUi({ chartView: 'income' })} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${ui.chartView === 'income' ? `bg-emerald-500/10 text-emerald-500 shadow-sm` : t.textM}`}>收入分析</button>
                </div>

                {/* 圓餅圖 */}
                <div className={`${t.cardInner} rounded-[2.5rem] p-8 border ${t.border} shadow-lg flex flex-col items-center relative overflow-hidden`}>
                  <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-full blur-[80px] opacity-20 pointer-events-none transition-colors duration-1000 ${ui.chartView === 'expense' ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
                  <div className="relative w-64 h-64 flex items-center justify-center mb-8 z-10">
                    <svg className="w-full h-full transform -rotate-90 drop-shadow-xl" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="transparent" stroke={ui.isDark ? "#1e293b" : "#f1f5f9"} strokeWidth="8" />
                      <circle cx="50" cy="50" r="42" fill="transparent" stroke="#10b981" strokeWidth="8" strokeDasharray="263.89" strokeDashoffset={263.89 * (1 - (tStats.inc / (Math.max(tStats.inc, tStats.exp) || 1)))} className={`donut-ring ${ui.chartView === 'expense' ? 'opacity-30' : 'opacity-100'}`} />
                      <circle cx="50" cy="50" r="30" fill="transparent" stroke={ui.isDark ? "#1e293b" : "#f1f5f9"} strokeWidth="8" />
                      <circle cx="50" cy="50" r="30" fill="transparent" stroke="#f43f5e" strokeWidth="8" strokeDasharray="188.49" strokeDashoffset={188.49 * (1 - (tStats.exp / (Math.max(tStats.inc, tStats.exp) || 1)))} className={`donut-ring ${ui.chartView === 'income' ? 'opacity-30' : 'opacity-100'}`} />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full mb-1 tracking-wider shadow-sm ${ui.chartView === 'expense' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>{ui.chartView === 'expense' ? '內圈：總支出' : '外圈：總收入'}</span>
                      <span className={`text-4xl font-black mt-2 ${t.text}`}>${(ui.chartView === 'expense' ? tStats.exp : tStats.inc).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="w-full space-y-3 z-10 relative">
                    {chartData.length === 0 ? (
                      <div className={`text-center text-sm font-bold ${t.textM}`}>區間內無資料</div>
                    ) : chartData.map((item, idx) => (
                      <div key={idx} className={`flex justify-between items-center p-4 rounded-2xl ${t.bg} shadow-sm border ${t.border}`}>
                        <div className="flex gap-3 font-bold text-sm items-center"><span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }}></span>{item.icon} {item.name}</div>
                        <div className="flex items-center gap-4"><span className={`font-black ${t.textM} text-xs`}>{item.percentage}%</span><span className="font-black text-base">${item.value.toLocaleString()}</span></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 年度折線圖 */}
                {ui.statsView === 'year' && <TrendLineChart data={filteredActiveTxs} year={ui.date.getFullYear()} t={t} isDark={ui.isDark} />}

                {/* 代墊精算 */}
                <div className={`${t.cardInner} rounded-[2.5rem] p-7 border ${t.border} shadow-lg relative overflow-hidden`}>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full"></div>
                  <h3 className="font-black text-lg mb-6 flex items-center gap-2"><ArrowRightLeft className="w-5 h-5 text-amber-500" /> 代墊精算</h3>
                  <p className={`text-xs ${t.textM} font-bold mb-6 bg-black/5 p-3 rounded-xl border border-black/5`}>💡 結算為「全部帳戶」於此時間區間內之總和，不受篩選影響</p>
                  {settlement.status === 'settled' ? (
                    <div className={`p-6 text-center font-bold text-emerald-500 bg-emerald-500/10 rounded-2xl text-base flex items-center justify-center gap-2 border border-emerald-500/20`}>🎉 帳目完全算清！</div>
                  ) : (
                    <div className={`flex items-center justify-between ${t.bg} rounded-2xl p-5 border ${t.border} shadow-inner`}>
                      <div className="flex flex-col items-center"><div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-md border-2 border-white ${settlement.who === 'husband' ? 'bg-[#EAE0D5]' : 'bg-[#FEF0C7]'}`}>{settlement.who === 'husband' ? '👨' : '👩'}</div><span className={`text-xs font-black mt-2 ${t.textM}`}>{settlement.who === 'husband' ? '老公' : '老婆'} (欠款)</span></div>
                      <div className="flex flex-col items-center flex-1 px-2 relative"><div className="flex items-center justify-center w-full text-rose-500"><ArrowRight className="w-5 h-5 mr-1" strokeWidth={3} /><span className="text-3xl font-black mx-1">${Math.round(settlement.amt).toLocaleString()}</span><ArrowRight className="w-5 h-5 ml-1" strokeWidth={3} /></div></div>
                      <div className="flex flex-col items-center"><div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-md border-2 border-white ${settlement.to === 'husband' ? 'bg-[#EAE0D5]' : 'bg-[#FEF0C7]'}`}>{settlement.to === 'husband' ? '👨' : '👩'}</div><span className={`text-xs font-black mt-2 ${t.textM}`}>{settlement.to === 'husband' ? '老公' : '老婆'} (代墊)</span></div>
                    </div>
                  )}
                </div>

                {/* AI 分析健檢卡片 */}
                <div className={`${t.cardInner} rounded-[2.5rem] p-7 border ${t.border} shadow-lg relative overflow-hidden mt-2`}>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full pointer-events-none"></div>
                  <div className="flex justify-between items-center mb-5 relative z-10">
                    <h3 className="font-black text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-indigo-500" /> AI 財務分析建議</h3>
                    <button onClick={handleCallAI} disabled={isAiLoading} className={`px-4 py-2 rounded-full text-xs font-bold ${t.bg} border ${t.border} shadow-sm active:scale-95 flex items-center gap-1.5 transition-all ${isAiLoading ? 'opacity-50' : 'hover:opacity-80'}`}>
                      {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} {aiAnalysis ? '重新分析' : '一鍵把脈'}
                    </button>
                  </div>
                  <div className="relative z-10">
                    {aiAnalysis ? (
                      <div className={`p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-sm font-bold leading-relaxed ${t.text} animate-in fade-in`}>{aiAnalysis}</div>
                    ) : (
                      <div className={`p-6 rounded-2xl ${t.bg} border ${t.border} text-sm font-bold ${t.textM} text-center flex flex-col items-center justify-center gap-3 shadow-inner`}><Wand2 className="w-8 h-8 opacity-20" />點擊上方按鈕，讓 AI 為您本期的收支狀況進行健檢與建議！</div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* --- 🌟 生活 Tab --- */}
            {ui.tab === 'life' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className={`flex ${t.cardInner} p-1.5 rounded-xl border ${t.border} shadow-sm mx-1 overflow-x-auto hide-scrollbar gap-1`}>
                  {[{ id: 'bills', label: '帳單', icon: <CalendarClock className="w-4 h-4" /> }, { id: 'shopping', label: '購物', icon: <ShoppingCart className="w-4 h-4" /> }, { id: 'notes', label: '記事', icon: <ClipboardList className="w-4 h-4" /> }, { id: 'events', label: '日子', icon: <CalendarHeart className="w-4 h-4" /> }, { id: 'goals', label: '夢想', icon: <Target className="w-4 h-4" /> }].map(item => (
                    <button key={item.id} onClick={() => updateUi({ subTab: item.id })} className={`flex-1 min-w-[70px] py-3 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all ${ui.subTab === item.id ? `${t.bg} ${t.text} shadow-sm` : t.textM}`}>
                      {item.icon} {item.label}
                    </button>
                  ))}
                </div>

                {ui.subTab === 'bills' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-6 px-2"><div><h3 className="text-xl font-black">每月固定帳單</h3><p className={`text-xs font-bold ${t.textM} mt-1`}>時間到自動提醒繳費</p></div><button onClick={() => updateUi({ modal: 'addBill' })} className={`px-4 py-2.5 ${t.cardInner} border ${t.border} rounded-full text-xs font-bold shadow-sm active:scale-95`}>+ 新增帳單</button></div>
                    {data.bills.length === 0 ? (
                      <div className={`py-16 text-center text-sm font-bold ${t.textM} ${t.cardInner} rounded-3xl border ${t.border} shadow-sm`}>沒有固定帳單</div>
                    ) : data.bills.map(b => (
                      <div key={b.id} className={`p-5 rounded-[2rem] flex justify-between items-center border ${t.border} ${t.cardInner} shadow-sm transition-all ${b.isPaid ? 'opacity-50 grayscale' : ''}`}>
                        <div className="flex gap-4 items-center">
                          <div className={`text-3xl ${t.bg} w-14 h-14 flex justify-center items-center rounded-full shadow-sm`}>{b.icon}</div>
                          <div>
                            <div className="font-bold text-base">{b.name}</div>
                            <div className={`text-xs font-bold mt-1 ${b.isPaid ? t.textM : 'text-rose-500'}`}>{b.isPaid ? '已繳' : `每月 ${b.dueDate} 號`}</div>
                          </div>
                        </div>
                        <div className="flex gap-3 items-center">
                          <span className="font-black text-xl">${b.amount}</span>
                          {!b.isPaid && (
                            <button onClick={() => confirmAction(`確認繳交【${b.name}】？`, () => { updateDoc(getDocRef('shared_bills', b.id), { isPaid: true }); addDoc(getCol('shared_ledger'), { type: 'expense', amount: b.amount, category: b.category || '居家', note: `${b.name} (自動繳納)`, accountId: activeAccounts[0]?.id || '', payer: 'joint', split: 'none', date: getLocalYYYYMMDD(new Date()), month: getLocalYYYYMM(new Date()), recordTime: getLocalHHmm(new Date()), createdAt: serverTimestamp() }); })} className={`p-3 rounded-full ${t.primary} text-white shadow-md active:scale-90`}>
                              <Check className="w-5 h-5" />
                            </button>
                          )}
                          <button onClick={() => confirmAction('刪除帳單？', () => deleteDoc(getDocRef('shared_bills', b.id)))} className={`p-2 ${t.textM} hover:text-red-500 rounded-full`}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {ui.subTab === 'shopping' && (
                  <div className="space-y-4">
                    <form onSubmit={e => { e.preventDefault(); const v = e.target.item.value.trim(); if (v) { addDoc(getCol('shared_shopping'), { text: v, completed: false, createdAt: serverTimestamp() }); e.target.reset(); } }} className="flex gap-3 mb-6">
                      <input name="item" placeholder="新增待買物品..." className={`flex-1 px-5 py-4 rounded-2xl border ${t.border} ${t.cardInner} font-bold text-sm shadow-sm focus:outline-none focus:ring-2 ${t.ring}`} />
                      <button type="submit" className={`px-6 rounded-2xl ${t.primary} text-white shadow-md active:scale-95`}><Plus className="w-5 h-5" /></button>
                    </form>
                    {data.shopping.map(s => (
                      <div key={s.id} className={`p-4 rounded-2xl flex justify-between items-center border ${t.border} ${t.cardInner} shadow-sm`}>
                        <div className="flex gap-3 items-center flex-1 cursor-pointer" onClick={() => updateDoc(getDocRef('shared_shopping', s.id), { completed: !s.completed })}>
                          <CheckCircle2 className={`w-6 h-6 ${s.completed ? 'text-emerald-500' : t.textM}`} />
                          <span className={`font-bold text-sm ${s.completed ? 'line-through opacity-50' : t.text}`}>{s.text}</span>
                        </div>
                        <button onClick={() => confirmAction('刪除？', () => deleteDoc(getDocRef('shared_shopping', s.id)))} className={`p-2 ${t.textM} hover:text-red-500 rounded-full`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {ui.subTab === 'notes' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-6 px-2">
                      <div><h3 className="text-xl font-black">共同記事</h3></div>
                      <button onClick={() => updateUi({ modal: 'note', selectedItem: null })} className={`px-4 py-2.5 ${t.primary} text-white rounded-full text-xs font-bold shadow-md active:scale-95`}>+ 新增筆記</button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {data.notes.map(n => (
                        <div key={n.id} onClick={() => updateUi({ selectedItem: n, modal: 'note' })} className={`bg-[#FEF0C7] text-[#6B4E31] border border-[#E9C46A] rounded-[2rem] p-5 cursor-pointer min-h-[160px] relative shadow-md hover:shadow-lg flex flex-col`}>
                          <h4 className={`font-extrabold text-base mb-2 line-clamp-2`}>{n.title}</h4>
                          <p className={`text-xs opacity-80 line-clamp-4 font-bold flex-1 whitespace-pre-wrap`}>{n.content}</p>
                          <Edit3 className="absolute bottom-4 right-4 w-4 h-4 opacity-30" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {ui.subTab === 'events' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-6 px-2">
                      <div><h3 className="text-xl font-black">重要日子</h3></div>
                      <button onClick={() => updateUi({ modal: 'addEvent' })} className={`px-4 py-2.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-full text-xs font-bold shadow-sm active:scale-95`}>+ 新增</button>
                    </div>
                    {data.events.map(e => {
                      const d = calculateDaysDiff(e.date); const isToday = d === 0;
                      return (
                        <div key={e.id} className={`p-5 rounded-[2rem] flex justify-between items-center border ${t.border} ${t.cardInner} shadow-sm ${isToday ? 'bg-rose-500/5 border-rose-500/30' : ''}`}>
                          <div className="flex gap-4 items-center">
                            <div className="text-3xl bg-rose-500/10 w-14 h-14 flex items-center justify-center rounded-full shadow-sm">{e.icon}</div>
                            <div>
                              <div className={`font-extrabold text-base ${isToday ? 'text-rose-500' : t.text}`}>{e.title}</div>
                              <div className={`text-xs font-bold mt-1 ${isToday ? 'text-rose-500/70' : t.textM}`}>{e.date}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`font-black text-2xl ${isToday ? 'text-rose-500 animate-pulse' : t.primaryText}`}>{isToday ? '今天' : `${Math.abs(d)} 天`}</span>
                            <button onClick={() => confirmAction('刪除？', () => deleteDoc(getDocRef('shared_events', e.id)))} className={`p-2 ${t.textM} hover:text-red-500 rounded-full`}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {ui.subTab === 'goals' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center px-2">
                      <h2 className="text-xl font-black">夢想撲滿</h2>
                      <button onClick={() => updateUi({ modal: 'addGoal' })} className={`text-xs font-bold ${t.cardInner} border ${t.border} px-4 py-2.5 rounded-full shadow-sm active:scale-95`}>+ 新增願望</button>
                    </div>
                    <div className="grid grid-cols-1 gap-5">
                      {data.goals.map(g => {
                        const prog = Math.min(((Number(g.currentAmount) || 0) / (Number(g.targetAmount) || 1)) * 100, 100); const isOk = prog >= 100;
                        return (
                          <div key={g.id} className={`p-6 rounded-[2.5rem] border ${t.border} ${t.cardInner} shadow-md relative overflow-hidden group`}>
                            <div className="flex justify-between items-center mb-5 pr-8">
                              <div className="font-extrabold text-xl flex items-center gap-2">{isOk ? '🎉' : '🎯'} {g.title}</div>
                              <div className={`text-xs font-black text-white ${isOk ? 'bg-emerald-500' : t.primary} px-3 py-1.5 rounded-lg shadow-sm`}>{prog.toFixed(0)}%</div>
                            </div>
                            <div className="flex justify-between items-end mb-4">
                              <span className="text-4xl font-black">${(Number(g.currentAmount) || 0).toLocaleString()}</span>
                              <span className={`text-sm font-bold ${t.textM}`}>/ ${(Number(g.targetAmount) || 0).toLocaleString()}</span>
                            </div>
                            <div className={`h-3.5 w-full ${t.bg} rounded-full overflow-hidden mb-6 shadow-inner`}>
                              <div className={`h-full rounded-full transition-all duration-1000 ease-out ${isOk ? 'bg-emerald-500' : t.primary}`} style={{ width: `${prog}%` }}></div>
                            </div>
                            {!isOk && (
                              <button onClick={() => updateUi({ modal: 'fund', selectedItem: g })} className={`w-full py-4 ${t.bg} font-black text-sm rounded-2xl flex justify-center items-center gap-2 active:scale-95 border ${t.border} shadow-sm`}>
                                <Coins className={`w-5 h-5 ${t.primaryText}`} /> 存入資金
                              </button>
                            )}
                            <button onClick={() => confirmAction(`刪除目標【${g.title}】？`, () => deleteDoc(getDocRef('shared_goals', g.id)), '刪除')} className={`absolute top-6 right-5 p-2 ${t.textM} hover:bg-rose-500 hover:text-white rounded-full sm:opacity-0 sm:group-hover:opacity-100 transition-all z-10`}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>

          {/* ================= 浮動導覽列 ================= */}
          <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none">
            <div className="w-full max-w-md md:max-w-xl relative pointer-events-auto">
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-50">
                <button onClick={() => updateUi({ modal: 'tx', selectedTx: null })} className={`h-[72px] w-[72px] ${ui.isDark ? 'bg-indigo-600' : 'bg-[#C86D23]'} text-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-transform border-[6px] ${ui.isDark ? 'border-[#0f172a]' : 'border-white'}`}>
                  <Plus className="w-8 h-8" strokeWidth={3} />
                </button>
              </div>
              <nav className={`w-full ${t.cardInner} border-t ${t.border} px-8 pb-safe pt-3 flex justify-between items-center h-[80px] rounded-t-[2.5rem] shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] backdrop-blur-xl bg-opacity-95`}>
                <div className="flex gap-8">
                  <button onClick={() => updateUi({ tab: 'home' })} className={`flex flex-col items-center gap-1.5 ${ui.tab === 'home' ? t.primaryText : t.textM}`}><Home className="w-6 h-6" /><span className="text-[10px] font-bold">首頁</span></button>
                  <button onClick={() => updateUi({ tab: 'wallets' })} className={`flex flex-col items-center gap-1.5 ${ui.tab === 'wallets' ? t.primaryText : t.textM}`}><Wallet className="w-6 h-6" /><span className="text-[10px] font-bold">帳戶</span></button>
                </div>
                <div className="w-16 shrink-0"></div>
                <div className="flex gap-8">
                  <button onClick={() => updateUi({ tab: 'stats' })} className={`flex flex-col items-center gap-1.5 ${ui.tab === 'stats' ? t.primaryText : t.textM}`}><PieChartIcon className="w-6 h-6" /><span className="text-[10px] font-bold">統計</span></button>
                  <button onClick={() => updateUi({ tab: 'life' })} className={`flex flex-col items-center gap-1.5 ${ui.tab === 'life' ? t.primaryText : t.textM}`}><ClipboardList className="w-6 h-6" /><span className="text-[10px] font-bold">生活</span></button>
                </div>
              </nav>
            </div>
          </div>

          {/* ================= 模態框掛載區 ================= */}
          {ui.modal && (
            <>
              {/* 獨立模態框組件 */}
              {ui.modal === 'tx' && <TxFormModal ui={ui} settings={settings} activeAccounts={activeAccounts} expenseCategories={expenseCategories} incomeCategories={incomeCategories} globalTags={data.tags} allTxs={data.tx} onAddGlobalTag={handleAddGlobalTag} user={user} onSave={handleSaveTx} onClose={() => updateUi({ modal: null, selectedTx: null })} onOpenAiChat={() => updateUi({ modal: 'aiChat' })} onShowToast={showToast} t={t} />}
              {ui.modal === 'aiChat' && <AiChatModal expenseCategories={expenseCategories} activeAccounts={activeAccounts} user={user} apiKey={apiKey} onSave={(payload) => handleSaveTx(payload, null)} onClose={() => updateUi({ modal: null })} onShowToast={showToast} t={t} />}
              {ui.modal === 'categoryManager' && <CategoryManagerModal settings={settings} onSaveSettings={(newSettings) => setDoc(getDocRef('shared_settings', 'main'), newSettings, { merge: true })} onClose={() => updateUi({ modal: 'settings' })} onShowToast={showToast} t={t} />}
              {ui.modal === 'tags' && <FilterTagsModal onClose={() => updateUi({ modal: null })} globalTags={data.tags} filterTags={ui.filterTags} setFilterTags={(tags) => updateUi({ filterTags: tags })} onDeleteTag={(tag) => { setDoc(getDocRef('shared_tags', 'main'), { tags: arrayRemove(tag) }, { merge: true }); updateUi({ filterTags: ui.filterTags.filter(t => t !== tag) }); showToast('標籤已徹底刪除'); }} t={t} />}
              {ui.modal === 'date' && <DatePickerModal onClose={() => updateUi({ modal: null })} currentDate={ui.date} onSelect={(date) => { updateUi({ date, modal: null }); }} t={t} />}
              
              {/* 以下為較簡單的內聯模態框 */}
              {['settings', 'barcode', 'notify', 'account', 'addBill', 'note', 'addEvent', 'addGoal', 'fund', 'recurring'].includes(ui.modal) && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                  <div className={`w-full max-w-md sm:max-w-lg ${t.cardInner} rounded-t-[2.5rem] sm:rounded-[2.5rem] pt-6 px-6 pb-0 border ${t.border} max-h-[96vh] flex flex-col shadow-2xl overflow-hidden`}>
                    
                    <div className="flex justify-between items-center mb-6 shrink-0 px-2">
                      <h3 className="font-black text-2xl flex items-center gap-2">
                        {ui.modal === 'settings' && <Settings className={`w-6 h-6 ${t.textM}`}/>}
                        {ui.modal === 'barcode' && <Barcode className={`w-6 h-6 ${t.textM}`}/>}
                        {ui.modal === 'notify' && <Bell className={`w-6 h-6 ${t.textM}`}/>}
                        {ui.modal === 'settings' ? '設定與管理' : ui.modal === 'barcode' ? '發票載具' : ui.modal === 'notify' ? '推播與通知' : ''}
                      </h3>
                      <button onClick={() => updateUi({ modal: null, selectedTx: null, selectedItem: null })} className={`p-2.5 ${t.bg} rounded-full hover:opacity-80 active:scale-95`}><X className={`w-6 h-6 ${t.textM}`}/></button>
                    </div>

                    <div className="flex-1 overflow-y-auto hide-scrollbar pb-safe">
                      
                      {/* 設定頁 */}
                      {ui.modal === 'settings' && (() => {
                        const [s, setS] = useState(settings); const [newCurr, setNewCurr] = useState('');
                        return (
                          <div className="space-y-4">
                            <div className={`${t.bg} rounded-3xl p-5 border ${t.border} shadow-sm space-y-4`}><div className="flex justify-between items-center"><span className={`font-bold text-sm ${t.text}`}>系統字體大小</span><div className={`flex p-1 rounded-xl border ${t.border} ${t.cardInner}`}>{['sm:小', 'md:標準', 'lg:大'].map(size => { const [k, l] = size.split(':'); return <button key={k} onClick={() => setS({...s, uiFontSize: k})} className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${s.uiFontSize === k ? `${t.bg} shadow-sm ${t.primaryText}` : t.textM}`}>{l}</button>; })}</div></div></div>
                            <div className={`${t.bg} rounded-3xl p-5 border ${t.border} shadow-sm space-y-4`}><div className="flex justify-between items-center"><h4 className={`font-bold text-base flex items-center gap-2 ${s.travelMode ? 'text-[#3b82f6]' : t.text}`}><Globe className="w-5 h-5"/> 多點跨國旅行模式</h4><ToggleSwitch checked={s.travelMode} onChange={val => setS({...s, travelMode: val})} isDark={ui.isDark} /></div>{s.travelMode && (<div className={`space-y-4 pt-3 border-t ${t.border}`}><div className="flex gap-2"><input value={newCurr} onChange={e => setNewCurr(e.target.value)} className={`flex-1 ${t.cardInner} p-3 rounded-xl font-bold text-sm border ${t.border} outline-none focus:ring-2 ${t.ring}`} placeholder="輸入國家或幣別" /><button onClick={async () => { let tc = newCurr.trim().toUpperCase(); if (!tc) return; const cm = { '日': 'JPY', '美': 'USD', '歐': 'EUR', '韓': 'KRW' }; for (const [k, v] of Object.entries(cm)) { if (tc.includes(k)) { tc = v; break; } } try { const res = await fetch(`https://open.er-api.com/v6/latest/${tc}`); const data = await res.json(); if (data.result === 'success' && data.rates.TWD) { setS(prev => ({...prev, travelCurrencies: [...(prev.travelCurrencies||[]), {code: tc, rate: Number(data.rates.TWD.toFixed(4))}]})); setNewCurr(''); alert(`新增成功`); } } catch (e) { alert("失敗"); } }} disabled={!newCurr} className={`px-5 rounded-xl text-sm font-bold text-white bg-[#3b82f6] shadow-sm`}>新增</button></div></div>)}</div>
                            <div className={`${t.bg} rounded-3xl p-5 border ${t.border} shadow-sm space-y-4`}><h4 className={`font-bold text-sm ${t.textM} mb-2`}>家庭總預算</h4><div className={`flex items-center gap-2 ${t.cardInner} rounded-2xl p-4 shadow-inner`}><span className={`font-bold text-xl ${t.textM}`}>$</span><input type="number" value={s.monthlyBudget} onChange={e => setS({...s, monthlyBudget: Number(e.target.value)})} className={`w-full bg-transparent font-bold text-2xl border-none focus:outline-none`} /></div><div className={`flex justify-between items-center pt-2`}><span className={`font-bold text-sm ${t.text}`}>預算結轉機制</span><ToggleSwitch checked={s.enableRollover} onChange={val => setS({...s, enableRollover: val})} isDark={ui.isDark} /></div></div>
                            <div className={`${t.bg} rounded-3xl p-5 border ${t.border} shadow-sm`}><h4 className={`font-bold text-sm ${t.textM} mb-4 flex items-center gap-2`}><BellRing className="w-4 h-4"/>防呆與通知中心</h4><div className={`space-y-4 pb-4 border-b ${t.border}`}><div className="flex justify-between items-center"><span className={`font-bold text-sm ${t.text}`}>大額消費防護罩</span><ToggleSwitch checked={s.notifyLargeExpense} onChange={val => setS({...s, notifyLargeExpense: val})} isDark={ui.isDark} /></div>{s.notifyLargeExpense && (<div className={`flex items-center gap-3 ${t.cardInner} p-3 rounded-xl`}><span className={`text-xs ${t.textM} font-bold px-1`}>觸發金額大於 $</span><input type="number" value={s.largeExpenseThreshold} onChange={e => setS({...s, largeExpenseThreshold: Number(e.target.value)})} className={`flex-1 bg-transparent font-bold text-base focus:outline-none`} /></div>)}</div><div className="space-y-4 pt-4"><div className="flex justify-between items-center"><span className={`font-bold text-sm ${t.text}`}>帳單到期提醒</span><ToggleSwitch checked={s.notifyBillDue} onChange={val => setS({...s, notifyBillDue: val})} isDark={ui.isDark} /></div><div className="flex justify-between items-center"><span className={`font-bold text-sm ${t.text}`}>紀念日提前提醒</span><ToggleSwitch checked={s.notifyEvents} onChange={val => setS({...s, notifyEvents: val})} isDark={ui.isDark} /></div></div></div>
                            <button onClick={() => updateUi({ modal: 'categoryManager' })} className={`w-full py-4 rounded-full border ${t.border} ${t.bg} font-bold text-base flex justify-between items-center px-6 ${t.text} shadow-sm active:scale-95`}><div className="flex items-center gap-2"><Tag className={`w-5 h-5 ${t.textM}`} /> 自訂記帳分類</div><ChevronRight className={`w-5 h-5 ${t.textM}`} /></button>
                            <button onClick={() => updateUi({ modal: 'recurring' })} className={`w-full py-4 rounded-full border ${t.border} ${t.bg} font-bold text-base flex justify-between items-center px-6 ${t.text} shadow-sm active:scale-95`}><div className="flex items-center gap-2"><Repeat className={`w-5 h-5 ${t.textM}`} /> 週期性自動記帳</div><ChevronRight className={`w-5 h-5 ${t.textM}`} /></button>
                            <button onClick={() => { setDoc(getDocRef('shared_settings', 'main'), s, {merge:true}); showToast('設定已儲存'); updateUi({modal:null}); }} className={`w-full py-5 rounded-full font-bold text-lg text-white mt-2 shadow-lg ${t.primary} active:scale-95`}>儲存設定</button>
                            <button onClick={handleExportToSheets} className={`w-full py-5 rounded-full font-bold text-base border ${t.border} mt-2 shadow-sm flex items-center justify-center gap-2 text-[#10b981] ${t.bg} hover:opacity-80`}><DownloadCloud className="w-5 h-5"/> 匯出 CSV</button>
                          </div>
                        );
                      })()}

                      {/* 發票載具 */}
                      {ui.modal === 'barcode' && (() => {
                        const [tab, setTab] = useState('h'); const [h, setH] = useState(settings.husbandBarcode || ''); const [w, setW] = useState(settings.wifeBarcode || ''); const [mode, setMode] = useState('view');
                        const safeCode = (tab === 'h' ? h : w) ? encodeURIComponent(tab === 'h' ? h : w) : '';
                        const barcodeUrl = safeCode ? `https://bwipjs-api.metafloor.com/?bcid=code39&text=${safeCode}&scale=3&height=12&includetext=false` : null;
                        return (
                          <div className="space-y-5">
                            <div className={`flex ${t.bg} p-1.5 rounded-2xl shadow-sm`}><button onClick={() => setTab('h')} className={`flex-1 py-3 text-sm font-bold rounded-xl ${tab === 'h' ? `${t.cardInner} shadow-sm ${t.text}` : t.textM}`}>👨 老公</button><button onClick={() => setTab('w')} className={`flex-1 py-3 text-sm font-bold rounded-xl ${tab === 'w' ? `${t.cardInner} shadow-sm ${t.text}` : t.textM}`}>👩 老婆</button></div>
                            {mode === 'view' ? (<div className={`p-6 rounded-[2rem] ${t.bg} space-y-4`}><div className="mb-4"><div className={`bg-white border-2 border-stone-200 rounded-[2rem] p-6 flex flex-col items-center justify-center min-h-[140px]`}>{barcodeUrl ? <img src={barcodeUrl} className="w-full h-20 object-contain mb-4 mix-blend-multiply" /> : <span className="text-stone-400">尚未設定</span>}<span className="font-mono font-black text-2xl text-[#2A2623] tracking-[0.2em]">{tab === 'h' ? h : w}</span></div></div><button onClick={() => setMode('edit')} className={`w-full py-4 rounded-xl font-bold text-sm border ${t.border} ${t.cardInner} ${t.text}`}>設定/修改條碼</button></div>) : (<div className={`p-6 rounded-[2rem] ${t.bg} space-y-5`}><div className="space-y-2"><label className={`text-xs font-bold ${t.textM} px-1`}>{tab === 'h' ? '老公' : '老婆'} 手機條碼</label><input value={tab === 'h' ? h : w} onChange={e => tab === 'h' ? setH(e.target.value.toUpperCase()) : setW(e.target.value.toUpperCase())} className={`w-full p-4 rounded-xl uppercase font-mono text-base font-bold ${t.cardInner} border ${t.border} focus:outline-none focus:ring-2 ${t.ring}`} placeholder="/..." /></div><button onClick={() => { setDoc(getDocRef('shared_settings', 'main'), {husbandBarcode:h, wifeBarcode:w}, {merge:true}).then(()=>{showToast('儲存成功'); setMode('view');}); }} className={`w-full py-4 rounded-xl font-bold text-base text-white ${t.primary}`}>儲存設定</button></div>)}
                          </div>
                        );
                      })()}

                      {/* 通知 / 新增項目等 Modal */}
                      {ui.modal === 'notify' && (<div className="space-y-4">{activeAlerts.length === 0 ? (<div className={`flex flex-col items-center justify-center py-16 text-center ${t.textM}`}><Bell className="w-16 h-16 mb-4 opacity-50" /><span className="font-bold text-lg">目前沒有任何新通知 🎉</span></div>) : activeAlerts.map(a => (<div key={a.id} className={`flex items-center gap-4 p-5 rounded-3xl border ${t.border} ${t.bg} relative shadow-sm`}><div className={`w-14 h-14 rounded-full ${t.cardInner} flex items-center justify-center text-3xl shadow-sm shrink-0`}>{a.icon}</div><div className="flex-1 pr-6"><h4 className="font-extrabold text-lg mb-1">{a.title}</h4><p className={`text-sm font-bold ${t.textM}`}>{a.desc}</p></div><button onClick={() => setDismissedAlerts(prev => [...prev, a.id])} className={`absolute top-5 right-5 text-stone-400 hover:text-rose-500`}><X className="w-5 h-5" /></button></div>))}</div>)}
                      
                      {ui.modal === 'account' && (() => { const [n, setN] = useState(''); const [i, setI] = useState('🏦'); return (<div className="space-y-5"><div className="space-y-2"><label className={`text-xs font-bold ${t.textM} px-2`}>帳戶名稱</label><input value={n} onChange={e => setN(e.target.value)} placeholder="例如：中信戶頭" className={`w-full p-4 rounded-xl font-bold text-base ${t.bg} border ${t.border} outline-none focus:ring-2 ${t.ring}`} /></div><div className="space-y-2"><label className={`text-xs font-bold ${t.textM} px-2`}>圖示</label><div className="flex gap-2 text-3xl overflow-x-auto py-2 hide-scrollbar">{['🏦','💳','💵','💼','💎', '🐖', '🪙', '📈', '🏠'].map(x => (<button key={x} onClick={() => setI(x)} className={`p-4 rounded-2xl shrink-0 transition-all ${i === x ? `${t.primaryText} bg-black/10 shadow-inner` : `${t.border} ${t.cardInner} border`}`}>{x}</button>))}</div></div><button onClick={() => { addDoc(getCol('shared_accounts'), {name:n, type:'joint', icon:i, balance:0, createdAt: serverTimestamp(), archived: false}).then(()=>{updateUi({modal:null}); showToast('建立成功');}); }} disabled={!n} className={`w-full py-4 rounded-full font-bold text-white ${t.primary}`}>建立帳戶</button></div>); })()}
                      {ui.modal === 'addBill' && (() => { const [n, setN] = useState(''); const [a, setA] = useState(''); const [d, setD] = useState(1); return (<div className="space-y-5"><input value={n} onChange={e => setN(e.target.value)} placeholder="帳單名稱 (例如: 手機費)" className={`w-full p-4 rounded-xl font-bold text-base ${t.bg} border ${t.border} outline-none`} /><div className="flex gap-3"><div className="flex-1 space-y-2"><label className={`text-xs font-bold ${t.textM}`}>金額</label><input type="number" value={a} onChange={e => setA(e.target.value)} placeholder="0" className={`w-full p-4 rounded-xl font-bold text-base ${t.bg} border ${t.border}`} /></div><div className="flex-1 space-y-2"><label className={`text-xs font-bold ${t.textM}`}>每月幾號繳？</label><input type="number" min="1" max="31" value={d} onChange={e => setD(e.target.value)} className={`w-full p-4 rounded-xl font-bold text-base text-center ${t.bg} border ${t.border}`} /></div></div><button onClick={() => { addDoc(getCol('shared_bills'), {name:n, amount:Number(a), dueDate:Number(d), icon:'🧾', isPaid: false, createdAt: serverTimestamp()}).then(()=>{updateUi({modal:null}); showToast('建立成功');}); }} disabled={!n || !a} className={`w-full py-4 rounded-full font-bold text-white ${t.primary}`}>建立帳單</button></div>); })()}
                      {ui.modal === 'note' && (() => { const [ti, setTi] = useState(ui.selectedItem?.title || ''); const [c, setC] = useState(ui.selectedItem?.content || ''); return (<div className={`space-y-4 flex flex-col h-full bg-[#FEF0C7] text-[#6B4E31] p-6 rounded-[2rem] border border-[#E9C46A]`}><div className={`flex justify-between items-center mb-2 border-b border-[#E9C46A]/50 pb-3`}><input value={ti} onChange={e => setTi(e.target.value)} placeholder="標題..." className={`w-full p-2 font-black text-xl bg-transparent border-none focus:outline-none placeholder:text-[#6B4E31]/40`} /></div><textarea value={c} onChange={e => setC(e.target.value)} placeholder="內容..." className={`flex-1 w-full p-2 resize-none min-h-[300px] font-bold text-sm bg-transparent border-none focus:outline-none placeholder:text-[#6B4E31]/40`} /><button onClick={() => { const payload = {title:ti, content:c, updatedAt: serverTimestamp()}; if (ui.selectedItem?.id) updateDoc(getDocRef('shared_notes', ui.selectedItem.id), payload).then(()=>{updateUi({modal:null, selectedItem: null}); showToast('修改成功');}); else { payload.createdAt = serverTimestamp(); addDoc(getCol('shared_notes'), payload).then(()=>{updateUi({modal:null, selectedItem: null}); showToast('新增成功');}); } }} disabled={!ti && !c} className={`w-full py-4 rounded-full font-bold text-white bg-[#6B4E31]`}>儲存筆記</button></div>); })()}
                      {ui.modal === 'addEvent' && (() => { const today = new Date(); const [ti, setTi] = useState(''); const [dateStr, setDateStr] = useState(getLocalYYYYMMDD(today)); return (<div className="space-y-5"><div className="space-y-2"><label className={`block text-xs font-bold ${t.textM} px-1`}>名稱</label><input value={ti} onChange={e => setTi(e.target.value)} placeholder="名稱" className={`w-full p-4 rounded-xl font-bold text-base ${t.bg} border ${t.border}`} /></div><div className="space-y-2"><label className={`block text-xs font-bold ${t.textM} px-1`}>日期</label><input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} className={`w-full p-4 rounded-xl ${t.bg} border ${t.border} font-bold text-base focus:outline-none`} /></div><button onClick={() => { addDoc(getCol('shared_events'), {title:ti, date:dateStr, icon:'🎉', createdAt: serverTimestamp()}).then(()=>{updateUi({modal:null}); showToast('建立成功');}); }} disabled={!ti || !dateStr} className={`w-full py-4 rounded-full font-bold text-white bg-rose-500`}>新增日子</button></div>); })()}
                      {ui.modal === 'addGoal' && (() => { const [ti, setTi] = useState(''); const [a, setA] = useState(''); return (<div className="space-y-5"><input value={ti} onChange={e => setTi(e.target.value)} placeholder="目標名稱" className={`w-full p-4 rounded-xl font-bold text-base ${t.bg} border ${t.border}`} /><input type="number" value={a} onChange={e => setA(e.target.value)} placeholder="目標金額" className={`w-full p-4 rounded-xl font-bold text-base ${t.bg} border ${t.border}`} /><button onClick={() => { addDoc(getCol('shared_goals'), {title:ti, targetAmount:Number(a), currentAmount: 0, createdAt: serverTimestamp()}).then(()=>{updateUi({modal:null}); showToast('建立成功');}); }} disabled={!ti || !a} className={`w-full py-4 rounded-full font-bold text-white ${t.primary}`}>建立願望</button></div>); })()}
                      {ui.modal === 'fund' && (() => { const [a, setA] = useState(''); return (<div className="space-y-6 text-center"><p className={`font-bold text-base ${t.textM} mb-4`}>存入資金到 <span className={`${t.primaryText} ml-1`}>{ui.selectedItem?.title}</span></p><input type="number" value={a} onChange={e => setA(e.target.value)} autoFocus placeholder="$0" className={`w-full py-8 text-center font-black text-6xl bg-transparent border-b-2 ${t.border} ${t.text} focus:outline-none`} /><button onClick={() => { updateDoc(getDocRef('shared_goals', ui.selectedItem.id), {currentAmount: (Number(ui.selectedItem.currentAmount)||0) + Number(a)}).then(()=>{updateUi({modal:null, selectedItem: null}); showToast('存入成功');}); }} disabled={!a} className={`w-full py-5 rounded-full font-black text-xl text-white ${t.primary}`}>確認存入</button></div>); })()}
                      {ui.modal === 'recurring' && (() => { const [view, setView] = useState('list'); const [step, setStep] = useState(1); const [r, setR] = useState({ name: '', frequency: 'monthly', interval: 1, txData: { type: 'expense', category: expenseCategories[0]?.name || '', accountId: activeAccounts[0]?.id||'', amount: '', note: '' } }); if (view === 'list') return (<div className="space-y-5 h-full flex flex-col"><button onClick={() => setView('add')} className={`w-full py-4 rounded-2xl border-2 border-dashed ${t.border} ${t.textM} font-bold text-base flex justify-center items-center gap-2`}>+ 新增自動記帳規則</button><div className="flex-1 overflow-y-auto space-y-4">{data.recurringRules.length === 0 ? <div className={`text-center py-12 text-sm ${t.textM} font-bold border ${t.border} rounded-[2rem] ${t.bg}`}>尚無自動記帳規則</div> : data.recurringRules.map(rule => (<div key={rule.id} className={`p-5 rounded-3xl border ${t.border} ${t.cardInner} flex justify-between items-center relative`}><h4 className="font-extrabold text-base">{rule.name}</h4><div className="text-right pr-8"><span className="font-black text-xl">${rule.txData.amount}</span></div><button onClick={() => confirmAction('刪除此規則？', () => deleteDoc(getDocRef('recurring_rules', rule.id)))} className={`absolute top-5 right-4 ${t.textM} hover:text-red-500 p-1`}><Trash2 className="w-5 h-5" /></button></div>))}</div></div>); return (<div className="space-y-5 h-full flex flex-col"><div className="flex items-center gap-3 mb-2"><button onClick={() => { setView('list'); setStep(1); }} className={`p-2 rounded-full border ${t.border}`}><ChevronLeft className={`w-5 h-5 ${t.textM}`}/></button><span className="font-bold text-base">步驟 {step}/3</span></div>{step === 1 && (<div className="space-y-6 flex-1"><input value={r.name} onChange={e => setR({ ...r, name: e.target.value })} placeholder="規則名稱" className={`w-full p-5 rounded-2xl font-bold text-xl ${t.bg} border-none outline-none`} /><button onClick={() => setStep(2)} disabled={!r.name} className={`w-full py-5 rounded-2xl font-bold text-lg ${t.primary} text-white mt-auto`}>下一步</button></div>)}{step === 2 && (<div className="space-y-5 flex-1 flex flex-col"><div className={`flex-1 bg-black/5 rounded-2xl flex items-center justify-center`}><span className={t.textM}>點擊下一步確認預設值即可</span></div><button onClick={() => setStep(3)} className={`w-full py-5 rounded-2xl font-bold text-lg ${t.primary} text-white mt-auto`}>下一步</button></div>)}{step === 3 && (<div className="space-y-6 text-center flex-1 flex flex-col justify-center items-center"><Repeat className={`w-20 h-20 mb-2 ${t.textM}`} /><h3 className="font-black text-2xl mb-4">確認建立？</h3><button onClick={() => { addDoc(getCol('recurring_rules'), { ...r, nextDueDate: new Date(), createdAt: serverTimestamp() }).then(()=>{showToast('規則建立成功'); setView('list');}); }} className={`w-full py-5 rounded-2xl font-black text-lg ${t.primary} text-white mt-auto`}>確認建立</button></div>)}</div>); })()}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </React.Fragment>
  );
}
