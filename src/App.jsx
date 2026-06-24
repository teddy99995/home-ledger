import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Plus, X, Trash2, Sparkles, ChevronLeft, ChevronRight, Target, Coins, 
  PieChart as PieChartIcon, ArrowRightLeft, Home, Search, Settings, CheckCircle2, AlertTriangle,
  Barcode, Camera, ClipboardList, StickyNote, Edit3, CalendarHeart, Mic, MicOff,
  Wallet, CalendarClock, Check, ShoppingCart, DownloadCloud, ChevronDown, ChevronUp, Moon, Sun, Filter, Wand2, Bell, Repeat, Loader2, Save, Plane, ArrowRight, Tag, ReceiptText, Keyboard, Calendar, TrendingUp, TrendingDown, Globe, Lock, Archive, ArchiveRestore, List, RefreshCw
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, onSnapshot, serverTimestamp, doc, 
  deleteDoc, updateDoc, setDoc, arrayUnion
} from 'firebase/firestore';

// ==========================================
// 1. 核心設定與資料庫初始化
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

// 🔑 Gemini API Key (依使用者需求還原環境變數設定)
const apiKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) || 
               (typeof process !== 'undefined' && process.env?.REACT_APP_GEMINI_API_KEY) || 
               ""; 

// 全球常用貨幣與國家對照表
const POPULAR_CURRENCIES = [
  { code: 'JPY', name: '日本' }, { code: 'USD', name: '美國' }, { code: 'EUR', name: '歐洲' },
  { code: 'KRW', name: '韓國' }, { code: 'HKD', name: '香港' }, { code: 'THB', name: '泰國' },
  { code: 'GBP', name: '英國' }, { code: 'AUD', name: '澳洲' }, { code: 'CNY', name: '中國' },
  { code: 'SGD', name: '新加坡' }, { code: 'MYR', name: '馬來西亞' }, { code: 'VND', name: '越南' },
  { code: 'AED', name: '阿聯酋' }
];

const getCurrencyName = (code) => POPULAR_CURRENCIES.find(c => c.code === code)?.name || code;
const getCurrencyLabel = (code) => {
  if (code === 'TWD') return '台灣 (TWD)';
  const name = getCurrencyName(code);
  return name && name !== code ? `${name} (${code})` : code;
};

// 🌟 預設家庭帳本分類設定
const DEFAULT_CATEGORIES = {
  expense: [
    { name: '餐飲', icon: '🍽️', color: '#D4A373' }, 
    { name: '飲料', icon: '🧋', color: '#E9C46A' }, 
    { name: '購物', icon: '🛍️', color: '#F4A261' }, 
    { name: '電話費', icon: '📱', color: '#2A9D8F' }, 
    { name: '居家', icon: '🏠', color: '#CCD5AE' }, 
    { name: '娛樂', icon: '🍿', color: '#E76F51' }, 
    { name: '交通', icon: '🚗', color: '#A3B18A' }, 
    { name: '教育', icon: '📚', color: '#264653' }, 
    { name: '醫療', icon: '💊', color: '#E07A5F' }, 
    { name: '其他', icon: '✨', color: '#EAE0D5' }
  ],
  income: [ 
    { name: '薪資', icon: '💰', color: '#A3B18A' }, 
    { name: '投資', icon: '📈', color: '#D4A373' }, 
    { name: '獎金', icon: '🎁', color: '#F4A261' }, 
    { name: '其他', icon: '✨', color: '#EAE0D5' } 
  ]
};

