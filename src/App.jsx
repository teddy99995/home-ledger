import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Plus, X, Loader2, Trash2, ReceiptText, Sparkles, ChevronLeft, ChevronRight, Target, Coins, 
  PieChart as PieChartIcon, ArrowRightLeft, Home, Search, Settings, CheckCircle2, AlertCircle,
  Barcode, ClipboardList, Edit3, CalendarHeart,
  Wallet, CalendarClock, Check, Briefcase, ShoppingCart, DownloadCloud, Image as ImageIcon,
  AlertTriangle, ChevronDown, Moon, Sun, Filter, Bell, Archive, Calendar, TrendingUp, TrendingDown, Globe
} from 'lucide-react';

// Firebase 核心模組
import { signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, onSnapshot, serverTimestamp, doc, deleteDoc, updateDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

// 📦 引入我們剛剛拆分出去的小盒子
import { auth, db, APP_ID, apiKey } from './firebase';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './utils/constants';
import { getLocalYYYYMM, getLocalYYYYMMDD, getLocalHHmm, calculateDaysDiff, fetchWithBackoff } from './utils/helpers';
import { 
  ToggleSwitch, SwipeableItem, TrendLineChart, TxForm, AIChatForm, 
  SettingsForm, BarcodeForm, RecurringForm, AccForm, BillForm, 
  NoteForm, EventForm, GoalForm, FundForm 
} from './components/Modals';

// 簡化資料庫路徑的工具函數
const getCol = (colName) => collection(db, 'artifacts', APP_ID, 'public', 'data', String(colName)); 
const getDocRef = (colName, docId) => doc(db, 'artifacts', APP_ID, 'public', 'data', String(colName), String(docId)); 

export default function App() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState({ 
    tx: [], accounts: [], bills: [], notes: [], shopping: [], goals: [], events: [], tags: [], recurringRules: [], templates: [] 
  });
  
  const [ui, setUi] = useState(() => {
    const savedIsDark = localStorage.getItem('homeLedgerTheme') !== 'light';
    return {
      date: new Date(), endDate: new Date(), dateFilterMode: 'month',
      tab: 'home', subTab: 'bills', statsView: 'month', chartView: 'expense', modal: null, search: '', filterTags: [], filterAccount: 'all',
      isDark: savedIsDark, confirm: null, toast: null, selectedTx: null 
    };
  });
  
  const [settings, setSettings] = useState({ 
    monthlyBudget: 50000, husbandBarcode: '', wifeBarcode: '', husbandCert: '', wifeCert: '',
    enableRollover: true, autoSyncInvoices: true, notifyLargeExpense: true, largeExpenseThreshold: 3000, 
    notifyBillDue: true, notifyEvents: true, notifyAdvanceDays: 3,
    travelMode: false, travelCurrencies: [],
    uiFontSize: 'md' 
  });
  
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
    setTimeout(() => updateUi({ toast: null }), 4000); 
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
        await signInAnonymously(auth);
      } catch (err) {
        showToast("登入失敗，請檢查網路", "error");
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // 📡 資料庫連線與監聽
  useEffect(() => {
    if (!user) return;
    const unsubs = [
      onSnapshot(getCol('shared_accounts'), snap => {
        if (snap.empty) {
          const defaults = [
            { id: 'acc_joint', name: '共同生活金', type: 'joint', icon: '🏦', archived: false }, 
            { id: 'acc_h', name: '老公帳戶', type: 'husband', icon: '👨', archived: false }, 
            { id: 'acc_w', name: '老婆帳戶', type: 'wife', icon: '👩', archived: false }
          ];
          defaults.forEach(d => setDoc(getDocRef('shared_accounts', d.id), { ...d, createdAt: serverTimestamp() }));
        } else {
          setData(prev => ({ ...prev, accounts: snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.createdAt?.toMillis() - b.createdAt?.toMillis()) }));
        }
      }),
      onSnapshot(getDocRef('shared_settings', 'main'), doc => { 
        if (doc.exists()) {
          const d = doc.data();
          if (!d.travelCurrencies && d.travelCurrency) d.travelCurrencies = [{code: d.travelCurrency, rate: d.travelRate || 1}];
          setSettings(prev => ({ ...prev, ...d })); 
        }
      }),
      onSnapshot(getDocRef('shared_tags', 'main'), doc => setData(prev => ({ ...prev, tags: doc.exists() ? doc.data().tags : [] }))),
      onSnapshot(getCol('recurring_rules'), snap => setData(prev => ({ ...prev, recurringRules: snap.docs.map(d => ({ id: d.id, ...d.data() })) }))),
      onSnapshot(getCol('shared_templates'), snap => setData(prev => ({ ...prev, templates: snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()) }))),
      onSnapshot(getCol('shared_ledger'), snap => setData(p => ({ ...p, tx: snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
          const dateA = a.date || ''; const dateB = b.date || '';
          if (dateA !== dateB) return dateB.localeCompare(dateA);
          const timeA = a.recordTime || ''; const timeB = b.recordTime || '';
          if (timeA !== timeB) return timeB.localeCompare(timeA);
          return b.createdAt?.toMillis() - a.createdAt?.toMillis();
        }) }))),
      onSnapshot(getCol('shared_bills'), snap => setData(p => ({ ...p, bills: snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.dueDate - b.dueDate) }))),
      onSnapshot(getCol('shared_notes'), snap => setData(p => ({ ...p, notes: snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.updatedAt?.toMillis() - a.updatedAt?.toMillis()) }))),
      onSnapshot(getCol('shared_shopping'), snap => setData(p => ({ ...p, shopping: snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.completed === b.completed ? (b.createdAt?.toMillis() - a.createdAt?.toMillis()) : (a.completed ? 1 : -1)) }))),
      onSnapshot(getCol('shared_goals'), snap => setData(p => ({ ...p, goals: snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.createdAt?.toMillis() - b.createdAt?.toMillis()) }))),
      onSnapshot(getCol('shared_events'), snap => setData(p => ({ ...p, events: snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => calculateDaysDiff(a.date) - calculateDaysDiff(b.date)) })))
    ];
    return () => unsubs.forEach(u => u());
  }, [user]);

  // 週期性記帳引擎
  useEffect(() => {
    if (!user || data.recurringRules.length === 0 || processedRecurring.current) return;
    const processRules = async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0); let processedCount = 0;
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

  const activeAccounts = useMemo(() => data.accounts.filter(a => !a.archived), [data.accounts]);
  const cMonth = getLocalYYYYMM(ui.date);
  const cYear = String(ui.date.getFullYear());
  
  const activeTxs = useMemo(() => {
    if (ui.dateFilterMode === 'month') return data.tx.filter(t => t.month === cMonth);
    if (ui.dateFilterMode === 'year') return data.tx.filter(t => t.date.startsWith(cYear));
    if (ui.dateFilterMode === 'custom') {
      const start = getLocalYYYYMMDD(ui.date); const end = getLocalYYYYMMDD(ui.endDate);
      return data.tx.filter(t => t.date >= start && t.date <= end);
    }
    return [];
  }, [data.tx, ui.dateFilterMode, cMonth, cYear, ui.date, ui.endDate]);
  
  const filteredActiveTxs = useMemo(() => {
    if (!ui.filterAccount || ui.filterAccount === 'all') return activeTxs;
    return activeTxs.filter(t => t.accountId === ui.filterAccount);
  }, [activeTxs, ui.filterAccount]);

  const displayTx = useMemo(() => filteredActiveTxs.filter(t => {
    const q = !ui.search || t.category?.includes(ui.search) || t.note?.includes(ui.search);
    const tg = ui.filterTags.length === 0 || ui.filterTags.every(tag => t.tags && t.tags.includes(tag));
    return q && tg;
  }), [filteredActiveTxs, ui.search, ui.filterTags]);

  const calcStats = (txs) => txs.reduce((s, t) => {
    if (t.type === 'transfer') return s;
    if (t.type === 'expense') { s.exp += t.amount; s.expCat[t.category] = (s.expCat[t.category] || 0) + t.amount; } 
    else if (t.type === 'income') { s.inc += t.amount; s.incCat[t.category] = (s.incCat[t.category] || 0) + t.amount; }
    return s;
  }, { exp: 0, inc: 0, expCat: {}, incCat: {} });

  const hStats = calcStats(filteredActiveTxs); 
  const tStats = calcStats(filteredActiveTxs); 

  const chartData = useMemo(() => {
    const isExp = ui.chartView === 'expense';
    const targetTotal = isExp ? tStats.exp : tStats.inc;
    const targetCat = isExp ? tStats.expCat : tStats.incCat;
    const total = targetTotal || 1;
    const catList = isExp ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

    return Object.entries(targetCat).map(([name, value]) => {
      const catObj = catList.find(c => c.name === name);
      return { name, value, percentage: Math.round((value / total) * 100), color: catObj?.color || '#a8a29e', icon: catObj?.icon || '✨' };
    }).sort((a, b) => b.value - a.value);
  }, [tStats, ui.chartView]);

  const rollover = useMemo(() => {
    if (!settings.enableRollover) return { enabled: false, amt: 0, budget: settings.monthlyBudget };
    const pMonth = getLocalYYYYMM(new Date(ui.date.getFullYear(), ui.date.getMonth() - 1, 1));
    const pExp = data.tx.filter(t => t.month === pMonth && t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const amt = (pExp < settings.monthlyBudget && pExp > 0) ? settings.monthlyBudget - pExp : 0;
    return { enabled: true, amt, budget: settings.monthlyBudget + amt };
  }, [settings, ui.date, data.tx]);

  const accBal = data.accounts.reduce((acc, a) => {
    const balance = data.tx.reduce((sum, t) => {
      if (t.type === 'transfer') { if (t.fromAccountId === a.id) return sum - t.amount; if (t.toAccountId === a.id) return sum + t.amount; } 
      else if (t.accountId === a.id) return t.type === 'expense' ? sum - t.amount : sum + t.amount;
      return sum;
    }, a.balance || 0);
    return { ...acc, [a.id]: balance };
  }, {});
  
  const totalAssets = Object.values(accBal).reduce((s, b) => s + b, 0);

  const settlement = useMemo(() => {
    let hOwesW = 0; let wOwesH = 0; 
    activeTxs.forEach(t => {
      if (t.type !== 'expense' || t.split === 'none') return; 
      let ratioH = 0.5; let ratioW = 0.5;
      if (t.split === 'custom' && t.splitRatio) { ratioH = t.splitRatio.h / 100; ratioW = t.splitRatio.w / 100; }
      if (t.payer === 'husband') wOwesH += (t.amount * ratioW); else if (t.payer === 'wife') hOwesW += (t.amount * ratioH);
    });
    const netWifeOwesHusband = wOwesH - hOwesW;
    if (netWifeOwesHusband > 0.01) return { status: 'unsettled', who: 'wife', to: 'husband', amt: netWifeOwesHusband };
    if (netWifeOwesHusband < -0.01) return { status: 'unsettled', who: 'husband', to: 'wife', amt: Math.abs(netWifeOwesHusband) };
    return { status: 'settled' };
  }, [activeTxs]);

  const rawAlerts = useMemo(() => {
    const a = []; const today = new Date().getDate(); const notifyDays = settings.notifyAdvanceDays || 3;
    if (settings.notifyBillDue) data.bills.forEach(b => { if (!b.isPaid && b.dueDate - today >= 0 && b.dueDate - today <= notifyDays) a.push({ id: `b_${b.id}`, icon: b.icon || '🧾', title: '帳單到期', desc: `${b.name} 將在 ${b.dueDate - today === 0 ? '今天' : `${b.dueDate - today} 天後`} 到期` }); });
    if (settings.notifyEvents) data.events.forEach(e => { const d = calculateDaysDiff(e.date); if (d >= 0 && d <= notifyDays) a.push({ id: `e_${e.id}`, icon: e.icon || '🎉', title: '紀念日提醒', desc: `${e.title} 還有 ${d} 天` }); });
    if (settings.notifyLargeExpense) data.tx.filter(t => t.month === cMonth).slice(0, 15).forEach(t => { if (t.type === 'expense' && t.amount >= (settings.largeExpenseThreshold || 3000)) a.push({ id: `t_${t.id}`, icon: '💸', title: '大額消費防護', desc: `${t.payer === 'husband' ? '老公' : t.payer === 'wife' ? '老婆' : '共同'} 記了一筆 $${t.amount.toLocaleString()}` }); });
    return a;
  }, [data, settings, cMonth]);

  const activeAlerts = rawAlerts.filter(a => !dismissedAlerts.includes(a.id));

  // 🛡️ 危險操作帶文字確認防呆
  const confirmAction = (msg, action, requireText = null) => {
    updateUi({ confirm: { message: msg, requireText, onConfirm: async () => {
      try { await action(); showToast("操作已成功執行"); } 
      catch (e) { showToast(`操作失敗: ${e.message}`, "error"); }
      finally { updateUi({ confirm: null }); }
    }}});
  };

  const handleAddGlobalTag = async (tagName) => {
    if (!tagName.trim() || data.tags.includes(tagName)) return;
    try { await setDoc(getDocRef('shared_tags', 'main'), { tags: arrayUnion(tagName) }, { merge: true }); showToast(`標籤 #${tagName} 已建立`); } catch (err) {}
  };

  const handleToggleArchiveAccount = async (accId, isArchived) => {
    try { await updateDoc(getDocRef('shared_accounts', accId), { archived: !isArchived }); showToast(isArchived ? "帳戶已解封" : "帳戶已封存，歷史明細將被保留"); } catch (e) {}
  };

  // 🤖 AI 顧問呼叫
  const handleCallAI = async () => {
    if (!apiKey) { showToast("系統未設定 API 金鑰！", "error"); return; }
    setIsAiLoading(true); setAiAnalysis('');
    try {
      const topCats = chartData.slice(0, 3).map(c => `${c.name}(${c.percentage}%)`).join('、');
      let stext = settlement.status === 'settled' ? "無欠款" : (settlement.who === 'husband' ? `老婆需給老公${Math.round(settlement.amt)}` : `老公需給老婆${Math.round(settlement.amt)}`);
      const prompt = `這是家庭帳本期間紀錄：支出${tStats.exp}元。前三花費:${topCats || '無'}。結算:${stext}。請用溫馨朋友語氣給一段50字理財建議(不列點)。`;
      
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const resData = await res.json();
      setAiAnalysis(resData.candidates[0].content.parts[0].text);
    } catch (err) { setAiAnalysis(`AI 服務連線異常：${err.message}`); } finally { setIsAiLoading(false); }
  };

  // 匯出 CSV 
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

  let t = ui.isDark ? { 
    bg: 'bg-[#0f172a]', cardInner: 'bg-[#1e293b]', text: 'text-[#f8fafc]', textM: 'text-[#94a3b8]', primary: 'bg-[#6366f1]', primaryText: 'text-[#818cf8]', border: 'border-[#334155]', input: 'bg-[#0f172a] text-white', ring: 'focus:ring-indigo-500'
  } : {
    bg: 'bg-[#fafaf9]', cardInner: 'bg-white', text: 'text-[#292524]', textM: 'text-[#78716c]', primary: 'bg-[#0f172a]', primaryText: 'text-[#0f172a]', border: 'border-[#e7e5e4]', input: 'bg-[#fafaf9] text-[#292524]', ring: 'focus:ring-[#0f172a]'
  };

  if (settings.travelMode) {
     t = { ...t, bg: ui.isDark ? 'bg-[#020617]' : 'bg-[#f0f9ff]', primary: ui.isDark ? 'bg-[#3b82f6]' : 'bg-[#2563eb]', primaryText: ui.isDark ? 'text-[#60a5fa]' : 'text-[#2563eb]' }
  }
  const rootFontSize = settings.uiFontSize === 'sm' ? '14px' : settings.uiFontSize === 'lg' ? '18px' : '16px';

  return (
    <React.Fragment>
      <style dangerouslySetInnerHTML={{__html: `
        :root { font-size: ${rootFontSize} !important; }
        .pb-safe { padding-bottom: calc(1.5rem + env(safe-area-inset-bottom)); }
        .pt-safe { padding-top: calc(1rem + env(safe-area-inset-top)); }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        body { background-color: ${t.bg.replace('bg-[', '').replace(']', '')}; margin: 0; padding: 0; transition: background-color 0.5s ease; }
        .donut-ring { stroke-linecap: round; transition: stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s ease; }
      `}} />

      <div className={`min-h-[100dvh] w-full flex justify-center ${t.bg} transition-colors duration-500 overflow-x-hidden font-sans`}>
        <div className={`w-full max-w-md md:max-w-xl ${t.text} relative flex flex-col min-h-[100dvh] ${t.cardInner} md:border-x md:shadow-2xl ${t.border}`}>
          
          {/* 🔥 安全刪除確認 Modal */}
          {ui.confirm && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-5 animate-in fade-in">
              <div className={`${t.cardInner} rounded-[2rem] p-8 w-full max-w-sm shadow-2xl text-center border ${t.border}`}>
                <AlertTriangle className="w-16 h-16 text-rose-500 mx-auto mb-5 bg-rose-500/10 p-3 rounded-full" />
                <h3 className={`text-xl font-black ${t.text} mb-4`}>{ui.confirm.message}</h3>
                {ui.confirm.requireText && (
                  <div className="mb-6">
                    <p className={`text-xs ${t.textM} mb-2`}>請在下方輸入 <span className="font-black text-rose-500">{ui.confirm.requireText}</span> 以確認：</p>
                    <input type="text" id="confirmInput" placeholder={ui.confirm.requireText} className={`w-full text-center p-3 rounded-xl font-bold ${t.bg} border ${t.border} outline-none focus:ring-2 ring-rose-500`} 
                           onChange={(e) => { const btn = document.getElementById('confirmDangerBtn'); if(btn) btn.disabled = e.target.value !== ui.confirm.requireText; }} />
                  </div>
                )}
                <div className="flex gap-3">
                  <button onClick={() => updateUi({confirm: null})} className={`flex-1 py-4 rounded-xl font-bold text-base ${t.textM} ${t.bg} hover:opacity-80 transition-all`}>取消</button>
                  <button id="confirmDangerBtn" onClick={ui.confirm.onConfirm} disabled={!!ui.confirm.requireText} className={`flex-1 py-4 rounded-xl font-bold text-base text-white bg-rose-500 shadow-md shadow-rose-500/20 active:scale-95 transition-all disabled:opacity-30 disabled:grayscale`}>{ui.confirm.requireText ? '確認執行' : '刪除'}</button>
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

          {/* 🌟 頂部 Header */}
          <header className={`px-6 pt-safe pb-4 flex justify-between items-center ${t.cardInner} z-10 shrink-0`}>
            <div className="flex gap-2 w-24">
               <button onClick={() => updateUi({ isDark: !ui.isDark })} className={`p-2.5 rounded-full border ${t.border} ${t.bg} active:scale-95 transition-transform`}><Sun className="w-5 h-5 hidden dark:block"/><Moon className="w-5 h-5 block dark:hidden"/></button>
               <button onClick={() => updateUi({ modal: 'settings' })} className={`p-2.5 rounded-full border ${t.border} ${t.bg} active:scale-95 transition-transform`}><Settings className="w-5 h-5"/></button>
            </div>
            <div className="flex-1 text-center"><h1 className="text-xl font-black tracking-wider flex items-center justify-center gap-1.5 uppercase">{settings.travelMode && <Globe className="w-5 h-5 text-[#3b82f6]" />} Home Ledger {!settings.travelMode && <span className="text-rose-500 animate-pulse">♡</span>}</h1></div>
            <div className="flex gap-2 w-24 justify-end relative">
              <button onClick={() => updateUi({ modal: 'barcode' })} className={`p-2.5 rounded-full border ${t.border} ${t.bg} active:scale-95 transition-transform`}><Barcode className="w-5 h-5"/></button>
              <button onClick={() => updateUi({ modal: 'notify' })} className={`p-2.5 rounded-full border ${t.border} ${t.bg} active:scale-95 transition-transform relative`}><Bell className="w-5 h-5"/>{activeAlerts.length > 0 && <span className={`absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 border-2 ${t.cardInner.replace('bg-', 'border-')} rounded-full`}></span>}</button>
            </div>
          </header>

          {/* 主畫面 */}
          <main className={`px-6 space-y-8 flex-1 overflow-y-auto pb-40 pt-2 hide-scrollbar ${t.bg}`}>
            
            {/* ================= 首頁 Tab ================= */}
            {ui.tab === 'home' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className={`flex p-1.5 rounded-2xl border ${t.border} ${t.cardInner} overflow-x-auto hide-scrollbar gap-1 shadow-sm`}>
                   <button onClick={() => updateUi({ filterAccount: 'all' })} className={`shrink-0 px-6 py-2.5 font-bold text-sm rounded-xl transition-all ${(!ui.filterAccount || ui.filterAccount === 'all') ? `${t.bg} shadow-sm ${t.text}` : t.textM}`}>全部帳戶</button>
                   {activeAccounts.map(a => (
                      <button key={a.id} onClick={() => updateUi({ filterAccount: a.id })} className={`shrink-0 px-6 py-2.5 font-bold text-sm rounded-xl transition-all flex items-center gap-1.5 ${ui.filterAccount === a.id ? `${t.bg} shadow-sm ${t.text}` : t.textM}`}>{a.icon} {a.name}</button>
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
                          <p className={`text-xs font-bold ${t.textM} mb-1 flex items-center gap-1.5`}><TrendingUp className="w-4 h-4 text-emerald-500"/>總收入</p>
                          <h2 className="text-3xl font-black text-emerald-500">${hStats.inc.toLocaleString()}</h2>
                      </div>
                      <div className={`p-5 rounded-[2rem] border ${t.border} ${t.bg} shadow-sm relative overflow-hidden`}>
                          <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/10 rounded-bl-[100%]"></div>
                          <p className={`text-xs font-bold ${t.textM} mb-1 flex items-center gap-1.5`}><TrendingDown className="w-4 h-4 text-rose-500"/>總支出</p>
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
                       <div className="flex justify-between items-center mb-3"><span className={`text-xs font-bold ${t.textM}`}>上月省下：<strong className="text-emerald-500">${rollover.amt.toLocaleString()}</strong></span><span className={`text-xs font-bold ${t.textM}`}>本月可用：<strong className={t.text}>${rollover.budget.toLocaleString()}</strong></span></div>
                       <div className={`w-full h-2.5 ${t.bg} rounded-full overflow-hidden shadow-inner`}><div className={`h-full ${t.primary} rounded-full transition-all duration-1000 ease-out`} style={{width: `${Math.min((hStats.exp/rollover.budget)*100, 100)}%`}}></div></div>
                    </div>
                  )}
                </section>

                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className={`w-5 h-5 ${t.textM} absolute left-4 top-1/2 -translate-y-1/2`} />
                    <input type="text" value={ui.search} onChange={e => updateUi({ search: e.target.value })} placeholder="搜尋明細、備註..." className={`w-full ${t.cardInner} font-bold py-4 pl-12 pr-4 text-sm rounded-2xl border ${t.border} focus:outline-none focus:ring-2 ${t.ring} shadow-sm`} />
                  </div>
                  <button onClick={() => updateUi({ modal: 'tags' })} className={`p-4 rounded-2xl border shadow-sm transition-all ${ui.filterTags.length > 0 ? `${t.primary} text-white border-transparent` : `${t.cardInner} ${t.textM} ${t.border}`} active:scale-95 relative`}>
                    <Filter className="w-5 h-5" />{ui.filterTags.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 border-2 border-white rounded-full"></span>}
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
                    const catObj = EXPENSE_CATEGORIES.find(c=>c.name===tx.category) || INCOME_CATEGORIES.find(c=>c.name===tx.category);
                    const icon = catObj ? catObj.icon : '📝';
                    let displayDateStr = tx.date; if (tx.date && tx.date.includes('-')) { const [y, m, d] = tx.date.split('-'); displayDateStr = `${d}/${m}/${y}`; }
                    
                    return (
                      <SwipeableItem key={tx.id} t={t} onEdit={() => updateUi({ modal: 'tx', selectedTx: tx })} onDelete={() => confirmAction('確定刪除此紀錄？', () => deleteDoc(getDocRef('shared_ledger', tx.id)))}>
                        <div className={`p-5 flex flex-col`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 truncate">
                              <div className={`w-14 h-14 rounded-full ${t.bg} border ${t.border} flex items-center justify-center text-2xl shrink-0 shadow-inner`}>{tx.type === 'transfer' ? <ArrowRightLeft className="w-5 h-5 text-stone-500" /> : icon}</div>
                              <div className="truncate">
                                <p className="font-extrabold text-lg truncate mb-1">
                                  {tx.type === 'transfer' ? '轉帳' : tx.category} 
                                  <span className={`text-xs ${t.textM} ml-2 font-bold opacity-80`}>{tx.type === 'transfer' ? `${data.accounts.find(a=>a.id===tx.fromAccountId)?.name} ➔ ${data.accounts.find(a=>a.id===tx.toAccountId)?.name}` : `(${data.accounts.find(a=>a.id===tx.accountId)?.name})`}</span>
                                </p>
                                <div className="flex gap-1.5 mt-1.5 flex-wrap items-center">
                                {tx.type !== 'transfer' && (
                                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold shadow-sm ${tx.type === 'expense' ? 'bg-stone-100 text-stone-600' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {tx.type === 'expense' ? '付:' : '收:'}{tx.payer==='husband' ? '老公' : tx.payer==='wife' ? '老婆' : '共同'}
                                    {tx.type === 'expense' ? (tx.split === 'none' ? ' (不平分)' : (tx.split === 'custom' && tx.splitRatio ? ` (男${tx.splitRatio.h} 女${tx.splitRatio.w})` : ' (平分)')) : ''}
                                  </span>
                                )}
                                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${t.bg} ${t.textM} shadow-sm`}>{displayDateStr} {tx.recordTime || ''}</span>
                                {tx.tags?.map(tg => <span key={tg} className={`text-[10px] px-2 py-0.5 rounded-md font-bold text-white bg-[#6366f1] shadow-sm`}>#{tg}</span>)}
                                <span className={`text-xs ${t.textM} font-bold truncate max-w-[120px] ml-1`}>{tx.note}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                              <span className={`font-black text-xl ${tx.type === 'expense' ? t.text : tx.type === 'income' ? 'text-emerald-500' : t.textM}`}>{tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}${tx.amount.toLocaleString()}</span>
                              {tx.hasPhoto && <ImageIcon className={`w-3.5 h-3.5 ${t.textM}`} />}
                            </div>
                          </div>
                        </div>
                      </SwipeableItem>
                    )
                  })}
                </div>
              </div>
            )}
            
            {/* ================= 帳戶 Tab ================= */}
            {ui.tab === 'wallets' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex justify-between items-center px-2"><h2 className="text-2xl font-black">總資產</h2><span className={`text-3xl font-black ${t.primaryText}`}>${totalAssets.toLocaleString()}</span></div>
                <div className="grid grid-cols-2 gap-4">
                  {data.accounts.map(a => {
                    const isArchived = a.archived;
                    return (
                    <div key={a.id} className={`p-6 rounded-[2rem] ${t.cardInner} shadow-sm border ${t.border} relative group flex flex-col justify-between min-h-[140px] ${isArchived ? 'opacity-50 grayscale' : ''}`}>
                      <div>
                        <div className="flex items-center gap-3 mb-3 pr-6"><span className="text-3xl bg-black/5 w-10 h-10 flex items-center justify-center rounded-full shadow-sm">{a.icon}</span><span className="font-bold text-sm truncate">{a.name} {isArchived && '(已封存)'}</span></div>
                        <div className="text-2xl font-black">${(accBal[a.id] || 0).toLocaleString()}</div>
                      </div>
                      <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                         <button onClick={() => handleToggleArchiveAccount(a.id, isArchived)} className={`w-8 h-8 rounded-full flex items-center justify-center ${t.bg} shadow-sm hover:opacity-80`}><Archive className={`w-4 h-4 ${t.textM}`} /></button>
                         <button onClick={() => confirmAction(`確定要永久刪除【${a.name}】嗎？這將導致所有歷史關聯失效！建議使用封存。`, () => deleteDoc(getDocRef('shared_accounts', a.id)), '刪除')} className={`w-8 h-8 rounded-full flex items-center justify-center bg-rose-500/10 text-rose-500 shadow-sm hover:bg-rose-500 hover:text-white`}><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  )})}
                  <div onClick={() => updateUi({ modal: 'account' })} className={`bg-transparent border-2 border-dashed ${t.border} rounded-[2rem] p-6 flex flex-col items-center justify-center ${t.textM} cursor-pointer min-h-[140px] hover:bg-black/5 transition-colors active:scale-95`}><Plus className="w-8 h-8 mb-2 opacity-50"/><span className="text-sm font-bold">新增帳戶</span></div>
                </div>
              </div>
            )}

            {/* ================= 統計 Tab ================= */}
            {ui.tab === 'stats' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                 <div className={`flex p-1.5 rounded-2xl border ${t.border} ${t.cardInner} overflow-x-auto hide-scrollbar gap-1 shadow-sm`}>
                    <button onClick={() => updateUi({ filterAccount: 'all' })} className={`shrink-0 px-5 py-2 font-bold text-xs rounded-xl transition-all ${(!ui.filterAccount || ui.filterAccount === 'all') ? `${t.bg} shadow-sm ${t.text}` : t.textM}`}>全部帳戶</button>
                    {activeAccounts.map(a => (<button key={a.id} onClick={() => updateUi({ filterAccount: a.id })} className={`shrink-0 px-5 py-2 font-bold text-xs rounded-xl transition-all ${ui.filterAccount === a.id ? `${t.bg} shadow-sm ${t.text}` : t.textM}`}>{a.name}</button>))}
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
                    {chartData.length === 0 ? <div className={`text-center text-sm font-bold ${t.textM}`}>區間內無資料</div> : chartData.map((item, idx) => (
                      <div key={idx} className={`flex justify-between items-center p-4 rounded-2xl ${t.bg} shadow-sm border ${t.border}`}>
                        <div className="flex gap-3 font-bold text-sm items-center"><span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }}></span> {item.icon} {item.name}</div>
                        <div className="flex items-center gap-4"><span className={`font-black ${t.textM} text-xs`}>{item.percentage}%</span><span className="font-black text-base">${item.value.toLocaleString()}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {ui.statsView === 'year' && (
                  <TrendLineChart data={filteredActiveTxs} year={ui.date.getFullYear()} t={t} isDark={ui.isDark} />
                )}

                <div className={`${t.cardInner} rounded-[2.5rem] p-7 border ${t.border} shadow-lg relative overflow-hidden`}>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full"></div>
                  <h3 className="font-black text-lg mb-6 flex items-center gap-2"><ArrowRightLeft className="w-5 h-5 text-amber-500"/> 代墊精算</h3>
                  <p className={`text-xs ${t.textM} font-bold mb-6 bg-black/5 p-3 rounded-xl border border-black/5`}>💡 結算為「全部帳戶」於此時間區間內之總和，不受上方帳戶篩選影響</p>
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
              </div>
            )}

            {/* ================= 生活 Tab ================= */}
            {ui.tab === 'life' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className={`flex ${t.cardInner} p-1.5 rounded-xl border ${t.border} shadow-sm mx-1 overflow-x-auto hide-scrollbar gap-1`}>
                  {[{ id: 'bills', label: '帳單', icon: <CalendarClock className="w-4 h-4"/> }, { id: 'shopping', label: '購物', icon: <ShoppingCart className="w-4 h-4"/> }, { id: 'notes', label: '記事', icon: <StickyNote className="w-4 h-4"/> }, { id: 'events', label: '日子', icon: <CalendarHeart className="w-4 h-4"/> }, { id: 'goals', label: '夢想', icon: <Target className="w-4 h-4"/> }].map(item => (<button key={item.id} onClick={() => updateUi({ subTab: item.id })} className={`flex-1 min-w-[70px] py-3 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all ${ui.subTab === item.id ? `${t.bg} ${t.text} shadow-sm` : t.textM}`}>{item.icon} {item.label}</button>))}
                </div>
                {ui.subTab === 'bills' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-6 px-2"><div><h3 className="text-xl font-black">每月固定帳單</h3><p className={`text-xs font-bold ${t.textM} mt-1`}>時間到自動提醒繳費</p></div><button onClick={() => updateUi({ modal: 'bill' })} className={`px-4 py-2.5 ${t.cardInner} border ${t.border} rounded-full text-xs font-bold shadow-sm active:scale-95`}>+ 新增帳單</button></div>
                    {data.bills.length === 0 ? (<div className={`py-16 text-center text-sm font-bold ${t.textM} ${t.cardInner} rounded-3xl border ${t.border} shadow-sm`}>沒有固定帳單</div>) : data.bills.map(b => (
                      <div key={b.id} className={`p-5 rounded-[2rem] flex justify-between items-center border ${t.border} ${t.cardInner} shadow-sm transition-all ${b.isPaid ? 'opacity-50 grayscale' : ''}`}>
                        <div className="flex gap-4 items-center"><div className={`text-3xl ${t.bg} w-14 h-14 flex justify-center items-center rounded-full shadow-sm`}>{b.icon}</div><div><div className="font-bold text-base">{b.name}</div><div className={`text-xs font-bold mt-1 ${b.isPaid ? t.textM : 'text-rose-500'}`}>{b.isPaid ? '已繳' : `每月 ${b.dueDate} 號`}</div></div></div>
                        <div className="flex gap-3 items-center"><span className="font-black text-xl">${b.amount}</span>{!b.isPaid && (<button onClick={() => confirmAction(`確認繳交【${b.name}】？將自動記一筆支出`, () => { updateDoc(getDocRef('shared_bills', b.id), {isPaid: true}); const targetAccountId = 'acc_joint'; addDoc(getCol('shared_ledger'), { type: 'expense', amount: b.amount, category: b.category, note: `${b.name} (自動繳納)`, accountId: targetAccountId, payer: 'joint', split: 'none', date: getLocalYYYYMMDD(new Date()), month: getLocalYYYYMM(new Date()), recordTime: getLocalHHmm(new Date()), createdAt: serverTimestamp() }); })} className={`p-3 rounded-full ${t.primary} text-white shadow-md active:scale-90`}><Check className="w-5 h-5"/></button>)}<button onClick={() => confirmAction('確定刪除此帳單？', () => deleteDoc(getDocRef('shared_bills', b.id)))} className={`p-2 ${t.textM} hover:text-red-500 transition-colors rounded-full`}><Trash2 className="w-4 h-4"/></button></div>
                      </div>
                    ))}
                  </div>
                )}
                {ui.subTab === 'shopping' && (
                  <div className="space-y-4">
                    <form onSubmit={e => { e.preventDefault(); const v = e.target.item.value.trim(); if(v) { addDoc(getCol('shared_shopping'), {text: v, completed: false, createdAt: serverTimestamp()}); e.target.reset(); }}} className="flex gap-3 mb-6"><input name="item" placeholder="新增待買物品..." className={`flex-1 px-5 py-4 rounded-2xl border ${t.border} ${t.cardInner} font-bold text-sm shadow-sm focus:outline-none focus:ring-2 ${t.ring}`}/><button type="submit" className={`px-6 rounded-2xl ${t.primary} text-white shadow-md active:scale-95`}><Plus className="w-5 h-5"/></button></form>
                    {data.shopping.length === 0 ? (<div className={`py-16 text-center text-sm font-bold ${t.textM} ${t.cardInner} rounded-[2rem] border ${t.border} shadow-sm`}>購物清單空空如也！</div>) : data.shopping.map(s => (
                      <div key={s.id} className={`p-4 rounded-2xl flex justify-between items-center border ${t.border} ${t.cardInner} shadow-sm transition-all`}><div className="flex gap-3 items-center flex-1 cursor-pointer" onClick={() => updateDoc(getDocRef('shared_shopping', s.id), {completed: !s.completed})}><CheckCircle2 className={`w-6 h-6 ${s.completed ? 'text-emerald-500' : t.textM}`}/><span className={`font-bold text-sm ${s.completed ? 'line-through opacity-50' : t.text}`}>{s.text}</span></div><button onClick={() => confirmAction('刪除物品？', () => deleteDoc(getDocRef('shared_shopping', s.id)))} className={`p-2 ${t.textM} hover:text-red-500 rounded-full`}><Trash2 className="w-4 h-4"/></button></div>
                    ))}
                  </div>
                )}
                {ui.subTab === 'notes' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-6 px-2"><div><h3 className="text-xl font-black">共同記事</h3><p className={`text-xs font-bold ${t.textM} mt-1`}>記錄生活大小事</p></div><button onClick={() => updateUi({ modal: 'note', selectedItem: null })} className={`px-4 py-2.5 ${t.primary} text-white rounded-full text-xs font-bold shadow-md active:scale-95`}>+ 新增筆記</button></div>
                    <div className="grid grid-cols-2 gap-4">
                      {data.notes.map(n => (<div key={n.id} onClick={() => updateUi({ selectedItem: n, modal: 'note' })} className={`bg-[#FEF0C7] text-[#6B4E31] border border-[#E9C46A] rounded-[2rem] p-5 cursor-pointer min-h-[160px] relative shadow-md hover:shadow-lg transition-all flex flex-col`}><h4 className={`font-extrabold text-base mb-2 line-clamp-2`}>{n.title}</h4><p className={`text-xs opacity-80 line-clamp-4 font-bold leading-relaxed flex-1`}>{n.content}</p><Edit3 className="absolute bottom-4 right-4 w-4 h-4 opacity-30" /></div>))}
                    </div>
                  </div>
                )}
                {ui.subTab === 'events' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-6 px-2"><div><h3 className="text-xl font-black">重要日子</h3><p className={`text-xs font-bold ${t.textM} mt-1`}>紀念日倒數</p></div><button onClick={() => updateUi({ modal: 'event' })} className={`px-4 py-2.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-full text-xs font-bold shadow-sm active:scale-95`}>+ 新增日子</button></div>
                    {data.events.length === 0 ? (<div className={`py-16 text-center text-sm font-bold ${t.textM} ${t.cardInner} rounded-[2rem] border ${t.border} shadow-sm`}>還沒有設定重要的日子喔！</div>) : data.events.map(e => { 
                      const d = calculateDaysDiff(e.date); const isToday = d === 0;
                      return (<div key={e.id} className={`p-5 rounded-[2rem] flex justify-between items-center border ${t.border} ${t.cardInner} shadow-sm ${isToday ? 'bg-rose-500/5 border-rose-500/30' : ''}`}><div className="flex gap-4 items-center"><div className="text-3xl bg-rose-500/10 w-14 h-14 flex items-center justify-center rounded-full shadow-sm">{e.icon}</div><div><div className={`font-extrabold text-base ${isToday ? 'text-rose-500' : t.text}`}>{e.title}</div><div className={`text-xs font-bold mt-1 ${isToday ? 'text-rose-500/70' : t.textM}`}>{e.date}</div></div></div><div className="flex items-center gap-3"><span className={`font-black text-2xl ${isToday ? 'text-rose-500 animate-pulse' : t.primaryText}`}>{isToday ? '今天' : `${Math.abs(d)} 天`}</span><button onClick={() => confirmAction('刪除日子？', () => deleteDoc(getDocRef('shared_events', e.id)))} className={`p-2 ${t.textM} hover:text-red-500 rounded-full`}><Trash2 className="w-4 h-4"/></button></div></div>)
                    })}
                  </div>
                )}
                {ui.subTab === 'goals' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                 <div className="flex justify-between items-center px-2"><h2 className="text-xl font-black">夢想撲滿</h2><button onClick={() => updateUi({ modal: 'goal' })} className={`text-xs font-bold ${t.cardInner} border ${t.border} px-4 py-2.5 rounded-full shadow-sm active:scale-95`}>+ 新增願望</button></div>
                 <div className="grid grid-cols-1 gap-5">
                  {data.goals.length === 0 ? (<div className={`${t.cardInner} p-12 rounded-[2rem] border ${t.border} text-center shadow-sm font-bold`}><Target className={`w-14 h-14 ${t.textM} mx-auto mb-4 opacity-50`} /><p className={`text-sm ${t.textM}`}>還沒有設定存錢目標喔！</p></div>) : data.goals.map(g => {
                    const prog = Math.min((g.currentAmount / g.targetAmount) * 100, 100); const isOk = prog >= 100;
                    return (<div key={g.id} className={`p-6 rounded-[2.5rem] border ${t.border} ${t.cardInner} shadow-md relative overflow-hidden group`}><div className="flex justify-between items-center mb-5 pr-8"><div className="font-extrabold text-xl flex items-center gap-2">{isOk ? '🎉' : '🎯'} {g.title}</div><div className={`text-xs font-black text-white ${isOk ? 'bg-emerald-500' : t.primary} px-3 py-1.5 rounded-lg shadow-sm`}>{prog.toFixed(0)}%</div></div><div className="flex justify-between items-end mb-4"><span className="text-4xl font-black">${g.currentAmount.toLocaleString()}</span><span className={`text-sm font-bold ${t.textM}`}>/ ${g.targetAmount.toLocaleString()}</span></div><div className={`h-3.5 w-full ${t.bg} rounded-full overflow-hidden mb-6 shadow-inner`}><div className={`h-full rounded-full transition-all duration-1000 ease-out ${isOk ? 'bg-emerald-500' : t.primary}`} style={{ width: `${prog}%` }}></div></div>{!isOk && (<button onClick={() => updateUi({ modal: 'fund', selectedItem: g })} className={`w-full py-4 ${t.bg} font-black text-sm rounded-2xl flex justify-center items-center gap-2 active:scale-95 border ${t.border} shadow-sm hover:opacity-80 transition-opacity`}><Coins className={`w-5 h-5 ${t.primaryText}`} /> 存入資金</button>)}<button onClick={() => confirmAction(`確定要永久刪除目標【${g.title}】嗎？`, () => deleteDoc(getDocRef('shared_goals', g.id)), '刪除')} className={`absolute top-6 right-5 p-2 ${t.textM} hover:bg-rose-500 hover:text-white rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all z-10`}><Trash2 className="w-4 h-4"/></button></div>)
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

          {/* ================= 彈出視窗 (Modals) ================= */}
          {ui.modal && (
            <div className="fixed inset-0 z-[50] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
              <div className={`w-full max-w-md md:max-w-xl ${t.cardInner} rounded-t-[2.5rem] sm:rounded-[2.5rem] pt-6 px-6 pb-0 border ${t.border} max-h-[96vh] flex flex-col shadow-2xl overflow-hidden`}>
                
                {ui.modal !== 'tx' && ui.modal !== 'aiChat' && (
                  <div className="flex justify-between items-center mb-6 shrink-0 px-2">
                    <h3 className="font-black text-2xl flex items-center gap-2">
                      {ui.modal === 'settings' && <Settings className={`w-6 h-6 ${t.textM}`}/>}
                      {ui.modal === 'barcode' && <Barcode className={`w-6 h-6 ${t.textM}`}/>}
                      {ui.modal === 'notify' && <Bell className={`w-6 h-6 ${t.textM}`}/>}
                      {ui.modal === 'settings' ? '設定與管理' : ui.modal === 'barcode' ? '發票載具' : ui.modal === 'notify' ? '推播與通知' : ''}
                    </h3>
                    <button onClick={() => updateUi({ modal: null, selectedTx: null })} className={`p-2.5 ${t.bg} rounded-full hover:opacity-80 active:scale-95`}><X className={`w-6 h-6 ${t.textM}`}/></button>
                  </div>
                )}
                
                {/* 彈窗內容區塊 */}
                <div className={`flex-1 overflow-y-auto hide-scrollbar pb-safe ${ui.modal === 'tx' || ui.modal === 'aiChat' ? '-mx-6 -mt-6' : ''}`}>
                  {ui.modal === 'tx' && (
                    <TxForm 
                      accounts={activeAccounts} cats={{expense: EXPENSE_CATEGORIES, income: INCOME_CATEGORIES}} tags={data.tags} initialData={ui.selectedTx} 
                      templates={data.templates} settings={settings} allTxs={data.tx}
                      onAI={() => updateUi({ modal: 'aiChat' })} onAddTag={handleAddGlobalTag}
                      onSaveTemplate={(tpl) => setDoc(doc(getCol('shared_templates')), {...tpl, createdAt: serverTimestamp()}).then(()=>showToast('範本已儲存'))}
                      onDeleteTemplate={(id) => deleteDoc(getDocRef('shared_templates', id)).then(()=>showToast('範本已移除'))}
                      onClose={() => updateUi({ modal: null, selectedTx: null })}
                      onSave={async (txData) => { 
                        const { id, recordDate, recordTime, ...payload } = txData;
                        payload.updatedAt = serverTimestamp();
                        payload.date = recordDate || getLocalYYYYMMDD(ui.date);
                        payload.month = payload.date.substring(0, 7);
                        payload.recordTime = recordTime || getLocalHHmm(new Date());
                        Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
                        try {
                          if(id) await updateDoc(getDocRef('shared_ledger', id), payload);
                          else { payload.createdAt = serverTimestamp(); payload.createdBy = user ? user.uid : 'unknown'; await addDoc(getCol('shared_ledger'), payload); }
                          updateUi({ modal: null, selectedTx: null }); showToast('記帳成功');
                        } catch(e) { showToast(`儲存失敗: ${e.message}`, "error"); }
                      }} t={t} ui={ui}
                    />
                  )}
                  {ui.modal === 'aiChat' && (
                    <AIChatForm 
                      cats={{expense: EXPENSE_CATEGORIES, income: INCOME_CATEGORIES}} accounts={activeAccounts} onBack={() => updateUi({ modal: 'tx' })} 
                      onSave={async (txData) => {
                        const { recordDate, recordTime, ...payload } = txData;
                        payload.date = recordDate || getLocalYYYYMMDD(ui.date); payload.month = payload.date.substring(0, 7);
                        payload.recordTime = recordTime || getLocalHHmm(new Date()); payload.createdAt = serverTimestamp(); payload.createdBy = user ? user.uid : 'unknown';
                        try { await addDoc(getCol('shared_ledger'), payload); updateUi({ modal: null }); showToast('AI 記帳成功'); } catch(e) { showToast(`失敗: ${e.message}`, 'error'); }
                      }} 
                      showToast={showToast} t={t} ui={ui} apiKey={apiKey}
                    />
                  )}
                  {ui.modal === 'date' && (
                    <div className="space-y-6">
                      <div className={`flex ${t.bg} p-1.5 rounded-2xl border ${t.border}`}><button onClick={() => updateUi({dateFilterMode: 'month'})} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${ui.dateFilterMode === 'month' ? `${t.cardInner} shadow-sm ${t.text}` : t.textM}`}>單月</button><button onClick={() => updateUi({dateFilterMode: 'year'})} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${ui.dateFilterMode === 'year' ? `${t.cardInner} shadow-sm ${t.text}` : t.textM}`}>年度</button><button onClick={() => updateUi({dateFilterMode: 'custom'})} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${ui.dateFilterMode === 'custom' ? `${t.cardInner} shadow-sm ${t.text}` : t.textM}`}>自訂</button></div>
                      {ui.dateFilterMode === 'month' && (<div className="grid grid-cols-3 gap-3">{Array.from({length:12}).map((_,i) => (<button key={i} onClick={() => { updateUi({ date: new Date(ui.date.getFullYear(), i, 1), modal: null }); }} className={`py-5 rounded-2xl font-bold border text-lg active:scale-95 transition-all ${ui.date.getMonth()===i ? `${t.primary} text-white border-transparent shadow-md` : `${t.bg} ${t.border}`}`}>{i+1}月</button>))}</div>)}
                      {ui.dateFilterMode === 'custom' && (<div className="space-y-4"><div><label className={`block text-sm font-bold ${t.textM} mb-2`}>開始日期</label><input type="date" value={getLocalYYYYMMDD(ui.date)} onChange={e => updateUi({date: new Date(e.target.value)})} className={`w-full p-4 rounded-xl ${t.bg} border ${t.border} font-bold outline-none focus:ring-2 ${t.ring}`} /></div><div><label className={`block text-sm font-bold ${t.textM} mb-2`}>結束日期</label><input type="date" value={getLocalYYYYMMDD(ui.endDate || new Date())} onChange={e => updateUi({endDate: new Date(e.target.value)})} className={`w-full p-4 rounded-xl ${t.bg} border ${t.border} font-bold outline-none focus:ring-2 ${t.ring}`} /></div><button onClick={() => updateUi({modal: null})} className={`w-full py-4 rounded-2xl font-bold text-lg text-white shadow-md ${t.primary} active:scale-95`}>套用區間</button></div>)}
                      {ui.dateFilterMode === 'year' && (<div className="flex justify-center items-center gap-6 py-10"><button onClick={() => updateUi({date: new Date(ui.date.getFullYear() - 1, 0, 1)})} className={`p-4 rounded-full ${t.bg} shadow-sm border ${t.border}`}><ChevronLeft className="w-6 h-6"/></button><span className="text-4xl font-black">{ui.date.getFullYear()}</span><button onClick={() => updateUi({date: new Date(ui.date.getFullYear() + 1, 0, 1)})} className={`p-4 rounded-full ${t.bg} shadow-sm border ${t.border}`}><ChevronRight className="w-6 h-6"/></button></div>)}
                    </div>
                  )}
                  {ui.modal === 'settings' && (<SettingsForm settings={settings} onSave={(s) => { setDoc(getDocRef('shared_settings', 'main'), s, {merge:true}); showToast('設定已儲存'); updateUi({modal:null}); }} onExport={handleExportToSheets} onRecurring={() => updateUi({ modal: 'recurring' })} t={t} />)}
                  {ui.modal === 'recurring' && (<RecurringForm rules={data.recurringRules} accounts={activeAccounts} cats={{expense: EXPENSE_CATEGORIES, income: INCOME_CATEGORIES}} onSave={r => { addDoc(getCol('recurring_rules'), r); showToast('規則建立成功'); }} onDelete={id => confirmAction('刪除此規則？', () => deleteDoc(getDocRef('recurring_rules', id)))} t={t} />)}
                  {ui.modal === 'barcode' && (<BarcodeForm codes={{h:settings.husbandBarcode, w:settings.wifeBarcode}} onSave={(h, w) => { setDoc(getDocRef('shared_settings', 'main'), {husbandBarcode:h, wifeBarcode:w}, {merge:true}); showToast('載具已儲存'); }} t={t} />)}
                  
                  {ui.modal === 'notify' && (
                    <div className="space-y-4">
                      {activeAlerts.length === 0 ? (
                        <div className={`flex flex-col items-center justify-center py-16 text-center ${t.textM}`}>
                          <Bell className="w-16 h-16 mb-4 opacity-50" />
                          <span className="font-bold text-lg">目前沒有任何新通知 🎉</span>
                        </div>
                      ) : activeAlerts.map(a => (
                        <div key={a.id} className={`flex items-center gap-4 p-5 rounded-3xl border ${t.border} ${t.bg} relative shadow-sm`}>
                          <div className={`w-14 h-14 rounded-full ${t.cardInner} flex items-center justify-center text-3xl shadow-sm shrink-0`}>
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
                    <AccForm onSave={d => { addDoc(getCol('shared_accounts'), {...d, createdAt: serverTimestamp(), archived: false}); updateUi({modal:null}); showToast('帳戶建立成功'); }} t={t} />
                  )}
                  {ui.modal === 'bill' && (
                    <BillForm onSave={d => { addDoc(getCol('shared_bills'), {...d, isPaid: false, createdAt: serverTimestamp()}); updateUi({modal:null}); showToast('帳單建立成功'); }} t={t} />
                  )}
                  {ui.modal === 'note' && (
                    <NoteForm 
                      data={ui.selectedItem} 
                      onSave={d => {
                        const { id, ...payload } = d;
                        payload.updatedAt = serverTimestamp();
                        Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
                        if (id) updateDoc(getDocRef('shared_notes', id), payload).then(()=>{updateUi({modal:null}); showToast('修改成功');});
                        else { payload.createdAt = serverTimestamp(); addDoc(getCol('shared_notes'), payload).then(()=>{updateUi({modal:null}); showToast('新增成功');}); }
                      }} 
                      onDelete={id => confirmAction('刪除筆記？', () => deleteDoc(getDocRef('shared_notes', id)))} 
                      t={t} 
                    />
                  )}
                  {ui.modal === 'event' && (
                    <EventForm onSave={d => { addDoc(getCol('shared_events'), {...d, createdAt: serverTimestamp()}); updateUi({modal:null}); showToast('建立成功'); }} t={t} />
                  )}
                  {ui.modal === 'goal' && (
                    <GoalForm onSave={d => { addDoc(getCol('shared_goals'), {...d, currentAmount: 0, createdAt: serverTimestamp()}); updateUi({modal:null}); showToast('目標建立成功'); }} t={t} />
                  )}
                  {ui.modal === 'fund' && (
                    <FundForm goal={ui.selectedItem} onSave={amt => { updateDoc(getDocRef('shared_goals', ui.selectedItem.id), {currentAmount: ui.selectedItem.currentAmount + amt}); updateUi({modal:null}); showToast('存入成功'); }} t={t} />
                  )}
                  {ui.modal === 'tags' && (
                    <div className="space-y-5">
                      <div className="flex flex-wrap gap-2">
                        {data.tags.map(tag => (
                          <button key={tag} onClick={() => updateUi({filterTags: ui.filterTags.includes(tag) ? ui.filterTags.filter(x=>x!==tag) : [...ui.filterTags,tag]})} className={`px-4 py-2.5 rounded-xl text-sm font-bold border-2 ${ui.filterTags.includes(tag) ? `${t.primary} text-white border-transparent shadow-sm` : `${t.bg} ${t.border}`}`}>
                            #{tag}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => updateUi({filterTags:[], modal:null})} className={`w-full py-4 rounded-2xl font-bold text-lg ${t.bg} active:scale-95`}>清除篩選 / 確認</button>
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