const getLocalYYYYMM = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const getLocalYYYYMMDD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const getLocalHHmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const calculateDaysDiff = (target) => Math.ceil((new Date(target).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);

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

const fetchWithBackoff = async (url, options, retries = 3) => {
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
};

const ToggleSwitch = ({ checked, onChange, isDark }) => (
  <div 
    onClick={() => onChange(!checked)} 
    className={`w-14 h-8 rounded-full cursor-pointer relative transition-all duration-300 ease-in-out shadow-inner ${checked ? 'bg-[#0EA5E9]' : (isDark ? 'bg-black/40' : 'bg-stone-300')}`}
  >
    <div className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
  </div>
);

const ArrowDownIconSVG = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 5v14M19 12l-7 7-7-7"/></svg>;

// 🌟 年度趨勢折線圖組件
const LineChart = ({ data, t }) => {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => Math.max(d.inc, d.exp, 1)));
  const h = 180, w = 320, pad = 25;
  const pointsInc = data.map((d, i) => `${pad + (i * (w - 2 * pad)) / 11},${h - pad - (d.inc / maxVal) * (h - 2 * pad)}`).join(' ');
  const pointsExp = data.map((d, i) => `${pad + (i * (w - 2 * pad)) / 11},${h - pad - (d.exp / maxVal) * (h - 2 * pad)}`).join(' ');
  
  return (
    <div className={`w-full overflow-x-auto hide-scrollbar ${t.cardInner} rounded-3xl p-5 border ${t.border} shadow-sm`}>
      <h4 className={`font-bold text-sm mb-3 flex items-center gap-2 ${t.text}`}><TrendingUp className="w-5 h-5 text-emerald-500"/>年度收支趨勢</h4>
      <div className="flex gap-4 mb-4 justify-center text-xs font-bold">
        <span className="flex items-center gap-1.5 text-emerald-500"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></div>收入</span>
        <span className="flex items-center gap-1.5 text-rose-500"><div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm"></div>支出</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto overflow-visible drop-shadow-sm">
        <line x1={pad} y1={h-pad} x2={w-pad} y2={h-pad} stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />
        <line x1={pad} y1={pad} x2={w-pad} y2={pad} stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />
        <polyline points={pointsInc} fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-md animate-in fade-in duration-1000" />
        <polyline points={pointsExp} fill="none" stroke="#F43F5E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-md animate-in fade-in duration-1000 delay-150" />
        {data.map((d, i) => {
           const cx = pad + (i * (w - 2 * pad)) / 11;
           return (
             <g key={i}>
                <circle cx={cx} cy={h - pad - (d.inc / maxVal) * (h - 2 * pad)} r="4" fill="#10B981" stroke={t.bg.includes('16') || t.bg.includes('0B') ? "#202536" : "#FFF"} strokeWidth="2" />
                <circle cx={cx} cy={h - pad - (d.exp / maxVal) * (h - 2 * pad)} r="4" fill="#F43F5E" stroke={t.bg.includes('16') || t.bg.includes('0B') ? "#202536" : "#FFF"} strokeWidth="2" />
                <text x={cx} y={h - 5} fontSize="10" fill="currentColor" opacity="0.5" textAnchor="middle" fontWeight="bold">{d.month}</text>
             </g>
           );
        })}
      </svg>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState({ 
    tx: [], accounts: [], bills: [], notes: [], shopping: [], goals: [], events: [], tags: [], recurringRules: [], templates: [], categories: DEFAULT_CATEGORIES 
  });
  
  const [settings, setSettings] = useState({ 
    monthlyBudget: 50000, husbandBarcode: '', wifeBarcode: '',
    enableRollover: true, notifyLargeExpense: true, largeExpenseThreshold: 3000, 
    notifyBillDue: true, notifyEvents: true, notifyAdvanceDays: 3,
    travelMode: false, travelCurrencies: [], 
    uiFontSize: 'md' 
  });
  
  const [ui, setUi] = useState(() => {
    // 日夜記憶存在本機 (讓老公深色、老婆淺色彼此不干擾)
    const savedIsDark = localStorage.getItem('homeLedgerTheme') === 'dark';
    return {
      date: new Date(), dateRange: { start: '', end: '' },
      tab: 'home', subTab: 'bills', statsView: 'month', chartView: 'expense', modal: null, search: '', filterTags: [], filterAccount: 'all',
      isDark: savedIsDark, confirm: null, selectedItem: null, toast: null, selectedTx: null, isManageTags: false
    };
  });

  // 🌟 分頁功能狀態
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;
  const [newGlobalTag, setNewGlobalTag] = useState(''); // 首頁全域標籤輸入狀態
  
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const processedRecurring = useRef(false);

  const updateUi = (updates) => {
    setUi(prev => {
      const next = { ...prev, ...updates };
      if (updates.hasOwnProperty('isDark')) {
        localStorage.setItem('homeLedgerTheme', updates.isDark ? 'dark' : 'light');
      }
      return next;
    });
  };
  
  const showToast = (msg, type = 'success') => { 
    updateUi({ toast: { msg, type } }); 
    setTimeout(() => updateUi({ toast: null }), 3000); 
  };

  useEffect(() => {
    const isLineApp = navigator.userAgent.includes("Line") || navigator.userAgent.includes("LINE");
    const currentUrl = window.location.href;
    if (isLineApp && !currentUrl.includes("openExternalBrowser=1")) {
      const separator = currentUrl.includes("?") ? "&" : "?";
      window.location.replace(currentUrl + separator + "openExternalBrowser=1");
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        showToast("登入失敗，請檢查網路", "error");
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubs = [
      onSnapshot(getCol('shared_accounts'), snap => {
        if (snap.empty) {
          const defaults = [
            { id: 'acc_joint', name: '共同帳戶', type: 'joint', icon: '🏦', isArchived: false }, 
            { id: 'acc_h', name: '老公帳戶', type: 'husband', icon: '👨', isArchived: false }, 
            { id: 'acc_w', name: '老婆帳戶', type: 'wife', icon: '👩', isArchived: false }
          ];
          defaults.forEach(d => setDoc(getDocRef('shared_accounts', d.id), { ...d, createdAt: serverTimestamp() }));
        } else {
          setData(prev => ({ ...prev, accounts: snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.createdAt?.toMillis() - b.createdAt?.toMillis()) }));
        }
      }),
      onSnapshot(getDocRef('shared_settings', 'categories'), doc => {
        if (doc.exists()) setData(prev => ({ ...prev, categories: doc.data() }));
        else { setDoc(getDocRef('shared_settings', 'categories'), DEFAULT_CATEGORIES); setData(prev => ({ ...prev, categories: DEFAULT_CATEGORIES })); }
      }),
      onSnapshot(getDocRef('shared_settings', 'main'), doc => { 
        if (doc.exists()) {
          const d = doc.data();
          if (!d.travelCurrencies && d.travelCurrency) d.travelCurrencies = [{code: d.travelCurrency, rate: d.travelRate || 1}];
          setSettings(prev => ({ ...prev, ...d })); 
        }
      }),
      onSnapshot(getDocRef('shared_tags', 'main'), doc => {
        setData(prev => ({ ...prev, tags: doc.exists() ? doc.data().tags : [] }))
      }),
      onSnapshot(getCol('recurring_rules'), snap => {
        setData(prev => ({ ...prev, recurringRules: snap.docs.map(d => ({ id: d.id, ...d.data() })) }))
      }),
      onSnapshot(getCol('shared_templates'), snap => {
        setData(prev => ({ ...prev, templates: snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()) }))
      }),
      onSnapshot(getCol('shared_ledger'), snap => {
        setData(p => ({ ...p, tx: snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
          const dateA = a.date || ''; const dateB = b.date || '';
          if (dateA !== dateB) return dateB.localeCompare(dateA);
          const timeA = a.recordTime || ''; const timeB = b.recordTime || '';
          if (timeA !== timeB) return timeB.localeCompare(timeA);
          return b.createdAt?.toMillis() - a.createdAt?.toMillis();
        }) }))
      }),
      onSnapshot(getCol('shared_bills'), snap => {
        setData(p => ({ ...p, bills: snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.dueDate - b.dueDate) }))
      }),
      onSnapshot(getCol('shared_notes'), snap => {
        setData(p => ({ ...p, notes: snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.updatedAt?.toMillis() - a.updatedAt?.toMillis()) }))
      }),
      onSnapshot(getCol('shared_shopping'), snap => {
        setData(p => ({ ...p, shopping: snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.completed === b.completed ? (b.createdAt?.toMillis() - a.createdAt?.toMillis()) : (a.completed ? 1 : -1)) }))
      }),
      onSnapshot(getCol('shared_goals'), snap => {
        setData(p => ({ ...p, goals: snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.createdAt?.toMillis() - b.createdAt?.toMillis()) }))
      }),
      onSnapshot(getCol('shared_events'), snap => {
        setData(p => ({ ...p, events: snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => calculateDaysDiff(a.date) - calculateDaysDiff(b.date)) }))
      })
    ];
    return () => unsubs.forEach(u => u());
  }, [user]);

  useEffect(() => {
    if (!user || data.recurringRules.length === 0 || processedRecurring.current) return;
    const processRules = async () => {
      const today = new Date(); 
      today.setHours(0, 0, 0, 0);
      let processedCount = 0;

      for (const rule of data.recurringRules) {
        if (!rule.nextDueDate) continue;
        const dueDate = rule.nextDueDate.toDate(); 
        dueDate.setHours(0, 0, 0, 0);

        if (dueDate <= today) {
          const newTx = { 
            ...rule.txData, 
            date: getLocalYYYYMMDD(dueDate), 
            month: getLocalYYYYMM(dueDate), 
            recordTime: "08:00", 
            createdAt: serverTimestamp(), 
            createdBy: user.uid, 
            tags: [...(rule.txData.tags || []), '週期性'] 
          };
          
          await addDoc(getCol('shared_ledger'), newTx);
          
          const next = new Date(dueDate);
          if (rule.frequency === 'monthly') next.setMonth(next.getMonth() + rule.interval);
          else if (rule.frequency === 'weekly') next.setDate(next.getDate() + rule.interval * 7);
          
          await updateDoc(getDocRef('recurring_rules', rule.id), { nextDueDate: next });
          processedCount++;
        }
      }
      if (processedCount > 0) showToast(`已自動建立 ${processedCount} 筆週期性記帳！`);
      processedRecurring.current = true;
    };
    processRules();
  }, [user, data.recurringRules]);

  // 🌟 重設分頁器
  useEffect(() => {
    setCurrentPage(1);
  }, [ui.search, ui.filterTags, ui.filterAccount, ui.date, ui.dateRange, ui.statsView, ui.tab]);

  const activeAccounts = useMemo(() => data.accounts.filter(a => !a.isArchived), [data.accounts]);

  const cMonth = getLocalYYYYMM(ui.date);
  const cYear = String(ui.date.getFullYear());
  const mTx = useMemo(() => data.tx.filter(t => t.month === cMonth), [data.tx, cMonth]);
  const yTx = useMemo(() => data.tx.filter(t => t.date.startsWith(cYear)), [data.tx, cYear]);
  const cTx = useMemo(() => {
      if (!ui.dateRange.start || !ui.dateRange.end) return [];
      return data.tx.filter(t => t.date >= ui.dateRange.start && t.date <= ui.dateRange.end);
  }, [data.tx, ui.dateRange]);
  
  const baseTxs = ui.tab === 'stats' ? (ui.statsView === 'month' ? mTx : ui.statsView === 'year' ? yTx : cTx) : mTx;

  const filteredBaseTxs = useMemo(() => {
    if (!ui.filterAccount || ui.filterAccount === 'all') return baseTxs;
    return baseTxs.filter(t => t.accountId === ui.filterAccount);
  }, [baseTxs, ui.filterAccount]);

  const displayTx = useMemo(() => filteredBaseTxs.filter(t => {
    const q = !ui.search || t.category?.includes(ui.search) || t.note?.includes(ui.search);
    const tg = ui.filterTags.length === 0 || ui.filterTags.every(tag => t.tags && t.tags.includes(tag));
    return q && tg;
  }), [filteredBaseTxs, ui.search, ui.filterTags]);

  // 🌟 分頁切片邏輯
  const paginatedTx = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return displayTx.slice(start, start + ITEMS_PER_PAGE);
  }, [displayTx, currentPage]);
  const totalPages = Math.max(1, Math.ceil(displayTx.length / ITEMS_PER_PAGE));

  const calcStats = (txs) => txs.reduce((s, t) => {
    if (t.type === 'transfer') return s;
    if (t.type === 'expense') {
      s.exp += t.amount; 
      s.expCat[t.category] = (s.expCat[t.category] || 0) + t.amount;
    } else if (t.type === 'income') { 
      s.inc += t.amount; 
      s.incCat[t.category] = (s.incCat[t.category] || 0) + t.amount;
    }
    return s;
  }, { exp: 0, inc: 0, expCat: {}, incCat: {} });

  const hStats = calcStats(ui.tab === 'home' ? filteredBaseTxs : mTx); 
  const tStats = calcStats(filteredBaseTxs); 

  const chartData = useMemo(() => {
    const isExp = ui.chartView === 'expense';
    const targetTotal = isExp ? tStats.exp : tStats.inc;
    const targetCat = isExp ? tStats.expCat : tStats.incCat;
    const total = targetTotal || 1;
    const catList = isExp ? data.categories.expense : data.categories.income;

    return Object.entries(targetCat).map(([name, value]) => {
      const catObj = catList.find(c => c.name === name);
      const icon = catObj?.icon || '✨';
      return { name, value, percentage: Math.round((value / total) * 100), icon };
    }).sort((a, b) => b.value - a.value);
  }, [tStats, ui.chartView, data.categories]);

  const yearTrendData = useMemo(() => {
      if (ui.statsView !== 'year') return [];
      return Array.from({length: 12}).map((_, i) => {
          const m = `${cYear}-${String(i+1).padStart(2, '0')}`;
          const mmTx = yTx.filter(t => t.month === m);
          const inc = mmTx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
          const exp = mmTx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
          return { month: i+1, inc, exp };
      });
  }, [yTx, cYear, ui.statsView]);

  const rollover = useMemo(() => {
    if (!settings.enableRollover) return { enabled: false, amt: 0, budget: settings.monthlyBudget };
    const pMonth = getLocalYYYYMM(new Date(ui.date.getFullYear(), ui.date.getMonth() - 1, 1));
    const pExp = data.tx.filter(t => t.month === pMonth && t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const amt = (pExp < settings.monthlyBudget && pExp > 0) ? settings.monthlyBudget - pExp : 0;
    return { enabled: true, amt, budget: settings.monthlyBudget + amt };
  }, [settings, ui.date, data.tx]);

  const accBal = data.accounts.reduce((acc, a) => {
    const balance = data.tx.reduce((sum, t) => {
      if (t.type === 'transfer') {
        if (t.fromAccountId === a.id) return sum - t.amount;
        if (t.toAccountId === a.id) return sum + t.amount;
      } else if (t.accountId === a.id) {
        return t.type === 'expense' ? sum - t.amount : sum + t.amount;
      }
      return sum;
    }, a.balance || 0);
    return { ...acc, [a.id]: balance };
  }, {});
  const totalAssets = Object.values(accBal).reduce((s, b) => s + b, 0);

  const settlement = useMemo(() => {
    const activeTxs = baseTxs; 
    let hOwesW = 0; let wOwesH = 0; 

    activeTxs.forEach(t => {
      if (t.type !== 'expense') return;
      if (t.split === 'none') return; 
      
      let ratioH = 0.5; let ratioW = 0.5;
      
      if (t.split === 'custom' && t.splitRatio) {
         ratioH = t.splitRatio.h / 100;
         ratioW = t.splitRatio.w / 100;
      }

      if (t.payer === 'husband') wOwesH += (t.amount * ratioW);
      else if (t.payer === 'wife') hOwesW += (t.amount * ratioH);
    });

    const netWifeOwesHusband = wOwesH - hOwesW;

    if (netWifeOwesHusband > 0.01) return { status: 'unsettled', who: 'wife', to: 'husband', amt: netWifeOwesHusband };
    if (netWifeOwesHusband < -0.01) return { status: 'unsettled', who: 'husband', to: 'wife', amt: Math.abs(netWifeOwesHusband) };
    return { status: 'settled' };
  }, [baseTxs]);

  const rawAlerts = useMemo(() => {
    const a = []; 
    const today = new Date().getDate(); 
    const notifyDays = settings.notifyAdvanceDays || 3;
    
    if (settings.notifyBillDue) {
      data.bills.forEach(b => { 
        if (!b.isPaid && b.dueDate - today >= 0 && b.dueDate - today <= notifyDays) {
          a.push({ id: `b_${b.id}`, icon: b.icon || '🧾', title: '帳單到期', desc: `${b.name} 將在 ${b.dueDate - today === 0 ? '今天' : `${b.dueDate - today} 天後`} 到期` }); 
        }
      });
    }
    
    if (settings.notifyEvents) {
      data.events.forEach(e => { 
        const d = calculateDaysDiff(e.date); 
        if (d >= 0 && d <= notifyDays) {
          a.push({ id: `e_${e.id}`, icon: e.icon || '🎉', title: '紀念日提醒', desc: `${e.title} 還有 ${d} 天` }); 
        }
      });
    }

    if (settings.notifyLargeExpense) {
      mTx.slice(0, 15).forEach(t => { 
        if (t.type === 'expense' && t.amount >= (settings.largeExpenseThreshold || 3000)) {
          a.push({ id: `t_${t.id}`, icon: '💸', title: '大額消費防護', desc: `${t.payer === 'husband' ? '老公' : t.payer === 'wife' ? '老婆' : '共同'} 記了一筆 $${t.amount.toLocaleString()}` }); 
        }
      });
    }

    return a;
  }, [data, settings, mTx]);

  const activeAlerts = rawAlerts.filter(a => !dismissedAlerts.includes(a.id));

  const doAction = async (action, successMsg) => {
    try { 
      await action(); 
      if (successMsg) showToast(successMsg); 
    } catch (e) { 
      showToast(`操作失敗: ${e.message}`, "error"); 
    } finally {
      updateUi({ modal: null, confirm: null, selectedTx: null }); 
    }
  };
  
  // 🌟 危險操作文字鎖支援
  const confirmAction = (msg, action, requireText = null) => 
    updateUi({ confirm: { message: msg, onConfirm: () => doAction(action, "操作成功"), requireText, inputText: '' } });

  const confirmDel = (msg, action) => confirmAction(msg, action);

  const handleAddGlobalTag = async (tagName) => {
    if (!tagName.trim() || data.tags.includes(tagName)) return;
    try { await setDoc(getDocRef('shared_tags', 'main'), { tags: arrayUnion(tagName) }, { merge: true }); showToast(`標籤 #${tagName} 已建立`); } catch (err) {}
  };

  const handleDeleteGlobalTag = (tag) => {
    confirmDel(`確定要刪除標籤 #${tag} 嗎？`, async () => {
      const newTags = data.tags.filter(t => t !== tag);
      await setDoc(getDocRef('shared_tags', 'main'), { tags: newTags });
      updateUi({ filterTags: ui.filterTags.filter(t => t !== tag) });
    });
  };

  // 🌟 還原為原本的 AI API 設定 (X-goog-api-key)
  const handleCallAI = async () => {
    if (!apiKey) return showToast("請先在程式碼最上方設定您的 Gemini API Key", "error");
    setIsAiLoading(true); setAiAnalysis('');
    try {
      const topExpCats = Object.entries(tStats.expCat).map(([n,v]) => ({name:n, val:v})).sort((a,b)=>b.val-a.val).slice(0,3).map(c => `${c.name}(${Math.round(c.val/(tStats.exp||1)*100)}%)`).join('、');
      let stext = settlement.status === 'settled' ? "無欠款" : (settlement.who === 'husband' ? `老婆需給老公${Math.round(settlement.amt)}` : `老公需給老婆${Math.round(settlement.amt)}`);
      const prompt = `這是家庭帳本本期紀錄：支出${tStats.exp}元。前三花費:${topExpCats || '無'}。結算:${stext}。請用溫馨朋友語氣給一段50字理財建議(不列點)。`;
      
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`;
      const options = {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      };

      const resData = await fetchWithBackoff(url, options);
      if (!resData || !resData.candidates) throw new Error("API 回傳格式錯誤或遭拒絕，請確認金鑰權限");
      setAiAnalysis(resData.candidates[0].content.parts[0].text);
    } catch (err) { setAiAnalysis(`AI 服務連線異常：${err.message}`); } finally { setIsAiLoading(false); }
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
      const splitLabel = tx.type === 'expense' ? (tx.split === 'none' ? '不平分' : (tx.split === 'custom' ? `男${tx.splitRatio?.h}女${tx.splitRatio?.w}` : '平分')) : '-';
      return [tx.date, tx.recordTime || '', typeLabel, catOrFrom || '', accOrTo || '', tx.amount, `"${tx.note || ''}"`, payerLabel, splitLabel, tx.tags ? `"${tx.tags.join(';')}"` : ''].join(",");
    });
    
    const csvContent = BOM + headers.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); 
    link.href = url; link.setAttribute('download', `HomeLedger_${getLocalYYYYMMDD(new Date())}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link); 
    showToast("匯出成功！請直接匯入 Google Sheets");
  };

  // 🌞 🌙 日夜與旅遊四態主題引擎 (老公：智理工作室深色 / 老婆：暖奶油淺色)
  let t = ui.isDark ? { 
    bg: 'bg-[#161925]', cardInner: 'bg-[#202536]', text: 'text-[#F8FAFC]', textM: 'text-[#94A3B8]', primary: 'bg-[#E3B59B]', primaryText: 'text-[#E3B59B]', primaryBtnText: 'text-[#161925]', border: 'border-[#2D3348]', input: 'bg-[#161925] text-white', ring: 'focus:ring-[#E3B59B]'
  } : {
    bg: 'bg-[#FDFBF7]', cardInner: 'bg-[#FFFFFF]', text: 'text-[#3F3328]', textM: 'text-[#8C857D]', primary: 'bg-[#F5A623]', primaryText: 'text-[#D97706]', primaryBtnText: 'text-white', border: 'border-[#F0EBE1]', input: 'bg-[#FDFBF7] text-[#3F3328]', ring: 'focus:ring-[#F5A623]'
  };

  if (settings.travelMode) {
     t = { ...t, 
       bg: ui.isDark ? 'bg-[#0B101E]' : 'bg-[#E0F2FE]', 
       cardInner: ui.isDark ? 'bg-[#172033]' : 'bg-[#FFFFFF]',
       primary: ui.isDark ? 'bg-[#0EA5E9]' : 'bg-[#0284C7]', 
       primaryText: ui.isDark ? 'text-[#0EA5E9]' : 'text-[#0284C7]', 
       primaryBtnText: 'text-white',
       border: ui.isDark ? 'border-[#1E293B]' : 'border-[#BAE6FD]'
     }
  }

  const handleOpenTx = (tx = null) => {
    try { updateUi({ modal: 'tx', selectedTx: tx }); } catch (e) { showToast("系統載入異常，請重試", "error"); }
  };

  const handleTxSave = (txData) => { 
      const { id, recordDate, recordTime, ...payload } = txData;
      payload.updatedAt = serverTimestamp();
      payload.date = recordDate || getLocalYYYYMMDD(ui.date);
      payload.month = payload.date.substring(0, 7);
      payload.recordTime = recordTime || getLocalHHmm(new Date());
      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
      
      const saveActual = () => {
          if(id) doAction(() => updateDoc(getDocRef('shared_ledger', id), payload), '修改成功'); 
          else { payload.createdAt = serverTimestamp(); payload.createdBy = user ? user.uid : 'unknown'; doAction(() => addDoc(getCol('shared_ledger'), payload), '記帳成功'); }
      };

      // 🛡️ 天價防護
      if (payload.amount >= 1000000) {
          confirmAction('金額高達百萬！請輸入確認文字以解鎖', saveActual, '確認解鎖');
          return;
      }
      
      // 🛡️ 未來日期防穿梭
      if (payload.date > getLocalYYYYMMDD(new Date())) {
          confirmAction('確定要記錄未來的帳務嗎？', saveActual);
          return;
      }

      // 🛡️ 重複記帳攔截
      const isDuplicate = data.tx.some(t => t.amount === payload.amount && t.category === payload.category && t.date === payload.date && t.id !== id);
      if (isDuplicate && !id) {
          confirmAction('今天已有一筆一模一樣的紀錄，確定要重複記帳嗎？', saveActual);
          return;
      }

      saveActual();
  };

  const rootFontSize = settings.uiFontSize === 'sm' ? '14px' : settings.uiFontSize === 'lg' ? '18px' : '16px';

  return (
    <React.Fragment>
      <style dangerouslySetInnerHTML={{__html: `
        :root { font-size: ${rootFontSize} !important; }
        .pb-safe { padding-bottom: calc(1.5rem + env(safe-area-inset-bottom)); }
        .pt-safe { padding-top: calc(1rem + env(safe-area-inset-top)); }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        body { background-color: ${settings.travelMode ? (ui.isDark ? '#0B101E' : '#E0F2FE') : (ui.isDark ? '#161925' : '#FDFBF7')}; margin: 0; padding: 0; transition: background-color 0.5s ease; }
        .donut-ring { stroke-linecap: round; transition: stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s ease; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 24px; height: 24px; border-radius: 50%; background: white; box-shadow: 0 2px 6px rgba(0,0,0,0.2); cursor: pointer; border: 2px solid ${ui.isDark ? '#E3B59B' : '#F5A623'}; margin-top: -8px; }
        input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 8px; cursor: pointer; background: ${ui.isDark ? '#2D3348' : '#F0EBE1'}; border-radius: 4px; }
      `}} />

      <div className={`min-h-[100dvh] w-full flex justify-center ${t.bg} transition-colors duration-500 overflow-x-hidden font-sans`}>
        <div className={`w-full max-w-md md:max-w-xl ${t.text} relative flex flex-col min-h-[100dvh] ${t.cardInner} md:border-x shadow-2xl ${t.border}`}>
          
          {/* 🔥 刪除/確認文字鎖 Modal */}
          {ui.confirm && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className={`${t.cardInner} rounded-[2rem] p-8 w-full max-w-sm shadow-[0_20px_50px_rgba(0,0,0,0.3)] text-center border ${t.border} relative overflow-hidden`}>
                <div className={`absolute inset-0 bg-gradient-to-b ${ui.confirm.requireText ? 'from-rose-500/10' : 'from-red-500/10'} to-transparent opacity-50 pointer-events-none`}></div>
                
                <div className="relative z-10">
                  {ui.confirm.requireText ? <Lock className="w-16 h-16 text-rose-500 mx-auto mb-5 bg-rose-500/10 p-3 rounded-full" /> : <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-5 bg-red-500/10 p-3 rounded-full" />}
                  <h3 className={`text-xl font-bold ${t.text} mb-4`}>{ui.confirm.message}</h3>
                  
                  {ui.confirm.requireText && (
                    <div className="mb-6 text-left">
                      <p className={`text-sm ${t.textM} mb-2`}>請輸入 <span className="font-bold text-red-500">{ui.confirm.requireText}</span> 以解鎖執行：</p>
                      <input 
                        type="text" 
                        value={ui.confirm.inputText || ''} 
                        onChange={e => updateUi({ confirm: { ...ui.confirm, inputText: e.target.value } })}
                        className={`w-full p-4 rounded-xl border ${t.border} ${t.bg} focus:ring-2 focus:ring-red-500 outline-none font-bold text-center tracking-widest transition-all`}
                        placeholder={ui.confirm.requireText}
                      />
                    </div>
                  )}
                  
                  <div className="flex gap-4 mt-6">
                    <button onClick={() => updateUi({confirm: null})} className={`flex-1 py-4 rounded-xl font-bold text-base ${t.textM} ${t.bg} active:scale-95 transition-all hover:brightness-95`}>取消</button>
                    <button 
                      onClick={ui.confirm.onConfirm} 
                      disabled={ui.confirm.requireText && ui.confirm.inputText !== ui.confirm.requireText}
                      className="flex-1 py-4 rounded-xl font-bold text-base text-white bg-red-500 shadow-md active:scale-95 disabled:opacity-50 disabled:grayscale transition-all hover:bg-red-600"
                    >
                      確認執行
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Toast 提示 (完美修復：包含錯誤時的紅色警示) */}
          {ui.toast && (
            <div className="fixed top-6 left-0 right-0 z-[100] flex justify-center px-4 animate-in slide-in-from-top-4 duration-300 pointer-events-none">
              <div className={`flex items-center gap-3 px-6 py-4 rounded-full shadow-2xl border ${t.cardInner} ${t.border} ${t.text} backdrop-blur-md bg-opacity-90`}>
                <CheckCircle2 className={`w-6 h-6 ${ui.toast.type === 'error' ? 'text-red-500' : 'text-emerald-500'}`} />
                <span className="font-bold text-base truncate max-w-xs">{ui.toast.msg}</span>
              </div>
            </div>
          )}

          {/* 🌟 頂部 Header */}
          <header className={`px-6 pt-safe pb-4 flex justify-between items-center ${t.cardInner} z-10 shrink-0 border-b ${t.border}`}>
            <div className="flex gap-3 w-24">
               <button onClick={() => updateUi({ isDark: !ui.isDark })} className={`p-2.5 rounded-full border ${t.border} ${t.bg} active:scale-95 hover:shadow-sm transition-all text-stone-500 hover:${t.primaryText}`}>
                 {ui.isDark ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
               </button>
               <button onClick={() => updateUi({ modal: 'settings' })} className={`p-2.5 rounded-full border ${t.border} ${t.bg} active:scale-95 hover:shadow-sm transition-all text-stone-500 hover:${t.primaryText}`}>
                 <Settings className="w-5 h-5"/>
               </button>
            </div>
            <div className="flex-1 text-center">
              <h1 className="text-2xl font-black tracking-wider flex items-center justify-center gap-1.5">
                {settings.travelMode && <Plane className="w-5 h-5 text-[#0EA5E9]" />} 
                Home Ledger 
                {!settings.travelMode && <span className="text-rose-500">♡</span>}
              </h1>
            </div>
            <div className="flex gap-3 w-24 justify-end relative">
              <button onClick={() => updateUi({ modal: 'barcode' })} className={`p-2.5 rounded-full border ${t.border} ${t.bg} active:scale-95 hover:shadow-sm transition-all text-stone-500 hover:${t.primaryText}`}>
                <Barcode className="w-5 h-5"/>
              </button>
              <button onClick={() => updateUi({ modal: 'notify' })} className={`p-2.5 rounded-full border ${t.border} ${t.bg} active:scale-95 hover:shadow-sm transition-all relative text-stone-500 hover:${t.primaryText}`}>
                <Bell className="w-5 h-5"/>
                {activeAlerts.length > 0 && <span className={`absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 border-2 ${ui.isDark ? 'border-[#202536]' : 'border-white'} rounded-full`}></span>}
              </button>
            </div>
          </header>

          {/* 主畫面 */}
          <main className={`px-6 space-y-8 flex-1 overflow-y-auto pb-40 pt-4 hide-scrollbar ${t.bg}`}>
            
            {/* ================= 首頁 Tab ================= */}
            {ui.tab === 'home' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                
                {/* 🌟 活動帳戶篩選器 */}
                <div className={`flex p-1.5 rounded-2xl border ${t.border} ${t.cardInner} overflow-x-auto hide-scrollbar gap-1 shadow-sm`}>
                   <button onClick={() => updateUi({ filterAccount: 'all' })} className={`shrink-0 px-5 py-2.5 font-bold text-sm rounded-xl transition-all ${(!ui.filterAccount || ui.filterAccount === 'all') ? `${t.bg} shadow-md ${t.primaryText}` : t.textM}`}>全部帳戶</button>
                   {activeAccounts.map(a => (
                      <button key={a.id} onClick={() => updateUi({ filterAccount: a.id })} className={`shrink-0 px-5 py-2.5 font-bold text-sm rounded-xl transition-all ${ui.filterAccount === a.id ? `${t.bg} shadow-md ${t.primaryText}` : t.textM}`}>{a.name}</button>
                   ))}
                </div>

                <section className={`${t.cardInner} rounded-[2.5rem] p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border ${t.border} relative overflow-hidden`}>
                  <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${ui.isDark ? 'from-[#E3B59B]/5' : 'from-indigo-500/5'} to-purple-500/5 rounded-full blur-3xl pointer-events-none`}></div>
                  
                  <div className="flex justify-between items-center mb-6 relative z-10">
                     <button onClick={() => updateUi({ modal: 'date' })} className={`flex items-center gap-2 font-bold text-lg ${t.text} ${t.bg} px-5 py-2.5 rounded-xl border ${t.border} active:scale-95 transition-all hover:border-[#E3B59B]/30`}>
                       {ui.date.getFullYear()}年{ui.date.getMonth() + 1}月 <ChevronDown className="w-5 h-5" />
                     </button>
                  </div>
                  
                  {/* 🌟 總收入與總支出 */}
                  <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
                      <div className={`p-5 rounded-[2rem] border ${t.border} ${t.bg} shadow-sm bg-gradient-to-br from-emerald-500/5 to-transparent`}>
                          <p className={`text-xs font-bold ${t.textM} mb-1 flex items-center gap-1.5`}><TrendingUp className="w-4 h-4 text-emerald-500"/>總收入</p>
                          <h2 className="text-3xl font-black text-emerald-500 drop-shadow-sm">${hStats.inc.toLocaleString()}</h2>
                      </div>
                      <div className={`p-5 rounded-[2rem] border ${t.border} ${t.bg} shadow-sm bg-gradient-to-br from-rose-500/5 to-transparent`}>
                          <p className={`text-xs font-bold ${t.textM} mb-1 flex items-center gap-1.5`}><TrendingDown className="w-4 h-4 text-rose-500"/>總支出</p>
                          <h2 className="text-3xl font-black text-rose-500 drop-shadow-sm">${hStats.exp.toLocaleString()}</h2>
                      </div>
                  </div>

                  <div className="flex items-baseline gap-3 mb-2 px-2 relative z-10">
                    <span className={`text-sm font-bold ${t.textM}`}>結餘</span>
                    <h2 className={`text-[3.5rem] leading-none font-black tracking-tighter drop-shadow-sm ${hStats.inc - hStats.exp >= 0 ? t.text : 'text-rose-500'}`}>
                      ${(hStats.inc - hStats.exp).toLocaleString()}
                    </h2>
                  </div>
                  
                  {/* 預算結轉 */}
                  {rollover.enabled && !settings.travelMode && (!ui.filterAccount || ui.filterAccount === 'all') && (
                    <div className={`mt-6 pt-5 border-t ${t.border} relative z-10`}>
                       <div className="flex items-center gap-2 mb-3">
                         <Sparkles className={`w-5 h-5 text-rose-500`} />
                         <span className={`text-sm font-bold ${t.text}`}>上月預算結轉機制</span>
                       </div>
                       <div className="flex justify-between items-center mb-3">
                         <span className={`text-sm font-bold ${t.textM}`}>上月省下：<strong className="text-emerald-500">${rollover.amt.toLocaleString()}</strong></span>
                         <span className={`text-sm font-bold ${t.textM}`}>本月可用：<strong className={t.text}>${rollover.budget.toLocaleString()}</strong></span>
                       </div>
                       <div className={`w-full h-2.5 ${t.bg} rounded-full overflow-hidden shadow-inner`}>
                         <div className={`h-full ${t.primary} rounded-full transition-all duration-1000 ease-out`} style={{width: `${Math.min((hStats.exp/rollover.budget)*100, 100)}%`}}></div>
                       </div>
                    </div>
                  )}
                </section>

                <div className="flex gap-3">
                  <div className="relative flex-1 group">
                    <Search className={`w-6 h-6 ${t.textM} absolute left-5 top-1/2 -translate-y-1/2 transition-colors`} />
                    <input type="text" value={ui.search} onChange={e => updateUi({ search: e.target.value })} placeholder="搜尋明細、備註..." className={`w-full ${t.cardInner} font-bold py-4 pl-14 pr-5 text-base rounded-2xl border ${t.border} shadow-sm focus:outline-none focus:ring-2 ${t.ring} transition-all`} />
                  </div>
                  <button onClick={() => updateUi({ modal: 'tags' })} className={`p-4 rounded-2xl border ${ui.filterTags.length > 0 ? `${t.primary} ${t.primaryBtnText} border-transparent shadow-md` : `${t.cardInner} ${t.textM} ${t.border}`} shadow-sm active:scale-95 transition-all`}>
                    <Filter className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center px-2">
                    <h3 className="text-2xl font-black">最近明細</h3>
                    
                    {/* 🌟 15 筆分頁切換按鈕 */}
                    <div className="flex gap-2 items-center">
                      <span className={`text-xs font-bold ${t.textM} mr-1`}>{currentPage} / {totalPages}</span>
                      <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className={`p-2 rounded-full ${t.cardInner} border ${t.border} shadow-sm active:scale-95 hover:${t.primaryText} transition-colors disabled:opacity-30 disabled:hover:text-inherit`}
                      ><ChevronLeft className={`w-5 h-5 ${t.textM}`}/></button>
                      <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className={`p-2 rounded-full ${t.cardInner} border ${t.border} shadow-sm active:scale-95 hover:${t.primaryText} transition-colors disabled:opacity-30 disabled:hover:text-inherit`}
                      ><ChevronRight className={`w-5 h-5 ${t.textM}`}/></button>
                    </div>
                  </div>
                  
                  {paginatedTx.length === 0 ? (
                    <div className={`text-center py-16 font-bold text-lg ${t.textM} ${t.cardInner} rounded-3xl border ${t.border} shadow-sm`}>本月還沒有記帳紀錄</div>
                  ) : paginatedTx.map(tx => {
                    const catObj = data.categories.expense.find(c=>c.name===tx.category) || data.categories.income.find(c=>c.name===tx.category);
                    const icon = catObj ? catObj.icon : '📝';
                    
                    let displayDateStr = tx.date;
                    if (tx.date && tx.date.includes('-')) {
                      const [y, m, d] = tx.date.split('-');
                      displayDateStr = `${d}/${m}/${y}`;
                    }
                    
                    return (
                      // 🌟 防誤觸設計：全卡片點擊，但改為打開右下角獨立的編輯與刪除小按鈕
                      <div key={tx.id} className={`p-4 sm:p-5 rounded-3xl flex flex-col border ${t.border} ${t.cardInner} shadow-sm relative overflow-hidden transition-all hover:shadow-md hover:border-[#E3B59B]/30`}>
                        <div className="flex items-center justify-between z-10">
                          <div className="flex items-center gap-3 sm:gap-4 truncate">
                            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full ${t.bg} flex items-center justify-center text-xl sm:text-2xl shrink-0 shadow-inner`}>
                              {tx.type === 'transfer' ? <ArrowRightLeft className="w-5 h-5 text-stone-500" /> : icon}
                            </div>
                            <div className="truncate">
                              <p className="font-extrabold text-lg sm:text-xl truncate mb-1">
                                {tx.type === 'transfer' ? '轉帳' : tx.category} 
                                <span className={`text-xs ${t.textM} ml-2 font-bold`}>
                                  {tx.type === 'transfer' ? 
                                    `${data.accounts.find(a=>a.id===tx.fromAccountId)?.name} ➔ ${data.accounts.find(a=>a.id===tx.toAccountId)?.name}` 
                                    : `(${data.accounts.find(a=>a.id===tx.accountId)?.name})`}
                                </span>
                              </p>
                              <div className="flex gap-1.5 mt-1 flex-wrap items-center">
                              {/* 🌟 付款人與平分顯示邏輯 */}
                              {tx.type !== 'transfer' && (
                                <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-lg font-bold ${t.bg} ${t.textM} border ${t.border}`}>
                                  {tx.type === 'expense' ? '付:' : '收:'}
                                  {tx.payer==='husband' ? '老公' : tx.payer==='wife' ? '老婆' : '共同'}
                                  {tx.type === 'expense' ? (tx.split === 'none' ? '' : (tx.split === 'custom' && tx.splitRatio ? ` (👨${tx.splitRatio.h}%👩${tx.splitRatio.w}%)` : ' (平分)')) : ''}
                                </span>
                              )}
                              {/* 🌟 顯示日期與時間 */}
                              <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-lg font-bold ${t.bg} ${t.textM} border ${t.border}`}>
                                  {displayDateStr} {tx.recordTime || ''}
                                </span>
                                {tx.tags?.map(tg => <span key={tg} className={`text-[10px] sm:text-xs font-bold ${t.primaryText}`}>#{tg}</span>)}
                                <span className={`text-xs sm:text-sm ${t.textM} font-bold truncate max-w-[120px] sm:max-w-[180px] ml-1`}>{tx.note}</span>
                              </div>
                            </div>
                          </div>

                          {/* 🌟 金額與點擊提示區塊 */}
                          <div className="flex flex-col items-end gap-2 shrink-0 ml-2">
                            <span className={`font-black text-xl sm:text-2xl drop-shadow-sm ${tx.type === 'expense' ? t.text : tx.type === 'income' ? 'text-emerald-500' : t.textM}`}>
                              {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}${tx.amount.toLocaleString()}
                            </span>
                            <div className="flex gap-1.5 sm:gap-2">
                               <button 
                                 onClick={(e) => { e.stopPropagation(); handleOpenTx(tx); }} 
                                 className={`p-1.5 sm:p-2 rounded-full ${t.bg} border ${t.border} text-stone-500 hover:${t.primaryText} active:scale-95 transition-all shadow-sm`}
                                 title="編輯這筆紀錄"
                               >
                                 <Edit3 size={14} className="sm:w-4 sm:h-4" />
                               </button>
                               <button 
                                 onClick={(e) => { e.stopPropagation(); confirmDel('確定要刪除這筆紀錄嗎？', () => deleteDoc(getDocRef('shared_ledger', tx.id))); }} 
                                 className={`p-1.5 sm:p-2 rounded-full ${ui.isDark ? 'bg-red-950/30 border-red-900/50 hover:bg-red-900/50' : 'bg-red-50 border-red-100 hover:bg-red-100'} text-red-500 active:scale-95 transition-all shadow-sm`}
                                 title="刪除這筆紀錄"
                               >
                                 <Trash2 size={14} className="sm:w-4 sm:h-4" />
                               </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            
            {/* ================= 帳戶 Tab ================= */}
            {ui.tab === 'wallets' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex justify-between items-center px-2">
                  <h2 className="text-3xl font-black">總資產</h2>
                  <span className={`text-4xl font-black drop-shadow-sm ${t.primaryText}`}>${totalAssets.toLocaleString()}</span>
                </div>
                
                <div className="space-y-4">
                    <h3 className={`font-bold text-sm ${t.textM} px-2`}>活動帳戶</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {activeAccounts.map(a => (
                        <div key={a.id} className={`p-6 rounded-3xl ${t.cardInner} shadow-sm border ${t.border} relative group flex flex-col hover:shadow-md transition-all`}>
                          <div className="flex items-center gap-3 mb-4">
                            <span className="text-4xl drop-shadow-sm">{a.icon}</span>
                            <span className="font-bold text-lg truncate">{a.name}</span>
                          </div>
                          <div className="text-3xl font-black drop-shadow-sm">${(accBal[a.id] || 0).toLocaleString()}</div>
                          
                          <div className="flex justify-end mt-4 pt-4 border-t border-transparent group-hover:border-stone-100 dark:group-hover:border-[#2D3348] gap-2 opacity-0 group-hover:opacity-100 transition-all">
                             <button onClick={() => confirmAction('確定要封存此帳戶嗎？封存後記帳不再顯示，但歷史記錄保留。', () => updateDoc(getDocRef('shared_accounts', a.id), {isArchived: true}))} className={`p-2.5 rounded-full ${t.bg} ${t.textM} hover:${t.primaryText} transition-colors shadow-sm`}>
                               <Archive className="w-4 h-4"/>
                             </button>
                             <button onClick={() => confirmDel('危險操作：確定要刪除帳戶嗎？', () => deleteDoc(getDocRef('shared_accounts', a.id)))} className={`p-2.5 rounded-full ${t.bg} ${t.textM} hover:text-red-500 transition-colors shadow-sm`}>
                               <Trash2 className="w-4 h-4"/>
                             </button>
                          </div>
                        </div>
                      ))}
                      <div onClick={() => updateUi({ modal: 'account' })} className={`bg-transparent border-2 border-dashed ${t.border} rounded-3xl p-6 flex flex-col items-center justify-center ${t.textM} cursor-pointer min-h-[160px] hover:border-[#E3B59B] hover:${t.primaryText} hover:bg-[#E3B59B]/10 transition-all active:scale-95`}>
                        <Plus className="w-10 h-10 mb-3"/>
                        <span className="text-lg font-bold">新增帳戶</span>
                      </div>
                    </div>
                </div>

                {data.accounts.filter(a => a.isArchived).length > 0 && (
                   <div className="space-y-4 pt-6">
                      <h3 className={`font-bold text-sm ${t.textM} px-2 flex items-center gap-2`}><Archive className="w-4 h-4"/>已封存帳戶</h3>
                      <div className="grid grid-cols-2 gap-4 opacity-60 hover:opacity-100 transition-opacity grayscale hover:grayscale-0">
                         {data.accounts.filter(a => a.isArchived).map(a => (
                           <div key={a.id} className={`p-6 rounded-3xl ${t.cardInner} shadow-sm border ${t.border} relative group flex flex-col`}>
                             <div className="flex items-center gap-3 mb-4">
                               <span className="text-4xl">{a.icon}</span>
                               <span className="font-bold text-lg truncate">{a.name}</span>
                             </div>
                             <div className="text-3xl font-black">${(accBal[a.id] || 0).toLocaleString()}</div>
                             <div className="flex justify-end mt-4 pt-4 border-t border-transparent group-hover:border-stone-100 dark:group-hover:border-[#2D3348] gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                <button onClick={() => updateDoc(getDocRef('shared_accounts', a.id), {isArchived: false})} className={`p-2.5 rounded-full ${t.bg} ${t.textM} hover:text-emerald-500 transition-colors shadow-sm`} title="解除封存">
                                  <ArchiveRestore className="w-4 h-4"/>
                                </button>
                                <button onClick={() => confirmDel('危險操作：確定要刪除帳戶嗎？', () => deleteDoc(getDocRef('shared_accounts', a.id)))} className={`p-2.5 rounded-full ${t.bg} ${t.textM} hover:text-red-500 transition-colors shadow-sm`}>
                                  <Trash2 className="w-4 h-4"/>
                                </button>
                             </div>
                           </div>
                         ))}
                      </div>
                   </div>
                )}
              </div>
            )}

            {/* ================= 統計 Tab ================= */}
            {ui.tab === 'stats' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                
                 {/* 🌟 帳戶篩選器 */}
                 <div className={`flex p-1.5 rounded-2xl border ${t.border} ${t.cardInner} overflow-x-auto hide-scrollbar gap-1 shadow-sm`}>
                    <button onClick={() => updateUi({ filterAccount: 'all' })} className={`shrink-0 px-4 py-2 font-bold text-sm rounded-xl transition-all ${(!ui.filterAccount || ui.filterAccount === 'all') ? `${t.bg} shadow-md ${t.primaryText}` : t.textM}`}>全部帳戶</button>
                    {activeAccounts.map(a => (
                       <button key={a.id} onClick={() => updateUi({ filterAccount: a.id })} className={`shrink-0 px-4 py-2 font-bold text-sm rounded-xl transition-all ${ui.filterAccount === a.id ? `${t.bg} shadow-md ${t.primaryText}` : t.textM}`}>{a.name}</button>
                    ))}
                 </div>

                 {/* 🌟 日期模式切換 */}
                 <div className={`flex ${t.cardInner} p-1.5 rounded-2xl border ${t.border} shadow-sm`}>
                   <button onClick={() => updateUi({ statsView: 'month' })} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${ui.statsView === 'month' ? `${t.bg} ${t.text} shadow-md` : t.textM}`}>當月分析</button>
                   <button onClick={() => updateUi({ statsView: 'year' })} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${ui.statsView === 'year' ? `${t.bg} ${t.text} shadow-md` : t.textM}`}>年度總結</button>
                   <button onClick={() => updateUi({ statsView: 'custom' })} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${ui.statsView === 'custom' ? `${t.bg} ${t.text} shadow-md` : t.textM}`}>自訂區間</button>
                 </div>
                 
                 <div className="flex justify-between items-center px-2 pt-2 mb-2">
                   {ui.statsView === 'custom' ? (
                      <div className="flex gap-2 w-full items-center">
                         <div className="relative flex-1 group">
                           <div className={`flex items-center justify-between p-4 rounded-2xl border ${t.border} ${t.cardInner} shadow-sm group-focus-within:ring-2 ${t.ring} transition-all`}>
                             <div className="flex items-center gap-2">
                               <Calendar className={`w-5 h-5 ${t.textM}`} />
                               <span className={`font-bold text-sm ${ui.dateRange.start ? t.text : t.textM}`}>{ui.dateRange.start ? ui.dateRange.start.replace(/-/g, '/') : 'mm/dd/yyyy'}</span>
                             </div>
                             <Calendar className={`w-4 h-4 ${t.textM} opacity-50`} />
                           </div>
                           <input type="date" value={ui.dateRange.start} onChange={e=>updateUi({dateRange:{...ui.dateRange, start: e.target.value}})} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                         </div>
                         <span className={`self-center ${t.textM} font-bold`}>至</span>
                         <div className="relative flex-1 group">
                           <div className={`flex items-center justify-between p-4 rounded-2xl border ${t.border} ${t.cardInner} shadow-sm group-focus-within:ring-2 ${t.ring} transition-all`}>
                             <div className="flex items-center gap-2">
                               <Calendar className={`w-5 h-5 ${t.textM}`} />
                               <span className={`font-bold text-sm ${ui.dateRange.end ? t.text : t.textM}`}>{ui.dateRange.end ? ui.dateRange.end.replace(/-/g, '/') : 'mm/dd/yyyy'}</span>
                             </div>
                             <Calendar className={`w-4 h-4 ${t.textM} opacity-50`} />
                           </div>
                           <input type="date" value={ui.dateRange.end} onChange={e=>updateUi({dateRange:{...ui.dateRange, end: e.target.value}})} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                         </div>
                      </div>
                   ) : (
                      <button onClick={() => updateUi({ modal: 'date' })} className={`flex items-center gap-1.5 font-bold text-lg ${t.cardInner} px-5 py-2.5 rounded-xl shadow-sm border ${t.border} active:scale-95 transition-all`}>
                        {ui.date.getFullYear()}年{ui.statsView === 'month' ? `${ui.date.getMonth() + 1}月` : '全年度'} <ChevronDown className="w-5 h-5 ml-1" />
                      </button>
                   )}
                 </div>

                 {/* 🌟 趨勢折線圖 (僅年度顯示) */}
                 {ui.statsView === 'year' && <LineChart data={yearTrendData} t={t} />}

                 {/* 🌟 收支動態切換按鈕 */}
                 <div className={`flex ${t.cardInner} p-1.5 rounded-2xl border ${t.border} shadow-sm mb-4`}>
                   <button onClick={() => updateUi({ chartView: 'expense' })} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${ui.chartView === 'expense' ? `bg-rose-500/10 text-rose-500 shadow-sm` : t.textM}`}>支出分析</button>
                   <button onClick={() => updateUi({ chartView: 'income' })} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${ui.chartView === 'income' ? `bg-emerald-500/10 text-emerald-500 shadow-sm` : t.textM}`}>收入分析</button>
                 </div>

                 {/* 🌟 雙同心圓環儀表板 */}
                 <div className={`${t.cardInner} rounded-[2.5rem] p-8 border ${t.border} shadow-sm flex flex-col items-center relative overflow-hidden`}>
                 
                  {/* 背景裝飾光暈 */}
                  <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-full blur-[80px] opacity-20 pointer-events-none transition-colors duration-1000 ${ui.chartView === 'expense' ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>

                  <div className="relative w-64 h-64 flex items-center justify-center mb-8 z-10">
                    <svg className="w-full h-full transform -rotate-90 drop-shadow-xl" viewBox="0 0 100 100">
                      {/* 外圈：總收入 (翡翠綠) - 半徑 42 */}
                      <circle cx="50" cy="50" r="42" fill="transparent" stroke={ui.isDark ? "#2D3348" : "#F4F4F5"} strokeWidth="8" />
                      <circle cx="50" cy="50" r="42" fill="transparent" stroke="#10B981" strokeWidth="8" 
                              strokeDasharray="263.89" 
                              strokeDashoffset={263.89 * (1 - (tStats.inc / (Math.max(tStats.inc, tStats.exp) || 1)))} 
                              className={`donut-ring ${ui.chartView === 'expense' ? 'opacity-30' : 'opacity-100'}`} />
                      
                      {/* 內圈：總支出 (玫瑰紅) - 半徑 30 */}
                      <circle cx="50" cy="50" r="30" fill="transparent" stroke={ui.isDark ? "#2D3348" : "#F4F4F5"} strokeWidth="8" />
                      <circle cx="50" cy="50" r="30" fill="transparent" stroke="#F43F5E" strokeWidth="8" 
                              strokeDasharray="188.49" 
                              strokeDashoffset={188.49 * (1 - (tStats.exp / (Math.max(tStats.inc, tStats.exp) || 1)))} 
                              className={`donut-ring ${ui.chartView === 'income' ? 'opacity-30' : 'opacity-100'}`} />
                    </svg>

                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full mb-1 tracking-widest ${ui.chartView === 'expense' ? 'bg-rose-500/20 text-rose-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                        {ui.chartView === 'expense' ? '內圈：總支出' : '外圈：總收入'}
                      </span>
                      <span className={`text-4xl font-black mt-1 ${t.text} drop-shadow-sm`}>
                        ${(ui.chartView === 'expense' ? tStats.exp : tStats.inc).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="w-full space-y-3 z-10 relative">
                    {chartData.length === 0 ? <div className={`text-center text-sm font-bold ${t.textM}`}>目前沒有資料</div> : chartData.map((item, idx) => (
                      <div key={idx} className={`flex justify-between items-center p-4 rounded-xl ${t.bg} border ${t.border} shadow-sm hover:shadow-md transition-shadow`}>
                        <div className="flex gap-3 font-bold text-base items-center"><span className="text-2xl drop-shadow-sm">{item.icon}</span> {item.name}</div>
                        <div className="font-black text-lg">{item.percentage}%</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`${t.cardInner} rounded-[2.5rem] p-7 border ${t.border} shadow-sm`}>
                  <h3 className="font-extrabold text-lg mb-6 flex items-center gap-2"><ArrowRightLeft className="w-6 h-6 text-indigo-500"/> {ui.statsView === 'month' ? '本月' : ui.statsView === 'year' ? '年度' : '區間'}代墊結算</h3>
                  <p className={`text-xs ${t.textM} font-bold mb-5 -mt-4 bg-black/5 dark:bg-white/5 p-2 rounded-lg`}>💡 結算為當前區間內之整體資料</p>
                  {settlement.status === 'settled' ? (
                    <div className={`p-5 text-center font-bold text-emerald-500 bg-emerald-500/10 rounded-2xl text-base flex items-center justify-center gap-2`}>🎉 帳目完全算清！</div>
                  ) : (
                    <div className={`flex items-center justify-between ${t.bg} rounded-2xl p-5 border ${t.border} shadow-inner`}>
                      <div className="flex flex-col items-center">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-sm ${settlement.who === 'husband' ? 'bg-[#EAE0D5]' : 'bg-[#FEF0C7]'}`}>
                          {settlement.who === 'husband' ? '👨' : '👩'}
                        </div>
                        <span className={`text-xs font-bold mt-2 ${t.textM}`}>{settlement.who === 'husband' ? '老公' : '老婆'} (欠款)</span>
                      </div>
                      
                      <div className="flex flex-col items-center flex-1 px-2 relative">
                        <div className="flex items-center justify-center w-full text-rose-500">
                          <ArrowRight className="w-5 h-5 mr-1 animate-pulse" strokeWidth={3} />
                          <span className="text-3xl font-black mx-1 drop-shadow-sm">${Math.round(settlement.amt).toLocaleString()}</span>
                          <ArrowRight className="w-5 h-5 ml-1 animate-pulse" strokeWidth={3} />
                        </div>
                      </div>

                      <div className="flex flex-col items-center">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-sm ${settlement.to === 'husband' ? 'bg-[#EAE0D5]' : 'bg-[#FEF0C7]'}`}>
                          {settlement.to === 'husband' ? '👨' : '👩'}
                        </div>
                        <span className={`text-xs font-bold mt-2 ${t.textM}`}>{settlement.to === 'husband' ? '老公' : '老婆'} (代墊)</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className={`${t.cardInner} rounded-[2.5rem] p-6 border ${t.border} shadow-sm`}>
                  <button onClick={handleCallAI} disabled={isAiLoading} className={`w-full ${t.primary} ${t.primaryBtnText} py-5 rounded-2xl font-bold text-lg flex justify-center items-center gap-2 active:scale-95 shadow-lg disabled:opacity-50 transition-all`}>
                    {isAiLoading ? <Loader2 className="animate-spin w-5 h-5"/> : <Sparkles className="w-5 h-5"/>} 產生理財顧問分析
                  </button>
                  {aiAnalysis && <p className={`mt-5 p-6 ${t.bg} rounded-3xl text-base font-bold leading-relaxed border ${t.border} shadow-inner`}>{aiAnalysis}</p>}
                </div>
              </div>
            )}

            {/* ================= 生活 Tab ================= */}
            {ui.tab === 'life' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className={`flex ${t.cardInner} p-1.5 rounded-2xl border ${t.border} shadow-sm overflow-x-auto hide-scrollbar`}>
                  {[
                    { id: 'bills', label: '帳單', icon: <CalendarClock className="w-5 h-5"/> }, 
                    { id: 'shopping', label: '購物', icon: <ShoppingCart className="w-5 h-5"/> }, 
                    { id: 'notes', label: '記事', icon: <StickyNote className="w-5 h-5"/> }, 
                    { id: 'events', label: '日子', icon: <CalendarHeart className="w-5 h-5"/> },
                    { id: 'goals', label: '夢想', icon: <Target className="w-5 h-5"/> }
                  ].map(item => (
                    <button key={item.id} onClick={() => updateUi({ subTab: item.id })} className={`flex-1 min-w-[70px] py-3 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all ${ui.subTab === item.id ? `${t.bg} ${t.text} shadow-md` : t.textM}`}>
                      {item.icon} {item.label}
                    </button>
                  ))}
                </div>
                
                {ui.subTab === 'bills' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-6 px-2">
                      <div>
                        <h3 className="text-xl font-black">每月固定帳單</h3>
                        <p className={`text-xs font-bold ${t.textM} mt-1`}>時間到自動提醒繳費</p>
                      </div>
                      <button onClick={() => updateUi({ modal: 'bill' })} className={`px-5 py-2.5 ${t.cardInner} border ${t.border} rounded-full text-sm font-bold shadow-sm active:scale-95 transition-all hover:border-indigo-500/30`}>
                        + 新增帳單
                      </button>
                    </div>

                    {data.bills.length === 0 ? (
                      <div className={`py-16 text-center text-sm font-bold ${t.textM} ${t.cardInner} rounded-3xl border ${t.border} shadow-sm`}>沒有固定帳單</div>
                    ) : data.bills.map(b => (
                      <div key={b.id} className={`p-5 rounded-3xl flex justify-between items-center border ${t.border} ${t.cardInner} shadow-sm transition-all hover:shadow-md ${b.isPaid ? 'opacity-50 grayscale' : ''}`}>
                        <div className="flex gap-4 items-center">
                          <div className={`text-3xl ${t.bg} w-14 h-14 flex justify-center items-center rounded-full shadow-inner`}>{b.icon}</div>
                          <div>
                            <div className="font-bold text-lg">{b.name}</div>
                            <div className={`text-xs font-bold ${t.textM} mt-1`}>{b.isPaid ? '已繳' : `每月 ${b.dueDate} 號`}</div>
                          </div>
                        </div>
                        <div className="flex gap-3 items-center">
                          <span className="font-black text-2xl drop-shadow-sm">${b.amount}</span>
                          {!b.isPaid && (
                            <button onClick={() => doAction(() => updateDoc(getDocRef('shared_bills', b.id), {isPaid: true}), "已繳款")} className={`p-2.5 rounded-full ${t.primary} ${t.primaryBtnText} shadow-md active:scale-95 hover:brightness-110 transition-all`}>
                              <Check className="w-5 h-5"/>
                            </button>
                          )}
                          <Trash2 onClick={() => confirmDel('刪除帳單？', () => deleteDoc(getDocRef('shared_bills', b.id)))} className={`w-5 h-5 ${t.textM} hover:text-red-500 cursor-pointer transition-colors`}/>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {ui.subTab === 'shopping' && (
                  <div className="space-y-4">
                    <form onSubmit={e => { e.preventDefault(); const v = e.target.item.value.trim(); if(v) doAction(() => addDoc(getCol('shared_shopping'), {text: v, completed: false, createdAt: serverTimestamp()})); e.target.reset(); }} className="flex gap-3 mb-6">
                      <input name="item" placeholder="新增待買物品..." className={`flex-1 px-5 py-4 rounded-2xl border ${t.border} ${t.cardInner} font-bold text-base shadow-sm focus:outline-none focus:ring-2 ${t.ring} transition-all`}/>
                      <button type="submit" className={`px-6 rounded-2xl ${t.primary} ${t.primaryBtnText} shadow-md active:scale-95 transition-all`}><Plus className="w-6 h-6"/></button>
                    </form>
                    
                    {data.shopping.length === 0 ? (
                      <div className={`py-16 text-center text-sm font-bold ${t.textM} ${t.cardInner} rounded-3xl border ${t.border} shadow-sm`}>購物清單空空如也！</div>
                    ) : data.shopping.map(s => (
                      <div key={s.id} className={`p-5 rounded-2xl flex justify-between items-center border ${t.border} ${t.cardInner} shadow-sm hover:shadow-md transition-all`}>
                        <div className="flex gap-4 items-center flex-1 cursor-pointer group" onClick={() => updateDoc(getDocRef('shared_shopping', s.id), {completed: !s.completed})}>
                          <CheckCircle2 className={`w-6 h-6 transition-colors ${s.completed ? 'text-emerald-500' : `${t.textM} group-hover:text-indigo-400`}`}/>
                          <span className={`font-bold text-base transition-all ${s.completed ? 'line-through opacity-50' : ''}`}>{s.text}</span>
                        </div>
                        <Trash2 onClick={() => confirmDel('刪除物品？', () => deleteDoc(getDocRef('shared_shopping', s.id)))} className={`w-5 h-5 ${t.textM} hover:text-red-500 cursor-pointer transition-colors`}/>
                      </div>
                    ))}
                  </div>
                )}

                {ui.subTab === 'notes' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-6 px-2">
                      <div>
                        <h3 className="text-xl font-black">共同記事</h3>
                        <p className={`text-xs font-bold ${t.textM} mt-1`}>記錄生活大小事</p>
                      </div>
                      <button onClick={() => updateUi({ modal: 'note', selectedItem: null })} className={`px-5 py-2.5 ${t.primary} ${t.primaryBtnText} rounded-full text-sm font-bold shadow-md active:scale-95 transition-all`}>
                        + 新增筆記
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {data.notes.map(n => (
                        <div key={n.id} onClick={() => updateUi({ selectedItem: n, modal: 'note' })} className={`${t.cardInner} border ${t.border} rounded-3xl p-5 cursor-pointer min-h-[160px] relative shadow-sm hover:shadow-md hover:border-indigo-500/30 transition-all group`}>
                          <h4 className={`font-extrabold text-lg mb-2 truncate ${t.text} group-hover:text-indigo-500 transition-colors`}>{n.title}</h4>
                          <p className={`text-xs opacity-80 line-clamp-4 font-bold ${t.textM} leading-relaxed`}>{n.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {ui.subTab === 'events' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-6 px-2">
                      <div>
                        <h3 className="text-xl font-black">重要日子倒數</h3>
                        <p className={`text-xs font-bold ${t.textM} mt-1`}>紀念日與行程</p>
                      </div>
                      <button onClick={() => updateUi({ modal: 'event' })} className={`px-5 py-2.5 bg-pink-500/10 text-pink-500 border border-pink-500/20 rounded-full text-sm font-bold shadow-sm active:scale-95 transition-all hover:bg-pink-500/20`}>
                        + 新增日子
                      </button>
                    </div>

                    {data.events.length === 0 ? (
                       <div className={`py-16 text-center text-sm font-bold ${t.textM} ${t.cardInner} rounded-3xl border ${t.border} shadow-sm`}>還沒有設定重要的日子喔！</div>
                    ) : data.events.map(e => { 
                      const d = calculateDaysDiff(e.date); 
                      return (
                        <div key={e.id} className={`p-5 rounded-3xl flex justify-between items-center border ${t.border} ${t.cardInner} shadow-sm hover:shadow-md transition-all`}>
                          <div className="flex gap-4 items-center">
                            <div className="text-3xl bg-pink-500/10 w-14 h-14 flex items-center justify-center rounded-full shadow-inner">{e.icon}</div>
                            <div>
                              <div className="font-bold text-lg">{e.title}</div>
                              <div className={`text-xs font-bold ${t.textM} mt-1`}>{e.date}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-black text-2xl text-pink-500 drop-shadow-sm">{d === 0 ? '今天' : d}</span>
                            <Trash2 onClick={() => confirmDel('刪除日子？', () => deleteDoc(getDocRef('shared_events', e.id)))} className={`w-5 h-5 ${t.textM} hover:text-red-500 cursor-pointer transition-colors`}/>
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
                   <button onClick={() => updateUi({ modal: 'goal' })} className={`text-sm font-bold ${t.cardInner} border ${t.border} px-5 py-2.5 rounded-full shadow-sm active:scale-95 transition-all hover:border-indigo-500/30`}>+ 新增願望</button>
                 </div>
                 <div className="grid grid-cols-1 gap-5">
                  {data.goals.length === 0 ? (
                    <div className={`${t.cardInner} p-12 rounded-[2rem] border ${t.border} text-center shadow-sm font-bold`}>
                      <Target className={`w-14 h-14 ${t.textM} mx-auto mb-4 opacity-50`} />
                      <p className={`text-base ${t.textM}`}>還沒有設定存錢目標喔！</p>
                    </div>
                  ) : data.goals.map(g => {
                    const prog = Math.min((g.currentAmount / g.targetAmount) * 100, 100); 
                    const isOk = prog >= 100;
                    return (
                      <div key={g.id} className={`p-6 rounded-[2rem] border ${t.border} ${t.cardInner} shadow-sm relative overflow-hidden transition-all hover:shadow-md`}>
                        <div className="flex justify-between items-center mb-5 pr-8 relative z-10">
                          <div className="font-extrabold text-xl flex items-center gap-2">{isOk ? '🎉' : '🎯'} {g.title}</div>
                          <div className={`text-xs font-black ${t.primaryText} ${t.bg} px-2.5 py-1 rounded-lg border ${t.border}`}>{prog.toFixed(0)}%</div>
                        </div>
                        <div className="flex justify-between items-end mb-3 relative z-10">
                          <span className="text-4xl font-black drop-shadow-sm">${g.currentAmount.toLocaleString()}</span>
                          <span className={`text-sm font-bold ${t.textM}`}>/ ${g.targetAmount.toLocaleString()}</span>
                        </div>
                        <div className={`h-3 w-full ${t.bg} rounded-full overflow-hidden mb-5 shadow-inner relative z-10`}>
                          <div className={`h-full rounded-full transition-all duration-1000 ease-out ${isOk ? 'bg-emerald-500' : t.primary}`} style={{ width: `${prog}%` }}></div>
                        </div>
                        {!isOk && (
                          <button onClick={() => updateUi({ modal: 'fund', selectedItem: g })} className={`w-full py-4 ${t.bg} font-bold text-sm rounded-xl flex justify-center items-center gap-2 active:scale-95 border ${t.border} transition-all hover:text-indigo-500 relative z-10`}>
                            <Coins className={`w-5 h-5 ${t.primaryText}`} /> 存入資金
                          </button>
                        )}
                        <Trash2 onClick={() => confirmDel('刪除目標？', () => deleteDoc(getDocRef('shared_goals', g.id)))} className={`absolute top-7 right-6 w-5 h-5 ${t.textM} hover:text-red-500 cursor-pointer z-20 transition-colors`}/>
                      </div>
                    )
                  })}
                 </div>
              </div>
                )}
              </div>
            )}
          </main>

          {/* ================= 浮動導覽列 (升級磨砂玻璃質感) ================= */}
          <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none">
            <div className="w-full max-w-md md:max-w-xl relative pointer-events-auto">
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-50">
                <button onClick={() => handleOpenTx(null)} className={`h-[72px] w-[72px] ${t.primary} ${t.primaryBtnText} rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-transform border-[6px] ${ui.isDark ? 'border-[#161925]' : 'border-[#FDFBF7]'} hover:brightness-110`}>
                  <Plus className="w-8 h-8" strokeWidth={3} />
                </button>
              </div>
              <nav className={`w-full ${ui.isDark ? 'bg-[#202536]/80' : 'bg-white/80'} backdrop-blur-xl border-t ${t.border} px-8 pb-safe pt-3 flex justify-between items-center h-[80px] rounded-t-[2.5rem] shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] transition-colors duration-500`}>
                <div className="flex gap-8">
                  <button onClick={() => updateUi({ tab: 'home' })} className={`flex flex-col items-center gap-1.5 transition-colors ${ui.tab === 'home' ? t.primaryText : t.textM}`}>
                    <Home className="w-6 h-6" />
                    <span className="text-[10px] font-bold">首頁</span>
                  </button>
                  <button onClick={() => updateUi({ tab: 'wallets' })} className={`flex flex-col items-center gap-1.5 transition-colors ${ui.tab === 'wallets' ? t.primaryText : t.textM}`}>
                    <Wallet className="w-6 h-6" />
                    <span className="text-[10px] font-bold">帳戶</span>
                  </button>
                </div>
                <div className="w-16 shrink-0"></div> 
                <div className="flex gap-8">
                  <button onClick={() => updateUi({ tab: 'stats' })} className={`flex flex-col items-center gap-1.5 transition-colors ${ui.tab === 'stats' ? t.primaryText : t.textM}`}>
                    <PieChartIcon className="w-6 h-6" />
                    <span className="text-[10px] font-bold">統計</span>
                  </button>
                  <button onClick={() => updateUi({ tab: 'life' })} className={`flex flex-col items-center gap-1.5 transition-colors ${ui.tab === 'life' ? t.primaryText : t.textM}`}>
                    <ClipboardList className="w-6 h-6" />
                    <span className="text-[10px] font-bold">生活</span>
                  </button>
                </div>
              </nav>
            </div>
          </div>

          {/* ================= 彈出視窗 (Modals) Wrapper ================= */}
          {ui.modal && (
            <div className="fixed inset-0 z-[50] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
              {/* 🌟 改造 Modal 高度與結構，消除計算機巨大空隙 */}
              <div className={`w-full max-w-md md:max-w-xl ${t.cardInner} rounded-t-[2.5rem] sm:rounded-[2.5rem] flex flex-col shadow-2xl overflow-hidden mt-10 sm:mt-0 h-[92vh] sm:h-auto sm:max-h-[92vh] border ${ui.isDark ? 'border-white/10' : 'border-stone-200'}`}>
                <div className="flex justify-between items-center shrink-0 p-6 pb-4">
                  <h3 className="font-black text-2xl flex items-center gap-2">
                    {ui.modal === 'settings' && <Settings className={`w-6 h-6 ${t.textM}`}/>}
                    {ui.modal === 'barcode' && <Barcode className={`w-6 h-6 ${t.textM}`}/>}
                    {ui.modal === 'notify' && <Bell className={`w-6 h-6 ${t.textM}`}/>}
                    {ui.modal === 'categories' && <List className={`w-6 h-6 ${t.textM}`}/>}
                    {ui.modal === 'tx' ? (ui.selectedTx ? '修改紀錄' : '新增紀錄') : ui.modal === 'settings' ? '設定與管理' : ui.modal === 'barcode' ? '發票載具' : ui.modal === 'notify' ? '推播與通知' : ui.modal === 'categories' ? '自訂分類管理' : '選單'}
                  </h3>
                  <button onClick={() => updateUi({ modal: null, selectedTx: null })} className={`p-2.5 ${t.bg} rounded-full active:scale-95 transition-colors hover:text-rose-500`}>
                    <X className={`w-6 h-6 ${t.textM}`}/>
                  </button>
                </div>
                
                <div className="flex-1 overflow-hidden flex flex-col">
                  {ui.modal === 'tx' && (
                    <TxForm 
                      accounts={activeAccounts} cats={data.categories} tags={data.tags} initialData={ui.selectedTx} 
                      templates={data.templates} settings={settings}
                      onAI={() => updateUi({ modal: 'ai' })} onAddTag={handleAddGlobalTag}
                      onSaveTemplate={(tpl) => doAction(() => addDoc(getCol('shared_templates'), {...tpl, createdAt: serverTimestamp()}), '範本已儲存')}
                      onDeleteTemplate={(id) => confirmDel('確定要刪除範本嗎？', () => deleteDoc(getDocRef('shared_templates', id)))}
                      onSave={handleTxSave}
                      onDeleteTx={(id) => confirmDel('確定要刪除這筆紀錄嗎？', () => deleteDoc(getDocRef('shared_ledger', id)))} 
                      t={t} ui={ui}
                    />
                  )}

                  {/* 其他表單放置於可滾動區塊中 */}
                  {ui.modal !== 'tx' && (
                  <div className="flex-1 overflow-y-auto px-6 pb-safe hide-scrollbar">
                    {ui.modal === 'ai' && (
                      <AIForm 
                        cats={data.categories} accounts={activeAccounts} onBack={() => updateUi({ modal: 'tx' })} 
                        onSave={handleTxSave} 
                        showToast={showToast} t={t} ui={ui} 
                      />
                    )}
                    {ui.modal === 'date' && (
                      <div className="grid grid-cols-3 gap-3 pb-8 pt-4">
                        {Array.from({length:12}).map((_,i) => (
                          <button key={i} onClick={() => { updateUi({ date: new Date(ui.date.getFullYear(), i, 1), modal: null }); }} className={`py-5 rounded-2xl font-bold border text-lg active:scale-95 transition-all ${ui.date.getMonth()===i ? `${t.primary} ${t.primaryBtnText} border-transparent shadow-md` : `${t.bg} ${t.border} hover:border-[#E3B59B]/30`}`}>
                            {i+1}月
                          </button>
                        ))}
                      </div>
                    )}
                    {ui.modal === 'settings' && (
                      <SettingsForm 
                        settings={settings} onSave={(s) => doAction(() => setDoc(getDocRef('shared_settings', 'main'), s, {merge:true}), '設定已儲存')} 
                        onExport={handleExportToSheets} 
                        onRecurring={() => updateUi({ modal: 'recurring' })} 
                        onCategories={() => updateUi({ modal: 'categories' })}
                        t={t} 
                      />
                    )}
                    {ui.modal === 'categories' && (
                      <CategoryForm 
                         categories={data.categories} 
                         onSave={cats => doAction(() => setDoc(getDocRef('shared_settings', 'categories'), cats), '分類已儲存')} 
                         t={t} 
                      />
                    )}
                    {ui.modal === 'recurring' && (
                      <RecurringForm 
                        rules={data.recurringRules} accounts={activeAccounts} cats={data.categories} 
                        onSave={r => doAction(() => addDoc(getCol('recurring_rules'), r), '自動記帳規則已建立')} 
                        onDelete={id => confirmDel('刪除此規則？', () => deleteDoc(getDocRef('recurring_rules', id)))} 
                        t={t} 
                      />
                    )}
                    {ui.modal === 'barcode' && (
                      <BarcodeForm codes={{h:settings.husbandBarcode, w:settings.wifeBarcode}} onSave={(h, w) => doAction(() => setDoc(getDocRef('shared_settings', 'main'), {husbandBarcode:h, wifeBarcode:w}, {merge:true}), '載具已儲存')} t={t} />
                    )}
                    {ui.modal === 'notify' && (
                      <div className="space-y-4 pb-8">
                        {activeAlerts.length === 0 ? (
                          <div className={`flex flex-col items-center justify-center py-16 text-center ${t.textM}`}>
                            <Bell className="w-16 h-16 mb-4 opacity-50" />
                            <span className="font-bold text-lg">目前沒有任何新通知 🎉</span>
                          </div>
                        ) : activeAlerts.map(a => (
                          <div key={a.id} className={`flex items-center gap-4 p-5 rounded-3xl border ${t.border} ${t.bg} relative shadow-sm transition-all hover:shadow-md`}>
                            <div className={`w-14 h-14 rounded-full ${t.cardInner} flex items-center justify-center text-3xl shadow-inner shrink-0`}>
                              {a.icon}
                            </div>
                            <div className="flex-1 pr-6">
                              <h4 className="font-extrabold text-lg mb-1">{a.title}</h4>
                              <p className={`text-sm font-bold ${t.textM}`}>{a.desc}</p>
                            </div>
                            <button 
                              onClick={() => setDismissedAlerts(prev => [...prev, a.id])} 
                              className={`absolute top-5 right-5 text-stone-400 hover:text-rose-500 active:scale-95 transition-colors`}
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {ui.modal === 'account' && (
                      <AccForm onSave={d => doAction(() => addDoc(getCol('shared_accounts'), {...d, createdAt: serverTimestamp(), isArchived: false}), '帳戶建立')} t={t} />
                    )}
                    {ui.modal === 'bill' && (
                      <BillForm onSave={d => doAction(() => addDoc(getCol('shared_bills'), {...d, isPaid: false, createdAt: serverTimestamp()}), '帳單建立')} t={t} />
                    )}
                    {ui.modal === 'note' && (
                      <NoteForm 
                        data={ui.selectedItem} 
                        onSave={d => {
                          const { id, ...payload } = d;
                          payload.updatedAt = serverTimestamp();
                          Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
                          if (id) doAction(() => updateDoc(getDocRef('shared_notes', id), payload), '修改成功');
                          else { payload.createdAt = serverTimestamp(); doAction(() => addDoc(getCol('shared_notes'), payload), '新增成功'); }
                        }} 
                        onDelete={id => confirmDel('刪除筆記？', () => deleteDoc(getDocRef('shared_notes', id)))} 
                        t={t} 
                      />
                    )}
                    {ui.modal === 'event' && (
                      <EventForm onSave={d => doAction(() => addDoc(getCol('shared_events'), {...d, createdAt: serverTimestamp()}), '建立成功')} t={t} />
                    )}
                    {ui.modal === 'goal' && (
                      <GoalForm onSave={d => doAction(() => addDoc(getCol('shared_goals'), {...d, currentAmount: 0, createdAt: serverTimestamp()}), '目標建立')} t={t} />
                    )}
                    {ui.modal === 'fund' && (
                      <FundForm goal={ui.selectedItem} onSave={amt => doAction(() => updateDoc(getDocRef('shared_goals', ui.selectedItem.id), {currentAmount: ui.selectedItem.currentAmount + amt}), '存入成功')} t={t} />
                    )}
                    {/* 🌟 支援刪除功能的全域標籤過濾面板 */}
                    {ui.modal === 'tags' && (
                      <div className="space-y-5 pb-8 pt-2">
                        <div className="flex justify-between items-center px-1 mb-4">
                           <span className={`font-bold text-sm ${t.text}`}>管理與篩選標籤</span>
                           <div className="flex items-center gap-1.5">
                             <span className={`text-xs ${t.textM}`}>管理模式</span>
                             <ToggleSwitch checked={ui.isManageTags} onChange={(v) => updateUi({isManageTags: v})} isDark={ui.isDark} />
                           </div>
                        </div>

                        {/* 新增全域標籤輸入區塊 */}
                        <div className={`flex items-center gap-2 p-1.5 rounded-[1.25rem] ${t.bg} border ${t.border} shadow-inner focus-within:ring-2 ${t.ring} transition-all mb-4`}>
                           <Tag className={`w-5 h-5 ml-3 ${t.textM}`} />
                           <input 
                             value={newGlobalTag} 
                             onChange={e => setNewGlobalTag(e.target.value)} 
                             placeholder="輸入新標籤..." 
                             className={`flex-1 bg-transparent px-2 py-3 outline-none font-bold text-base ${t.text}`}
                           />
                           <button 
                             onClick={() => { handleAddGlobalTag(newGlobalTag); setNewGlobalTag(''); }} 
                             disabled={!newGlobalTag.trim()} 
                             className={`px-5 py-3 rounded-xl ${t.primary} ${t.primaryBtnText} font-bold text-sm shadow-md active:scale-95 disabled:opacity-50 transition-all`}
                           >
                             新增
                           </button>
                        </div>
                        
                        {data.tags.length === 0 ? (
                           <div className={`text-center py-10 text-sm font-bold ${t.textM} bg-stone-50 dark:bg-[#161925]/50 rounded-2xl`}>尚無建立任何標籤</div>
                        ) : (
                          <div className="flex flex-wrap gap-3">
                            {data.tags.map(tag => (
                              <div key={tag} className="relative group">
                                <button onClick={() => !ui.isManageTags && updateUi({filterTags: ui.filterTags.includes(tag) ? ui.filterTags.filter(x=>x!==tag) : [...ui.filterTags,tag]})} className={`px-5 py-2.5 rounded-full text-sm font-bold border transition-all ${ui.isManageTags ? `${t.bg} ${t.border} pr-10 opacity-70 cursor-default` : ui.filterTags.includes(tag) ? `${t.primary} ${t.primaryBtnText} border-transparent shadow-md` : `${t.bg} ${t.border} hover:shadow-md`}`}>
                                  #{tag}
                                </button>
                                {ui.isManageTags && (
                                  <button onClick={() => handleDeleteGlobalTag(tag)} className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors">
                                    <X size={16} strokeWidth={3} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {!ui.isManageTags && <button onClick={() => updateUi({filterTags:[], modal:null})} className={`w-full py-4 mt-4 rounded-[1.25rem] font-bold text-lg ${t.bg} border ${t.border} active:scale-95 transition-all hover:brightness-95`}>清除篩選並關閉</button>}
                      </div>
                    )}
                  </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
        </div>
      </div>
    </React.Fragment>
  );
}

// ==========================================
// 4. 獨立子組件庫 (Forms & Modals)
// ==========================================

// 🌟 記帳表單 (旗艦升級：多幣別選擇 + 彈性比例拆帳 + 沉浸無縫計算機 + 優化標籤與相機)
const TxForm = ({ accounts, cats, tags, initialData, templates, settings, onAI, onAddTag, onSaveTemplate, onDeleteTemplate, onSave, onDeleteTx, t, ui }) => {
  const [data, setData] = useState({ 
    id: initialData?.id || null, 
    type: initialData?.type || 'expense', 
    category: initialData?.category || cats.expense[0]?.name || '餐飲', 
    accountId: initialData?.accountId || (accounts[0]?.id || ''), 
    fromAccountId: initialData?.fromAccountId || (accounts[0]?.id || ''),
    toAccountId: initialData?.toAccountId || (accounts[1]?.id || ''), 
    amount: initialData ? String(initialData.amount) : '', 
    note: initialData?.note || '', 
    tags: initialData?.tags || [],
    recordDate: initialData?.date || getLocalYYYYMMDD(new Date()),
    recordTime: initialData?.recordTime || getLocalHHmm(new Date())
  });

  const [displayDate, setDisplayDate] = useState(() => {
    const dStr = initialData?.date || getLocalYYYYMMDD(new Date());
    const [y, m, d] = dStr.split('-');
    return `${d}/${m}/${y}`;
  });

  const handleDateType = (e) => {
    let val = e.target.value.replace(/\D/g, ''); 
    if (val.length > 8) val = val.slice(0, 8);
    let formatted = val;
    if (val.length >= 5) formatted = `${val.slice(0,2)}/${val.slice(2,4)}/${val.slice(4)}`;
    else if (val.length >= 3) formatted = `${val.slice(0,2)}/${val.slice(2)}`;
    setDisplayDate(formatted);
    if (val.length === 8) {
      const d = val.slice(0,2); const m = val.slice(2,4); const y = val.slice(4);
      setData(prev => ({...prev, recordDate: `${y}-${m}-${d}`}));
    }
  };

  const handleDateSelect = (e) => {
    const val = e.target.value;
    setData(prev => ({...prev, recordDate: val}));
    if (val) {
      const [y, m, d] = val.split('-');
      setDisplayDate(`${d}/${m}/${y}`);
    }
  };
  
  const [splitBill, setSplitBill] = useState(initialData ? (initialData.split !== 'none') : false);
  const [splitRatio, setSplitRatio] = useState(initialData?.splitRatio?.h || 50);

  const safeTravelCurrencies = settings.travelCurrencies || (settings.travelCurrency ? [{code: settings.travelCurrency, rate: settings.travelRate}] : []);
  const [currency, setCurrency] = useState('TWD');

  const [showK, setShowK] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [isOCR, setIsOCR] = useState(false);
  const fileInputRef = useRef(null);
  
  const evaluateMath = (str) => {
    try {
      if (!str) return '';
      const safeStr = str.replace(/×/g, '*').replace(/÷/g, '/');
      if (/^[0-9+\-*/.()]+$/.test(safeStr)) {
        const result = new Function(`return ${safeStr}`)();
        return isNaN(result) || !isFinite(result) ? str : String(Math.round(result * 100) / 100);
      }
      return str;
    } catch { return str; }
  };

  const handleKey = (k) => {
    if (k === '=') setData({...data, amount: evaluateMath(data.amount)});
    else if (k === 'C') setData({...data, amount: ''});
    else if (k === '⌫') setData({...data, amount: data.amount.slice(0, -1)});
    else setData({...data, amount: data.amount + k});
  };

  const submit = () => { 
    let finalAmount = Number(evaluateMath(data.amount));
    
    // 🌟 防呆：金額不得為 0 或不合法
    if (!finalAmount || finalAmount <= 0 || isNaN(finalAmount)) {
       alert("請輸入有效金額！");
       return;
    }

    if (settings.travelMode && currency !== 'TWD' && finalAmount > 0) {
      const c = safeTravelCurrencies.find(x => x.code === currency);
      if (c) {
        finalAmount = Math.round(finalAmount * c.rate);
        const cName = getCurrencyName(c.code);
        const amtStr = Number(evaluateMath(data.amount)).toFixed(2);
        data.note = `[${cName} ${c.code} ${amtStr}] ${data.note}`.trim();
      }
    }

    if (finalAmount > 0) {
      const acc = accounts.find(a => a.id === data.accountId);
      const autoPayer = acc ? acc.type : 'joint'; 
      let autoSplit = splitBill ? 'custom' : 'none';
      let payloadSplitRatio = splitBill ? { h: splitRatio, w: 100 - splitRatio } : null;

      onSave({...data, amount: finalAmount, payer: autoPayer, split: autoSplit, splitRatio: payloadSplitRatio}); 
    }
  };
  
  const handleAddNewTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      onAddTag(newTag.trim()); 
      setData(prev => ({ ...prev, tags: [...prev.tags, newTag.trim()] })); 
      setNewTag('');
    }
  };

  const handleSaveTemplate = () => {
    if (!data.amount || !data.category) return alert("請先填寫金額與分類！");
    const name = window.prompt("請為這個一鍵記帳範本命名 (例如：買咖啡)：");
    if (name) {
      const acc = accounts.find(a => a.id === data.accountId);
      const autoPayer = acc ? acc.type : 'joint';
      let autoSplit = splitBill ? 'custom' : 'none';
      let payloadSplitRatio = splitBill ? { h: splitRatio, w: 100 - splitRatio } : null;
      onSaveTemplate({ 
        name, 
        txData: { 
          ...data, 
          amount: Number(evaluateMath(data.amount)), 
          payer: autoPayer, 
          split: autoSplit, 
          splitRatio: payloadSplitRatio 
        } 
      });
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !apiKey) return alert("請先在程式碼最上方設定您的 Gemini API Key");
    
    setIsOCR(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = reader.result.split(',')[1];
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`;
        const options = {
          method: 'POST', 
          headers: { 
            'Content-Type': 'application/json',
            'X-goog-api-key': apiKey
          },
          body: JSON.stringify({
            contents: [{ parts: [
              { text: `請分析這張收據/發票，並回傳 JSON 格式。包含：amount (數字，總金額), note (字串，商店名稱或購買品項)。若無法辨識則留空。` },
              { inlineData: { mimeType: file.type, data: base64Data } }
            ]}],
            generationConfig: { responseMimeType: "application/json" }
          })
        };
        const resData = await fetchWithBackoff(url, options);
        if (resData.candidates) {
          const rawText = resData.candidates[0].content.parts[0].text;
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          const result = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
          setData(prev => ({ ...prev, amount: String(result.amount || prev.amount), note: result.note || prev.note }));
        }
        setIsOCR(false);
      };
    } catch (err) {
      console.error(err); 
      alert(`照片解析失敗: ${err.message}`); 
      setIsOCR(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent overflow-hidden">
      
      {/* 🌟 滾動表單區域 (獨立控制，完美與下方鍵盤隔離) */}
      <div className="flex-1 overflow-y-auto px-6 space-y-6 pb-6 hide-scrollbar relative">
        
        {/* 🌟 頂部一鍵範本 & AI 捷徑 */}
        <div className="flex justify-between items-center -mx-2 px-2 pt-2">
           <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
             <button onClick={handleSaveTemplate} className={`shrink-0 flex items-center justify-center gap-1.5 px-4 py-2 border border-dashed ${t.border} rounded-xl text-xs font-bold ${t.textM} hover:${t.primaryText} transition-all`}>
                <Save className="w-3.5 h-3.5" /> 存為範本
             </button>
             {templates.map(tpl => (
               <div key={tpl.id} className={`relative flex items-center shrink-0 ${t.bg} border ${t.border} rounded-xl pl-4 pr-9 py-2 shadow-sm group hover:shadow-md transition-all`}>
                  <span onClick={() => setData({ ...data, ...tpl.txData, amount: String(tpl.txData.amount) })} className={`font-bold text-sm cursor-pointer ${t.text}`}>
                    {tpl.name}
                  </span>
                  <button onClick={() => onDeleteTemplate(tpl.id)} className="absolute right-2.5 text-stone-400 hover:text-red-500 transition-colors p-0.5">
                    <X className="w-4 h-4" strokeWidth={3} />
                  </button>
               </div>
             ))}
           </div>
        </div>

        {!initialData && (
          <button onClick={onAI} className={`w-full py-4 rounded-2xl text-base font-bold flex justify-center items-center gap-2 ${t.primary} ${t.primaryBtnText} shadow-md active:scale-95 transition-all hover:brightness-110`}>
            <Wand2 className="w-5 h-5" /> AI 語音 / 文字智能記帳
          </button>
        )}
        
        <div className={`flex ${t.bg} p-1.5 rounded-2xl border ${t.border} shadow-inner`}>
          <button onClick={() => setData({...data, type:'expense', category:cats.expense[0]?.name})} className={`flex-1 py-3 font-bold text-sm rounded-xl transition-all ${data.type === 'expense' ? `${t.cardInner} shadow-md ${t.text}` : t.textM}`}>支出</button>
          <button onClick={() => setData({...data, type:'income', category:cats.income[0]?.name})} className={`flex-1 py-3 font-bold text-sm rounded-xl transition-all ${data.type === 'income' ? `${t.cardInner} shadow-md ${t.text}` : t.textM}`}>收入</button>
          <button onClick={() => setData({...data, type:'transfer', category:''})} className={`flex-1 py-3 font-bold text-sm rounded-xl transition-all ${data.type === 'transfer' ? `${t.cardInner} shadow-md ${t.text}` : t.textM}`}>轉帳</button>
        </div>
        
        {data.type === 'transfer' ? (
          <div className="flex flex-col gap-3 pt-2">
            <div className="space-y-2">
              <label className={`font-bold text-xs ${t.textM} px-1`}>從 (轉出)</label>
              <div className={`flex p-1.5 rounded-2xl border ${t.border} ${t.bg} overflow-x-auto hide-scrollbar gap-1 shadow-inner`}>
                 {accounts.map(a => <button key={`from-${a.id}`} onClick={() => setData({...data, fromAccountId: a.id})} className={`shrink-0 px-5 py-3 font-bold text-sm rounded-xl transition-all ${data.fromAccountId === a.id ? `${t.cardInner} shadow-md ${t.primaryText}` : t.textM}`}>{a.name}</button>)}
              </div>
            </div>
            <div className="flex justify-center -my-3 relative z-10"><div className={`p-1.5 rounded-full ${t.bg} border ${t.border} shadow-sm`}><ArrowDownIconSVG className={`w-5 h-5 ${t.textM}`} /></div></div>
            <div className="space-y-2">
              <label className={`font-bold text-xs ${t.textM} px-1`}>到 (轉入)</label>
              <div className={`flex p-1.5 rounded-2xl border ${t.border} ${t.bg} overflow-x-auto hide-scrollbar gap-1 shadow-inner`}>
                 {accounts.filter(a => a.id !== data.fromAccountId).map(a => <button key={`to-${a.id}`} onClick={() => setData({...data, toAccountId: a.id})} className={`shrink-0 px-5 py-3 font-bold text-sm rounded-xl transition-all ${data.toAccountId === a.id ? `${t.cardInner} shadow-md ${t.primaryText}` : t.textM}`}>{a.name}</button>)}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3 pt-2">
            {cats[data.type] && cats[data.type].map(c => (
              <button key={c.name} onClick={() => setData({...data, category: c.name})} className={`py-4 rounded-3xl border ${data.category === c.name ? t.primary + ' ' + t.primaryBtnText + ' border-transparent shadow-lg scale-105' : `${t.bg} ${t.border} shadow-sm hover:shadow-md`} flex flex-col items-center transition-all active:scale-95`}>
                <span className="text-3xl mb-2 drop-shadow-sm">{c.icon}</span><span className="text-xs font-bold">{c.name}</span>
              </button>
            ))}
          </div>
        )}

        {data.type !== 'transfer' && (
          <div className="space-y-2 pt-2">
            <label className={`font-bold text-xs ${t.textM} px-1`}>帳戶 (系統會自動判斷付款人)</label>
            <div className={`flex p-1.5 rounded-2xl border ${t.border} ${t.bg} overflow-x-auto hide-scrollbar gap-1 shadow-inner`}>
               {accounts.map(a => (
                 <button 
                   key={a.id} 
                   onClick={() => setData({...data, accountId: a.id})} 
                   className={`shrink-0 px-5 py-3 font-bold text-sm rounded-xl transition-all ${data.accountId === a.id ? `${t.cardInner} shadow-md ${t.primaryText}` : t.textM}`}
                 >
                   {a.name}
                 </button>
               ))}
            </div>
            
            {/* 🌟 彈性比例拆帳面板 */}
            {data.type === 'expense' && (
              <div className={`mt-4 px-5 py-5 rounded-[1.5rem] border ${t.border} ${t.bg} shadow-sm space-y-4`}>
                <div className="flex justify-between items-center">
                  <span className={`text-sm font-bold ${t.text}`}>這筆花費要平分嗎？</span>
                  <ToggleSwitch checked={splitBill} onChange={setSplitBill} isDark={ui.isDark} />
                </div>
                {splitBill && (
                  <div className={`pt-5 border-t ${t.border} space-y-4 animate-in fade-in slide-in-from-top-2`}>
                     <div className="flex justify-between text-sm font-black">
                       <span className={t.primaryText}>👨 老公負擔 {splitRatio}%</span>
                       <span className="text-pink-500">👩 老婆負擔 {100 - splitRatio}%</span>
                     </div>
                     <input 
                       type="range" 
                       min="0" 
                       max="100" 
                       step="5" 
                       value={splitRatio} 
                       onChange={e => setSplitRatio(Number(e.target.value))} 
                       className="w-full accent-indigo-500 cursor-pointer" 
                     />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* 🌟 日期與時間選擇器 */}
        <div className="flex gap-4 relative pt-2">
          <div className="flex-1 space-y-2 relative">
            <label className={`font-bold text-xs ${t.textM} px-1`}>日期</label>
            <div className="relative group">
              <div className={`flex items-center justify-between p-4 rounded-xl border ${t.border} ${t.bg} shadow-sm group-focus-within:ring-2 ${t.ring} transition-all`}>
                <div className="flex items-center gap-2">
                  <Calendar className={`w-5 h-5 ${t.textM}`} />
                  <span className={`font-bold text-sm ${displayDate ? t.text : t.textM}`}>{displayDate || 'DD/MM/YYYY'}</span>
                </div>
                <Calendar className={`w-4 h-4 ${t.textM} opacity-50`} />
              </div>
              <input type="date" value={data.recordDate} onChange={handleDateSelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            </div>
          </div>
          <div className="flex-1 space-y-2 relative">
            <label className={`font-bold text-xs ${t.textM} px-1`}>時間</label>
            <div className="relative group">
              <div className={`flex items-center justify-between p-4 rounded-xl border ${t.border} ${t.bg} shadow-sm group-focus-within:ring-2 ${t.ring} transition-all`}>
                <div className="flex items-center gap-2">
                  <CalendarClock className={`w-5 h-5 ${t.textM}`} />
                  <span className={`font-bold text-sm ${data.recordTime ? t.text : t.textM}`}>{data.recordTime || 'HH:mm'}</span>
                </div>
              </div>
              <input type="time" value={data.recordTime} onChange={e => setData({...data, recordTime: e.target.value})} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            </div>
          </div>
        </div>

        {/* 🌟 標籤雲橫向自動換行列 (完全美化版) */}
        <div className="space-y-2 -mx-6 px-6 pt-2">
          <label className={`font-bold text-xs ${t.textM} px-1`}>快速標籤</label>
          <div className="flex flex-wrap gap-2 pb-2">
             <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[1rem] ${t.bg} border ${t.border} shadow-inner shrink-0 focus-within:ring-2 ${t.ring} transition-all`}>
                <input value={newTag} onChange={e=>setNewTag(e.target.value)} placeholder="新標籤" className={`bg-transparent w-16 outline-none text-sm font-bold ${t.text} placeholder-${t.textM}`} />
                <button onClick={handleAddNewTag} disabled={!newTag.trim()} className={`text-white bg-indigo-500 rounded-full p-1 shadow-sm disabled:opacity-50 active:scale-95 transition-all`}><Plus size={14}/></button>
             </div>
             {tags.map(tg => (
                <button 
                  key={tg} 
                  onClick={() => setData(prev => ({...prev, tags: prev.tags.includes(tg) ? prev.tags.filter(x=>x!==tg) : [...prev.tags, tg]}))} 
                  className={`shrink-0 px-4 py-2.5 rounded-[1rem] text-xs font-bold transition-all ${data.tags.includes(tg) ? `${t.primary} ${t.primaryBtnText} shadow-md border-transparent` : `${t.bg} border ${t.border} ${t.textM} hover:shadow-md`}`}
                >
                  #{tg}
                </button>
             ))}
          </div>
        </div>

        {/* 🌟 無縫融合的備註與 OCR 相機 */}
        <div className="space-y-2 pb-4 pt-2">
           <label className={`font-bold text-xs ${t.textM} px-1`}>備註與收據掃描</label>
           <div className={`flex items-center p-1.5 rounded-2xl ${t.bg} border ${t.border} shadow-inner focus-within:ring-2 ${t.ring} transition-all`}>
              <input 
                 placeholder="這筆錢花在哪了..." 
                 value={data.note} 
                 onChange={e => setData({...data, note: e.target.value})}
                 className={`flex-1 bg-transparent px-4 py-3 outline-none font-bold text-base ${t.text}`}
              />
              <button 
                 onClick={() => fileInputRef.current.click()}
                 disabled={isOCR}
                 className={`p-3 rounded-[1rem] ${isOCR ? 'bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10' : `${t.cardInner} ${t.textM} border ${t.border} hover:text-indigo-500 hover:border-indigo-500/30`} shadow-sm active:scale-95 transition-all`}
              >
                 {isOCR ? <Loader2 className="animate-spin w-5 h-5"/> : <Camera className="w-5 h-5"/>}
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
           </div>
        </div>

        {/* 🌟 編輯模式的刪除按鈕 */}
        {initialData && (
           <div className="pt-2">
             <button onClick={(e) => { e.preventDefault(); onDeleteTx(initialData.id); }} className={`w-full py-4 rounded-[1.25rem] font-bold text-rose-500 ${ui.isDark ? 'bg-red-950/30 border-red-900/50 hover:bg-red-900/50' : 'bg-red-50 border-red-100 hover:bg-red-100'} active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm`}>
               <Trash2 className="w-5 h-5" /> 刪除這筆紀錄
             </button>
           </div>
        )}
      </div>
      
      {/* ======================================= */}
      {/* 🌟 底部沉浸式面板：無縫計算機與金額顯示 */}
      {/* ======================================= */}
      <div className={`shrink-0 ${t.cardInner} shadow-[0_-10px_40px_rgba(0,0,0,0.06)] border-t ${t.border} z-20 pb-safe transition-all duration-300 rounded-t-[2.5rem] mt-2`}>
        
        {/* iOS-style Pull Handle */}
        <div className="w-full flex justify-center pt-3 pb-1 cursor-pointer" onClick={() => setShowK(!showK)}>
            <div className={`w-12 h-1.5 rounded-full transition-colors ${ui.isDark ? 'bg-white/10' : 'bg-[#D4D4D8]'}`}></div>
        </div>

        {/* 🌟 旅遊外幣切換器 (若開啟) */}
        {settings.travelMode && data.type === 'expense' && safeTravelCurrencies.length > 0 && (
          <div className="flex gap-2 overflow-x-auto hide-scrollbar px-6 pt-2">
             <button 
               onClick={() => setCurrency('TWD')} 
               className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${currency === 'TWD' ? `${t.primary} ${t.primaryBtnText} shadow-sm` : `${t.bg} ${t.textM} border ${t.border}`}`}
             >
               台灣 (TWD)
             </button>
             {safeTravelCurrencies.map(c => {
               const label = `${getCurrencyName(c.code)} (${c.code})`;
               return (
                 <button 
                   key={c.code} 
                   onClick={() => setCurrency(c.code)} 
                   className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${currency === c.code ? `${t.primary} ${t.primaryBtnText} shadow-sm` : `${t.bg} ${t.textM} border ${t.border}`}`}
                 >
                   {label}
                 </button>
               )
             })}
          </div>
        )}

        {/* 🌟 金額橫幅 */}
        <div 
           className={`p-6 flex items-center justify-between cursor-pointer transition-colors border-b border-dashed ${ui.isDark ? 'border-white/5 hover:bg-white/5' : 'border-[#E4E4E7] hover:bg-stone-50/50'}`}
           onClick={() => !showK && setShowK(true)}
        >
           <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${t.bg} shadow-inner border ${t.border} ${showK ? 'text-indigo-500' : t.textM} transition-colors`}>
                 <Keyboard className="w-5 h-5" />
              </div>
              <span className={`font-bold text-sm ${currency !== 'TWD' ? t.primaryText : t.textM}`}>
                {currency !== 'TWD' ? `${getCurrencyName(currency)} (${currency})` : '台灣 (TWD)'}
              </span>
           </div>
           <span className={`text-[2.5rem] leading-none font-black tracking-tighter ${currency !== 'TWD' ? t.primaryText : t.text} truncate max-w-[200px] text-right drop-shadow-sm`}>
              {data.amount || '0'}
           </span>
        </div>

        {/* 🌟 沉浸式無縫鍵盤區 */}
        <div className={`transition-all duration-300 ease-in-out ${showK ? 'max-h-[350px] opacity-100 px-4 pb-4 pt-3' : 'max-h-0 opacity-0 overflow-hidden py-0 px-4 pt-0'}`}>
          <div className="grid grid-cols-4 gap-2">
            {['7','8','9','÷', '4','5','6','×', '1','2','3','-', 'C','0','.','+', '⌫','00','=','OK'].map((k, i) => {
              const isOp = ['÷','×','-','+','='].includes(k);
              const isC = k === 'C' || k === '⌫';
              let btnClass = '';
              if (ui.isDark) {
                if (isOp) btnClass = 'bg-black/20 text-rose-400 border border-white/5 hover:bg-black/40 shadow-sm'; 
                else if (isC) btnClass = 'bg-black/20 text-[#A1A1AA] border border-white/5 hover:bg-black/40 shadow-sm'; 
                else btnClass = 'bg-white/5 text-white shadow-sm hover:bg-white/10 border border-white/5'; 
              } else {
                if (isOp) btnClass = 'bg-stone-50 text-rose-500 border border-[#E4E4E7] hover:bg-stone-100 shadow-sm'; 
                else if (isC) btnClass = 'bg-stone-100 text-[#71717A] border border-[#E4E4E7] hover:bg-stone-200 shadow-sm'; 
                else btnClass = 'bg-white text-[#09090B] shadow-md border border-[#E4E4E7] hover:bg-stone-50'; 
              }
              return (
                <button 
                  key={i} 
                  onClick={(e) => { e.stopPropagation(); k === 'OK' ? submit() : handleKey(k); }} 
                  className={`h-[56px] sm:h-[64px] rounded-[1rem] font-black text-[22px] active:scale-95 transition-all duration-150 ${k === 'OK' ? `col-span-1 ${t.primary} ${t.primaryBtnText} shadow-lg hover:brightness-110` : btnClass}`}
                >
                  {k}
                </button>
              )
            })}
          </div>
        </div>

        {/* 🌟 鍵盤收合時，顯示單一確認按鈕 (無縫過渡) */}
        <div className={`px-5 transition-all duration-300 ease-in-out ${!showK ? 'max-h-[100px] opacity-100 pb-6 pt-3' : 'max-h-0 opacity-0 overflow-hidden py-0'}`}>
           <button onClick={submit} className={`w-full py-4 rounded-[1.25rem] font-black text-xl ${t.primaryBtnText} shadow-lg active:scale-95 transition-all hover:brightness-110 ${t.primary}`}>
             確認{initialData ? '修改' : '記帳'}
           </button>
        </div>

      </div>
    </div>
  );
};

// ==========================================
// 🌟 AI 語音記帳表單
// ==========================================
const AIForm = ({ cats, accounts, onBack, onSave, showToast, t, ui }) => {
  const [text, setText] = useState(''); 
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'zh-TW';
      recognitionRef.current.interimResults = false;
      recognitionRef.current.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        setText(prev => prev ? `${prev} ${transcript}` : transcript);
      };
      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onerror = () => setIsListening(false);
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return showToast("您的瀏覽器不支援語音功能，請用打字的", "error");
    if (isListening) recognitionRef.current.stop();
    else { recognitionRef.current.start(); setIsListening(true); }
  };
  
  // 🌟 還原為原本的 AI API 設定
  const handleParse = async () => {
    if (!apiKey) return showToast("請先在程式碼最上方設定您的 Gemini API Key", "error");
    if (!text.trim()) return; 
    setLoading(true);
    try {
       const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`;
       const options = {
          method: 'POST', 
          headers: { 
            'Content-Type': 'application/json',
            'X-goog-api-key': apiKey
          },
          body: JSON.stringify({ 
            contents: [{ parts: [{ text: `請將以下語言記帳轉換為JSON。語言：「${text}」。這是家庭帳本。必填欄位：amount(數字), category(從[${cats?.expense?.map(c=>c.name).join(',')}]選), type('expense'/'income'/'transfer'), accountId(請挑選最合理的帳戶 ID: [${accounts.map(a=>`${a.name}:${a.id}`).join(',')}]), note(備註)。若無法判斷則填預設值。` }] }]
          })
       };

       const resData = await fetchWithBackoff(url, options);
       if(!resData || !resData.candidates) throw new Error("API 回傳異常，請再試一次");
       
       const rawText = resData.candidates[0].content.parts[0].text;
       const jsonMatch = rawText.match(/\{[\s\S]*\}/);
       const result = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
       
       const acc = accounts.find(a => a.id === result.accountId) || accounts[0];
       const autoPayer = acc ? acc.type : 'joint';
       const autoSplit = 'none';

       onSave({ 
         amount: result.amount || 0, category: result.category || cats?.expense?.[0]?.name, type: result.type || 'expense', 
         accountId: acc.id, payer: autoPayer, split: autoSplit, splitRatio: null, note: result.note || '', tags: ['AI記帳'],
         recordDate: getLocalYYYYMMDD(new Date()), recordTime: getLocalHHmm(new Date())
       });
    } catch (e) { showToast(`AI 解析失敗: ${e.message}`, "error"); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4 flex flex-col h-full pb-8">
      <button onClick={onBack} className={`text-sm font-bold ${t.textM} mb-2 flex items-center gap-1.5 shrink-0 hover:text-indigo-500 transition-colors`}><ChevronLeft className="w-4 h-4"/> 返回手動記帳</button>
      <div className="relative flex-1">
        <textarea 
          value={text} 
          onChange={e => setText(e.target.value)} 
          placeholder="點擊右下角麥克風說話，例如：「昨天去全聯買便當花了 200，老婆付的...」" 
          className={`w-full h-full p-6 rounded-[2rem] font-bold text-xl resize-none focus:ring-2 ${t.ring} ${t.bg} border ${t.border} outline-none shadow-inner transition-all`} 
        />
        <button 
          onClick={toggleListening} 
          className={`absolute bottom-6 right-6 p-5 rounded-full shadow-[0_10px_25px_rgba(0,0,0,0.15)] transition-all ${isListening ? 'bg-rose-500 text-white animate-pulse scale-110' : `${t.primary} ${t.primaryBtnText} hover:scale-105 active:scale-95`}`}
        >
          {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
        </button>
      </div>
      <button 
        onClick={handleParse} 
        disabled={loading || !text} 
        className={`w-full py-5 rounded-2xl font-black text-xl ${t.primary} ${t.primaryBtnText} flex justify-center items-center gap-2 mt-3 shrink-0 shadow-lg disabled:opacity-50 active:scale-95 transition-all hover:brightness-110`}
      >
        {loading ? <Loader2 className="animate-spin w-6 h-6"/> : <Sparkles className="w-6 h-6"/>} 交給 AI 自動解析
      </button>
    </div>
  );
};

// ==========================================
// 🌟 自訂分類管理表單 CategoryForm
// ==========================================
const CategoryForm = ({ categories, onSave, t }) => {
  const [cats, setCats] = useState({ 
     expense: [...categories.expense], 
     income: [...categories.income] 
  });
  const [tab, setTab] = useState('expense');
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('✨');
  
  const handleAdd = () => {
    if (!newName.trim() || cats[tab].find(c => c.name === newName.trim())) return alert("分類名稱不能重複或空白！");
    const newCategory = { name: newName.trim(), icon: newIcon, color: '#A3B18A' };
    setCats(prev => ({ ...prev, [tab]: [...prev[tab], newCategory] }));
    setNewName('');
  };

  const handleRemove = (name) => {
    setCats(prev => ({ ...prev, [tab]: prev[tab].filter(c => c.name !== name) }));
  };

  return (
    <div className="space-y-6 flex flex-col h-full pb-8 pt-4">
       <div className={`flex p-1.5 rounded-2xl border ${t.border} ${t.bg} shadow-sm`}>
         <button onClick={() => setTab('expense')} className={`flex-1 py-3 font-bold text-sm rounded-xl transition-all ${tab === 'expense' ? `${t.cardInner} shadow-md ${t.text}` : t.textM}`}>支出分類</button>
         <button onClick={() => setTab('income')} className={`flex-1 py-3 font-bold text-sm rounded-xl transition-all ${tab === 'income' ? `${t.cardInner} shadow-md ${t.text}` : t.textM}`}>收入分類</button>
       </div>
       
       <div className={`p-5 rounded-3xl border ${t.border} ${t.bg} space-y-4 shadow-sm`}>
         <label className={`font-bold text-sm ${t.textM} px-1`}>新增分類</label>
         <div className="flex gap-3">
            <input 
               value={newIcon} 
               onChange={e => setNewIcon(e.target.value)} 
               maxLength={2}
               className={`w-16 p-4 rounded-xl font-bold text-center text-2xl ${t.cardInner} border ${t.border} outline-none focus:ring-2 ${t.ring} shadow-sm`} 
            />
            <input 
               value={newName} 
               onChange={e => setNewName(e.target.value)} 
               placeholder="分類名稱"
               className={`flex-1 p-4 rounded-xl font-bold text-base ${t.cardInner} border ${t.border} outline-none focus:ring-2 ${t.ring} shadow-sm`} 
            />
            <button onClick={handleAdd} disabled={!newName} className={`px-6 rounded-xl font-bold ${t.primaryBtnText} shadow-md disabled:opacity-50 active:scale-95 transition-all ${t.primary}`}><Plus className="w-6 h-6"/></button>
         </div>
       </div>

       <div className="flex-1 overflow-y-auto hide-scrollbar pt-2">
         <div className="grid grid-cols-2 gap-3">
           {cats[tab].map(c => (
             <div key={c.name} className={`flex items-center justify-between p-4 rounded-2xl border ${t.border} ${t.cardInner} shadow-sm hover:shadow-md transition-shadow group`}>
                <div className="flex items-center gap-3">
                   <span className="text-2xl drop-shadow-sm">{c.icon}</span>
                   <span className="font-bold text-sm group-hover:text-indigo-500 transition-colors">{c.name}</span>
                </div>
                <Trash2 onClick={() => handleRemove(c.name)} className="w-5 h-5 text-stone-400 hover:text-red-500 cursor-pointer transition-colors" />
             </div>
           ))}
         </div>
       </div>

       <button onClick={() => onSave(cats)} className={`w-full py-5 rounded-[1.5rem] font-bold text-lg ${t.primaryBtnText} shadow-lg mt-auto active:scale-95 transition-all hover:brightness-110 ${t.primary}`}>
          儲存分類設定
       </button>
    </div>
  );
};

// ==========================================
// 高質感設定表單 (旗艦升級：外幣下拉智慧選單)
// ==========================================
const SettingsForm = ({ settings, onSave, onExport, onRecurring, onCategories, t }) => {
  const [s, setS] = useState(settings);
  const [newCurr, setNewCurr] = useState('');
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const isDark = t.bg.includes('16') || t.bg.includes('0B'); 

  // 🌟 智慧外幣下拉自動抓取
  const handleAddCurrency = async () => {
    let targetCurrency = newCurr.trim().toUpperCase();
    if (!targetCurrency) return;
    
    // 智慧辨識中文或簡稱
    const currencyMap = {
      '日': 'JPY', 'jpy': 'JPY', '韓': 'KRW', 'krw': 'KRW', '美': 'USD', 'usd': 'USD', '歐': 'EUR', 'eur': 'EUR',
      '港': 'HKD', 'hkd': 'HKD', '泰': 'THB', 'thb': 'THB', '英': 'GBP', 'gbp': 'GBP', '澳': 'AUD', 'aud': 'AUD',
      '加': 'CAD', 'cad': 'CAD', '新': 'SGD', 'sgd': 'SGD', '馬': 'MYR', 'myr': 'MYR', '越': 'VND', 'vnd': 'VND',
      '印尼': 'IDR', 'idr': 'IDR', '人民幣': 'CNY', '中': 'CNY', 'cny': 'CNY', 'rmb': 'CNY',
      '阿': 'AED', '阿聯酋': 'AED', '杜拜': 'AED', 'aed': 'AED'
    };
    
    for (const [key, value] of Object.entries(currencyMap)) { 
      if (targetCurrency.includes(key)) { 
        targetCurrency = value; 
        break; 
      } 
    }
    
    if (targetCurrency.length !== 3) return alert("請輸入正確的國家關鍵字或 3 碼幣別 (例如: 杜拜 或 JPY)");
    
    // 檢查是否已存在
    const currentList = s.travelCurrencies || [];
    if (currentList.find(x => x.code === targetCurrency)) return alert(`${targetCurrency} 已經在列表裡囉！`);

    setIsFetchingRate(true);
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${targetCurrency}`);
      const data = await res.json();
      if (data.result === 'success' && data.rates.TWD) {
        const rate = Number(data.rates.TWD.toFixed(4));
        setS(prev => ({...prev, travelCurrencies: [...(prev.travelCurrencies||[]), {code: targetCurrency, rate}]}));
        setNewCurr('');
        alert(`自動抓取匯率成功！\n1 ${targetCurrency} = ${rate} TWD\n(您仍可手動微調匯率)`);
      } else alert("找不到該幣別匯率，請檢查代碼是否正確");
    } catch (e) { alert("抓取匯率失敗，請檢查網路"); }
    setIsFetchingRate(false);
  };

  const handleRefreshAllRates = async () => {
    if (!s.travelCurrencies || s.travelCurrencies.length === 0) return;
    setIsFetchingRate(true);
    let updatedCount = 0;
    const newArr = [...s.travelCurrencies];
    
    for (let i = 0; i < newArr.length; i++) {
      try {
        const res = await fetch(`https://open.er-api.com/v6/latest/${newArr[i].code}`);
        const data = await res.json();
        if (data.result === 'success' && data.rates.TWD) {
          newArr[i].rate = Number(data.rates.TWD.toFixed(4));
          updatedCount++;
        }
      } catch (e) {}
    }
    
    if (updatedCount > 0) {
      setS(prev => ({...prev, travelCurrencies: newArr}));
      alert(`已為您自動更新 ${updatedCount} 個外幣的最新匯率！`);
    } else {
      alert("匯率更新失敗，請稍後再試。");
    }
    setIsFetchingRate(false);
  };

  const handleRemoveCurrency = (code) => {
    setS(prev => ({...prev, travelCurrencies: (prev.travelCurrencies||[]).filter(x => x.code !== code)}));
  };

  return (
    <div className="space-y-4 pb-6 pt-4">
      <div className={`${t.bg} rounded-3xl p-5 border ${t.border} shadow-sm space-y-4`}>
         <div className="flex justify-between items-center">
           <span className={`font-bold text-sm ${t.text}`}>系統字體大小</span>
           <div className={`flex p-1 rounded-xl border ${t.border} ${t.cardInner} shadow-inner`}>
             {['sm:小', 'md:標準', 'lg:大'].map(size => {
               const [k, l] = size.split(':');
               return <button key={k} onClick={() => setS({...s, uiFontSize: k})} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${s.uiFontSize === k ? `${t.bg} shadow-md ${t.primaryText}` : t.textM}`}>{l}</button>;
             })}
           </div>
         </div>
      </div>

      {/* ✈️ 旅遊多幣別模式 (陣列版 + API 下拉選單) */}
      <div className={`${t.bg} rounded-3xl p-5 border ${t.border} shadow-sm space-y-4`}>
         <div className="flex justify-between items-center">
           <h4 className={`font-bold text-base flex items-center gap-2 ${s.travelMode ? t.primaryText : t.text}`}><Globe className="w-5 h-5"/> 多點跨國旅行模式</h4>
           <ToggleSwitch checked={s.travelMode} onChange={val => setS({...s, travelMode: val})} isDark={isDark} />
         </div>
         {s.travelMode && (
           <div className={`space-y-4 pt-4 border-t ${t.border} animate-in fade-in`}>
             <div className="flex gap-2">
               {/* 🌟 改用 input + datalist 讓使用者可自由輸入國家名稱或選擇 */}
               <input 
                 list="currency-options"
                 value={newCurr} 
                 onChange={e => setNewCurr(e.target.value)} 
                 className={`flex-1 ${t.cardInner} p-4 rounded-xl font-bold text-sm border ${t.border} outline-none focus:ring-2 ${t.ring} shadow-inner transition-all`}
                 placeholder="輸入國家或選擇幣別..."
               />
               <datalist id="currency-options">
                 {POPULAR_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
               </datalist>
               <button 
                 onClick={handleAddCurrency} 
                 disabled={!newCurr || isFetchingRate} 
                 className={`w-14 rounded-xl text-sm font-bold ${t.primaryBtnText} ${t.primary} active:scale-95 shadow-md flex items-center justify-center disabled:opacity-50 transition-all hover:brightness-110`}
               >
                 {isFetchingRate ? <Loader2 className="animate-spin w-5 h-5"/> : <Plus className="w-6 h-6"/>}
               </button>
             </div>
             
             <div className="space-y-2 relative">
               {(s.travelCurrencies || []).length > 0 && (
                 <div className="flex justify-end mb-2">
                   <button onClick={handleRefreshAllRates} disabled={isFetchingRate} className={`text-xs font-bold ${t.primaryText} flex items-center gap-1 hover:underline disabled:opacity-50`}>
                     <RefreshCw className={`w-3.5 h-3.5 ${isFetchingRate ? 'animate-spin' : ''}`} /> 一鍵更新最新匯率
                   </button>
                 </div>
               )}

               {(s.travelCurrencies || []).map(c => (
                 <div key={c.code} className={`flex justify-between items-center p-3.5 rounded-2xl ${t.cardInner} border ${t.border} shadow-sm hover:shadow-md transition-all`}>
                   <span className={`font-black text-sm ${t.primaryText} w-24 truncate`}>{getCurrencyLabel(c.code)}</span>
                   <div className="flex items-center gap-2">
                     <span className={`text-xs ${t.textM}`}>對台幣</span>
                     <input 
                       type="number" 
                       step="0.01" 
                       value={c.rate} 
                       onChange={e => {
                          const newArr = s.travelCurrencies.map(x => x.code === c.code ? {...x, rate: Number(e.target.value)} : x);
                          setS({...s, travelCurrencies: newArr});
                       }} 
                       className={`w-24 ${t.bg} p-2 rounded-xl font-bold text-center border ${t.border} outline-none shadow-inner ${t.primaryText}`} 
                     />
                   </div>
                   <button onClick={() => handleRemoveCurrency(c.code)} className={`text-stone-400 hover:text-red-500 transition-colors p-1`}><Trash2 className="w-4 h-4"/></button>
                 </div>
               ))}
               {(s.travelCurrencies || []).length === 0 && <p className={`text-center text-xs font-bold ${t.textM} py-4 bg-black/5 dark:bg-white/5 rounded-xl`}>尚未加入任何外幣</p>}
             </div>
           </div>
         )}
      </div>

      <div className={`${t.bg} rounded-3xl p-5 border ${t.border} shadow-sm space-y-4`}>
         <h4 className={`font-bold text-sm ${t.textM} mb-2`}>家庭總預算</h4>
         <div className={`flex items-center gap-3 ${t.cardInner} rounded-2xl p-4 shadow-inner border ${t.border}`}>
           <span className={`font-bold text-xl ${t.textM}`}>$</span>
           <input 
             type="number" 
             value={s.monthlyBudget} 
             onChange={e => setS({...s, monthlyBudget: Number(e.target.value)})} 
             className={`w-full bg-transparent font-bold text-2xl border-none outline-none ${t.text}`} 
           />
         </div>
         <div className={`flex justify-between items-center pt-2`}>
           <span className={`font-bold text-sm ${t.text}`}>預算結轉機制</span>
           <ToggleSwitch checked={s.enableRollover} onChange={val => setS({...s, enableRollover: val})} isDark={isDark} />
         </div>
      </div>

      <div className={`${t.bg} rounded-3xl p-5 border ${t.border} shadow-sm`}>
         <h4 className={`font-bold text-sm ${t.textM} mb-4 flex items-center gap-2`}><Bell className="w-4 h-4"/>推播與通知中心</h4>
         <div className={`space-y-5 pb-5 border-b ${t.border}`}>
           <div className="flex justify-between items-center">
             <span className={`font-bold text-sm ${t.text}`}>大額消費防護網</span>
             <ToggleSwitch checked={s.notifyLargeExpense} onChange={val => setS({...s, notifyLargeExpense: val})} isDark={isDark} />
           </div>
           {s.notifyLargeExpense && (
             <div className={`flex items-center gap-3 ${t.cardInner} p-4 rounded-2xl shadow-inner border ${t.border} animate-in fade-in`}>
               <span className={`text-xs ${t.textM} font-bold px-1`}>觸發金額大於 $</span>
               <input 
                 type="number" 
                 value={s.largeExpenseThreshold} 
                 onChange={e => setS({...s, largeExpenseThreshold: Number(e.target.value)})} 
                 className={`flex-1 bg-transparent font-bold text-base border-none outline-none ${t.text}`} 
               />
             </div>
           )}
         </div>
         <div className="space-y-5 pt-5">
           <div className="flex justify-between items-center">
             <span className={`font-bold text-sm ${t.text}`}>帳單到期提醒</span>
             <ToggleSwitch checked={s.notifyBillDue} onChange={val => setS({...s, notifyBillDue: val, notifyEvents: val})} isDark={isDark} />
           </div>
           <div className="flex justify-between items-center">
             <span className={`font-bold text-sm ${t.text}`}>紀念日提前提醒</span>
             <ToggleSwitch checked={s.notifyEvents} onChange={val => setS({...s, notifyEvents: val})} isDark={isDark} />
           </div>
           {s.notifyEvents && (
             <div className={`flex items-center justify-between ${t.cardInner} p-3 rounded-2xl shadow-inner border ${t.border} animate-in fade-in`}>
               <span className={`text-xs ${t.textM} font-bold px-2`}>提前幾天提醒？</span>
               <div className="flex items-center gap-2">
                 <input 
                   type="number" 
                   value={s.notifyAdvanceDays || 3} 
                   onChange={e => setS({...s, notifyAdvanceDays: Number(e.target.value)})} 
                   className={`w-16 ${t.bg} p-2 rounded-xl font-bold text-base border ${t.border} text-center outline-none`} 
                 />
                 <span className={`text-xs ${t.textM} font-bold pr-2`}>天</span>
               </div>
             </div>
           )}
         </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <button 
          onClick={onCategories} 
          className={`w-full py-4 rounded-2xl border ${t.border} ${t.bg} font-bold text-sm flex flex-col justify-center items-center gap-2 ${t.text} shadow-sm active:scale-95 transition-all hover:shadow-md hover:border-indigo-500/30`}
        >
          <List className={`w-6 h-6 ${t.textM}`} />
          自訂分類
        </button>

        <button 
          onClick={onRecurring} 
          className={`w-full py-4 rounded-2xl border ${t.border} ${t.bg} font-bold text-sm flex flex-col justify-center items-center gap-2 ${t.text} shadow-sm active:scale-95 transition-all hover:shadow-md hover:border-indigo-500/30`}
        >
          <Repeat className={`w-6 h-6 ${t.textM}`} />
          週期記帳
        </button>
      </div>

      <button 
        onClick={() => onSave(s)} 
        className={`w-full py-5 rounded-[1.5rem] font-bold text-lg ${t.primaryBtnText} mt-4 shadow-lg ${t.primary} active:scale-95 transition-all hover:brightness-110`}
      >
        儲存設定
      </button>
      
      <button 
        onClick={onExport} 
        className={`w-full py-5 rounded-[1.5rem] font-bold text-base border ${t.border} mt-2 shadow-sm flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 ${t.bg} active:scale-95 transition-all hover:bg-black/5 dark:hover:bg-white/5 hover:border-emerald-500/30`}
      >
        <DownloadCloud className="w-5 h-5"/> 匯出 CSV 報表
      </button>
    </div>
  );
};

const BarcodeDisplay = ({ code, t }) => {
  const safeCode = code ? encodeURIComponent(code) : '';
  const barcodeUrl = safeCode ? `https://bwipjs-api.metafloor.com/?bcid=code39&text=${safeCode}&scale=3&height=12&includetext=false` : null;
  return (
    <div className="mb-4">
      <div className={`bg-white border-2 border-stone-200 rounded-3xl p-6 flex flex-col items-center justify-center shadow-sm min-h-[140px] relative overflow-hidden`}>
         {barcodeUrl ? (
           <img src={barcodeUrl} alt="Barcode" className="w-full h-24 object-contain mb-4 mix-blend-multiply relative z-10" />
         ) : (
           <div className="flex gap-1.5 h-16 mb-4 w-full justify-center opacity-30 relative z-10">
             {[1,0,1,1,0,1,0,0,1,1,1,0,1,0,1,1,0,0,1,0,1,1].map((v,i) => <div key={i} className={`w-1.5 h-full ${v ? 'bg-[#2A2623]' : 'bg-transparent'}`}></div>)}
           </div>
         )}
         <span className="font-mono font-black text-2xl text-[#2A2623] tracking-[0.2em] relative z-10">{code || '尚未設定'}</span>
         <div className="absolute inset-0 bg-gradient-to-b from-transparent to-stone-50/50 pointer-events-none"></div>
      </div>
    </div>
  );
};

const BarcodeForm = ({ codes, onSave, t }) => {
  const [tab, setTab] = useState('h');
  const [h, setH] = useState(codes.h || ''); 
  const [w, setW] = useState(codes.w || ''); 
  const [mode, setMode] = useState('view'); 
  return (
    <div className="space-y-5 pb-8 pt-4">
      <div className={`flex ${t.bg} p-1.5 rounded-2xl shadow-sm`}>
        <button onClick={() => setTab('h')} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${tab === 'h' ? `${t.cardInner} shadow-md ${t.text}` : t.textM}`}>👨 老公</button>
        <button onClick={() => setTab('w')} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${tab === 'w' ? `${t.cardInner} shadow-md ${t.text}` : t.textM}`}>👩 老婆</button>
      </div>
      {mode === 'view' ? (
        <div className={`p-6 rounded-[2rem] ${t.bg} border ${t.border} space-y-6 shadow-sm`}>
          <BarcodeDisplay code={tab === 'h' ? h : w} t={t} />
          <button onClick={() => setMode('edit')} className={`w-full py-4 rounded-[1.25rem] font-bold text-sm border ${t.border} ${t.cardInner} ${t.text} shadow-sm active:scale-95 transition-all hover:border-indigo-500/30`}>設定 / 修改條碼</button>
        </div>
      ) : (
        <div className={`p-6 rounded-[2rem] ${t.bg} border ${t.border} space-y-6 shadow-sm`}>
          <div className="space-y-2">
            <label className={`text-xs font-bold ${t.textM} px-1`}>{tab === 'h' ? '老公' : '老婆'} 手機條碼</label>
            <input value={tab === 'h' ? h : w} onChange={e => tab === 'h' ? setH(e.target.value.toUpperCase()) : setW(e.target.value.toUpperCase())} className={`w-full p-4 rounded-xl uppercase font-mono text-lg font-bold ${t.cardInner} border ${t.border} shadow-inner outline-none focus:ring-2 ${t.ring} transition-all`} placeholder="/..." />
          </div>
          <button onClick={() => { onSave(h, w); setMode('view'); }} className={`w-full py-4 rounded-[1.25rem] font-bold text-base ${t.primaryBtnText} shadow-md ${t.primary} mt-2 active:scale-95 transition-all hover:brightness-110`}>儲存設定</button>
        </div>
      )}
    </div>
  );
};

const RecurringForm = ({ rules, accounts, cats, onSave, onDelete, t }) => {
  const [view, setView] = useState('list');
  const [step, setStep] = useState(1);
  const [r, setR] = useState({ 
    name: '', frequency: 'monthly', interval: 1, 
    txData: { type: 'expense', category: cats.expense[0].name, accountId: accounts[0]?.id||'', amount: '', note: '' } 
  });

  if (view === 'list') return (
    <div className="space-y-5 h-full flex flex-col pb-8 pt-4">
      <button onClick={() => setView('add')} className={`w-full py-5 rounded-2xl border-2 border-dashed ${t.border} ${t.textM} font-bold text-base flex justify-center items-center gap-2 hover:border-indigo-500 hover:text-indigo-500 transition-colors active:scale-95`}>
        + 新增自動記帳規則
      </button>
      <div className="flex-1 overflow-y-auto space-y-4 scrollbar-hide">
        {rules.length === 0 ? <div className={`text-center py-16 text-sm ${t.textM} font-bold border ${t.border} rounded-[2rem] ${t.bg} shadow-sm`}>尚無自動記帳規則</div> : rules.map(rule => (
          <div key={rule.id} className={`p-5 rounded-3xl border ${t.border} ${t.cardInner} flex justify-between items-center relative shadow-sm hover:shadow-md transition-shadow`}>
            <div>
              <h4 className="font-extrabold text-base">{rule.name}</h4>
              <p className={`text-xs font-bold ${t.textM} mt-1.5`}>每 {rule.interval} {rule.frequency === 'monthly' ? '個月' : '週'}</p>
            </div>
            <div className="text-right pr-8">
              <span className="font-black text-xl drop-shadow-sm">${rule.txData.amount}</span>
              <p className={`text-xs font-bold ${t.textM} mt-1`}>{rule.txData.type === 'transfer' ? '轉帳' : rule.txData.category}</p>
            </div>
            <button onClick={() => onDelete(rule.id)} className={`absolute top-5 right-4 ${t.textM} hover:text-red-500 p-1 transition-colors`}>
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-5 h-full flex flex-col pb-8 pt-2">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => { setView('list'); setStep(1); }} className={`p-2.5 rounded-full border ${t.border} active:scale-95 transition-all hover:shadow-sm`}><ChevronLeft className={`w-5 h-5 ${t.textM}`}/></button>
        <span className="font-bold text-base">步驟 {step}/3: {step === 1 ? '基本設定' : step === 2 ? '記帳內容' : '確認規則'}</span>
      </div>
      {step === 1 && (
        <div className="space-y-6 flex-1 animate-in slide-in-from-right-2">
          <input value={r.name} onChange={e => setR({ ...r, name: e.target.value })} placeholder="規則名稱 (如: 每月房租)" className={`w-full p-5 rounded-2xl font-bold text-xl ${t.bg} border ${t.border} shadow-inner outline-none focus:ring-2 ${t.ring} transition-all`} />
          <div className="space-y-3">
            <label className={`font-bold text-sm ${t.textM} px-1`}>多久發生一次？</label>
            <div className="flex gap-4 items-center">
              <span className="font-bold text-lg px-2">每</span>
              <input type="number" min="1" value={r.interval} onChange={e => setR({ ...r, interval: Number(e.target.value) })} className={`w-24 p-4 rounded-xl font-bold text-xl text-center ${t.bg} border ${t.border} shadow-inner outline-none focus:ring-2 ${t.ring} transition-all`} />
              <div className={`flex p-1.5 rounded-2xl border ${t.border} ${t.bg} flex-1 shadow-sm`}>
                {['monthly:個月', 'weekly:週'].map(i => { 
                  const [k, l] = i.split(':'); 
                  return <button key={k} onClick={() => setR({ ...r, frequency: k })} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${r.frequency === k ? `${t.cardInner} shadow-md ${t.primaryText}` : t.textM}`}>{l}</button> 
                })}
              </div>
            </div>
          </div>
          <button onClick={() => setStep(2)} disabled={!r.name} className={`w-full py-5 rounded-2xl font-bold text-lg ${t.primary} ${t.primaryBtnText} shadow-md disabled:opacity-50 mt-auto active:scale-95 transition-all`}>下一步</button>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-5 flex-1 flex flex-col animate-in slide-in-from-right-2">
          <p className={`font-bold text-xs ${t.textM} px-1`}>設定時間到了要自動記下的內容：</p>
          <TxForm accounts={accounts} cats={cats} tags={[]} initialData={null} templates={[]} settings={{}} onAI={()=>{}} onAddTag={()=>{}} onSaveTemplate={()=>{}} onDeleteTemplate={()=>{}} onSave={(txData) => { setR({ ...r, txData }); setStep(3); }} t={t} ui={{isDark: t.bg.includes('16') || t.bg.includes('0B')}} />
        </div>
      )}
      {step === 3 && (
        <div className="space-y-6 text-center flex-1 flex flex-col justify-center items-center animate-in zoom-in-95">
          <Repeat className={`w-20 h-20 mb-4 ${t.primaryText} opacity-80`} />
          <h3 className="font-black text-3xl mb-4">確認建立規則？</h3>
          <div className={`p-6 rounded-[2rem] border ${t.border} ${t.bg} w-full text-left space-y-4 shadow-sm`}>
            <p className="flex justify-between items-center"><span className={`text-sm ${t.textM} font-bold`}>名稱：</span><span className="font-black text-lg">{r.name}</span></p>
            <p className="flex justify-between items-center"><span className={`text-sm ${t.textM} font-bold`}>頻率：</span><span className="font-bold text-base bg-indigo-500/10 text-indigo-500 px-3 py-1 rounded-lg">每 {r.interval} {r.frequency === 'monthly' ? '個月' : '週'}</span></p>
            <hr className={t.border} />
            <p className="flex justify-between items-center"><span className={`text-sm ${t.textM} font-bold`}>內容：</span><span className="font-black text-2xl drop-shadow-sm">{r.txData.type === 'transfer' ? '轉帳' : r.txData.category} ${r.txData.amount}</span></p>
          </div>
          <button onClick={() => { onSave({ ...r, nextDueDate: new Date(), createdAt: serverTimestamp() }); setView('list'); }} className={`w-full py-5 rounded-2xl font-black text-lg ${t.primary} ${t.primaryBtnText} shadow-lg mt-auto active:scale-95 transition-all hover:brightness-110`}>確認建立</button>
        </div>
      )}
    </div>
  );
};

const AccForm = ({ onSave, t }) => {
  const [n, setN] = useState(''); 
  const [i, setI] = useState('🏦');
  
  return (
    <div className="space-y-6 pb-8 pt-4">
      <div className="space-y-2">
        <label className={`text-xs font-bold ${t.textM} px-2`}>帳戶名稱</label>
        <input 
          value={n} 
          onChange={e => setN(e.target.value)} 
          placeholder="例如：中信戶頭" 
          className={`w-full p-4 rounded-xl font-bold text-base ${t.bg} border ${t.border} outline-none focus:ring-2 ${t.ring} shadow-inner transition-all`} 
        />
      </div>
      <div className="space-y-2">
        <label className={`text-xs font-bold ${t.textM} px-2`}>帳戶圖示</label>
        <div className="flex gap-2 text-3xl overflow-x-auto py-2 hide-scrollbar">
          {['🏦','💳','💼','💎', '🐖', '🪙', '📈', '🏠'].map(x => (
            <button 
              key={x} 
              onClick={() => setI(x)} 
              className={`p-4 border rounded-2xl shrink-0 transition-all ${i === x ? `${t.primaryText} ${t.bg} border-transparent shadow-md scale-105` : `${t.border} ${t.cardInner} hover:bg-stone-50 dark:hover:bg-slate-800`}`}
            >
              {x}
            </button>
          ))}
        </div>
      </div>
      <button 
        onClick={() => onSave({name:n, type:'joint', icon:i, balance:0})} 
        disabled={!n} 
        className={`w-full py-5 rounded-[1.5rem] font-bold text-lg ${t.primaryBtnText} shadow-lg ${t.primary} disabled:opacity-50 mt-4 active:scale-95 transition-all hover:brightness-110`}
      >
        建立帳戶
      </button>
    </div>
  );
};

const BillForm = ({ onSave, t }) => {
  const [n, setN] = useState(''); 
  const [a, setA] = useState(''); 
  const [d, setD] = useState(1);
  
  return (
    <div className="space-y-5 pb-8 pt-4">
      <div className="space-y-2">
         <label className={`text-xs font-bold ${t.textM} px-2`}>帳單名稱</label>
         <input 
           value={n} 
           onChange={e => setN(e.target.value)} 
           placeholder="例如: 手機費" 
           className={`w-full p-4 rounded-xl font-bold text-base ${t.bg} border ${t.border} shadow-inner outline-none focus:ring-2 ${t.ring} transition-all`} 
         />
      </div>
      <div className="flex gap-4">
        <div className="flex-1 space-y-2">
          <label className={`text-xs font-bold ${t.textM} px-2`}>金額</label>
          <input 
            type="number" 
            value={a} 
            onChange={e => setA(e.target.value)} 
            placeholder="0" 
            className={`w-full p-4 rounded-xl font-bold text-base ${t.bg} border ${t.border} shadow-inner outline-none focus:ring-2 ${t.ring} transition-all`} 
          />
        </div>
        <div className="flex-1 space-y-2">
          <label className={`text-xs font-bold ${t.textM} px-2`}>每月幾號繳？</label>
          <input 
            type="number" 
            min="1" 
            max="31" 
            value={d} 
            onChange={e => setD(e.target.value)} 
            className={`w-full p-4 rounded-xl font-bold text-base text-center ${t.bg} border ${t.border} shadow-inner outline-none focus:ring-2 ${t.ring} transition-all`} 
          />
        </div>
      </div>
      <button 
        onClick={() => onSave({name:n, amount:Number(a), dueDate:Number(d), icon:'🧾'})} 
        disabled={!n || !a} 
        className={`w-full py-5 rounded-[1.5rem] font-bold text-lg ${t.primaryBtnText} shadow-lg ${t.primary} disabled:opacity-50 mt-4 active:scale-95 transition-all hover:brightness-110`}
      >
        建立帳單
      </button>
    </div>
  );
};

const NoteForm = ({ data, onSave, onDelete, t }) => {
  const [ti, setTi] = useState(data?.title || ''); 
  const [c, setC] = useState(data?.content || '');
  
  return (
    <div className={`space-y-4 flex flex-col h-full ${t.bg} p-6 rounded-[2rem] border ${t.border} shadow-inner mb-8 mt-4`}>
      <div className={`flex justify-between items-center mb-2 border-b ${t.border} pb-4`}>
        <input 
          value={ti} 
          onChange={e => setTi(e.target.value)} 
          placeholder="標題..." 
          className={`w-full p-2 font-black text-2xl bg-transparent border-none focus:outline-none ${t.text}`} 
        />
        {data && <Trash2 onClick={() => onDelete(data.id)} className={`${t.textM} hover:text-red-500 cursor-pointer w-5 h-5 shrink-0 transition-colors`}/>}
      </div>
      <textarea 
        value={c} 
        onChange={e => setC(e.target.value)} 
        placeholder="內容..." 
        className={`flex-1 w-full p-2 resize-none min-h-[300px] font-bold text-base bg-transparent border-none focus:outline-none ${t.textM} leading-relaxed`} 
      />
      <button 
        onClick={() => onSave({id:data?.id, title:ti, content:c})} 
        disabled={!ti && !c} 
        className={`w-full py-5 rounded-[1.5rem] font-bold text-lg ${t.primaryBtnText} shadow-lg ${t.primary} disabled:opacity-50 mt-4 active:scale-95 transition-all hover:brightness-110`}
      >
        儲存筆記
      </button>
    </div>
  );
};

const EventForm = ({ onSave, t }) => {
  const today = new Date();
  const [ti, setTi] = useState(''); 
  const [dateStr, setDateStr] = useState(getLocalYYYYMMDD(today));
  const [displayDate, setDisplayDate] = useState(`${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`);
  
  const handleDateType = (e) => {
    let val = e.target.value.replace(/\D/g, ''); 
    if (val.length > 8) val = val.slice(0, 8);
    let formatted = val;
    if (val.length >= 5) formatted = `${val.slice(0,2)}/${val.slice(2,4)}/${val.slice(4)}`;
    else if (val.length >= 3) formatted = `${val.slice(0,2)}/${val.slice(2)}`;
    setDisplayDate(formatted);
    if (val.length === 8) { 
      const d = val.slice(0,2); const m = val.slice(2,4); const y = val.slice(4); 
      setDateStr(`${y}-${m}-${d}`); 
    }
  };
  
  const handleDateSelect = (e) => {
    const val = e.target.value; 
    setDateStr(val);
    if (val) { 
      const [y, m, d] = val.split('-'); 
      setDisplayDate(`${d}/${m}/${y}`); 
    }
  };
  
  return (
    <div className="space-y-5 pb-8 pt-4">
      <div className="space-y-2">
        <label className={`block text-xs font-bold ${t.textM} px-1`}>名稱</label>
        <input 
          value={ti} 
          onChange={e => setTi(e.target.value)} 
          placeholder="名稱 (例如: 結婚紀念日)" 
          className={`w-full p-4 rounded-xl font-bold text-base ${t.bg} border ${t.border} shadow-inner outline-none focus:ring-2 ${t.ring} transition-all`} 
        />
      </div>
      <div className="space-y-2">
        <label className={`block text-xs font-bold ${t.textM} px-1`}>日期 (DD/MM/YYYY)</label>
        <div className="relative">
          <input 
            type="text" 
            value={displayDate} 
            onChange={handleDateType} 
            placeholder="DD/MM/YYYY" 
            maxLength={10} 
            className={`w-full p-4 pr-12 rounded-xl ${t.bg} border ${t.border} shadow-inner font-bold text-base outline-none focus:ring-2 ${t.ring} transition-all`} 
          />
          <div className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center overflow-hidden pointer-events-none">
            <Calendar className={`w-5 h-5 ${t.textM}`} />
          </div>
          <input 
            type="date" 
            value={dateStr} 
            onChange={handleDateSelect} 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
          />
        </div>
      </div>
      <button 
        onClick={() => onSave({title:ti, date:dateStr, icon:'🎉'})} 
        disabled={!ti || !dateStr || displayDate.length !== 10} 
        className={`w-full py-5 rounded-[1.5rem] font-bold text-lg text-white shadow-lg bg-pink-500/90 disabled:opacity-50 mt-4 active:scale-95 transition-all hover:bg-pink-500`}
      >
        新增日子
      </button>
    </div>
  );
};

const GoalForm = ({ onSave, t }) => {
  const [ti, setTi] = useState(''); 
  const [a, setA] = useState('');
  
  return (
    <div className="space-y-5 pb-8 pt-4">
      <div className="space-y-2">
         <label className={`block text-xs font-bold ${t.textM} px-1`}>目標名稱</label>
         <input 
           value={ti} 
           onChange={e => setTi(e.target.value)} 
           placeholder="例如: 歐洲旅遊" 
           className={`w-full p-4 rounded-xl font-bold text-base ${t.bg} border ${t.border} shadow-inner outline-none focus:ring-2 ${t.ring} transition-all`} 
         />
      </div>
      <div className="space-y-2">
         <label className={`block text-xs font-bold ${t.textM} px-1`}>目標金額</label>
         <input 
           type="number" 
           value={a} 
           onChange={e => setA(e.target.value)} 
           placeholder="$0" 
           className={`w-full p-4 rounded-xl font-bold text-base ${t.bg} border ${t.border} shadow-inner outline-none focus:ring-2 ${t.ring} transition-all`} 
         />
      </div>
      <button 
        onClick={() => onSave({title:ti, targetAmount:Number(a)})} 
        disabled={!ti || !a} 
        className={`w-full py-5 rounded-[1.5rem] font-bold text-lg ${t.primaryBtnText} shadow-lg ${t.primary} disabled:opacity-50 mt-4 active:scale-95 transition-all hover:brightness-110`}
      >
        建立願望
      </button>
    </div>
  );
};

const FundForm = ({ goal, onSave, t }) => {
  const [a, setA] = useState('');
  
  return (
    <div className="space-y-6 text-center pb-8 pt-4">
      <p className={`font-bold text-lg ${t.textM} mb-6`}>存入資金到 <span className={`${t.primaryText} ml-1`}>{goal?.title}</span></p>
      <input 
        type="number" 
        value={a} 
        onChange={e => setA(e.target.value)} 
        autoFocus 
        placeholder="$0" 
        className={`w-full py-8 text-center font-black text-6xl bg-transparent border-b-2 ${t.border} ${t.text} focus:outline-none focus:border-indigo-500 transition-colors drop-shadow-sm`} 
      />
      <button 
        onClick={() => onSave(Number(a))} 
        disabled={!a} 
        className={`w-full py-5 rounded-[1.5rem] font-black text-xl ${t.primaryBtnText} shadow-lg ${t.primary} disabled:opacity-50 mt-10 active:scale-95 transition-all hover:brightness-110`}
      >
        確認存入
      </button>
    </div>
  );
};
