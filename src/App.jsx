import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, Info, Settings2, Edit3, Loader2, LogIn, LogOut, User, WifiOff, RefreshCw, Zap, Sun, Moon, Monitor, Crown } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  onSnapshot, 
  setDoc
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';

/**
 * 极简时光方块应用 - 多主题集成版 (大圣金更新)
 * 主题：极简白 (Default), 深夜磨砂, 赛博朋克, 大圣金
 */

// --- Firebase 配置 ---
const firebaseConfig = {
  apiKey: "AIzaSyBteB_oDfAF1Jyanqs1fH-qRIYobSh_Vlk",
  authDomain: "reactapp-50bdf.firebaseapp.com",
  projectId: "reactapp-50bdf",
  storageBucket: "reactapp-50bdf.firebasestorage.app",
  messagingSenderId: "1075711094046",
  appId: "1:1075711094046:web:79dd853325dfbf048c2d0f"
};

let firebaseApp, auth, db, provider;
try {
  firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
  provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
} catch (e) { console.error("Firebase Init Error", e); }

const APP_STORAGE_KEY = 'wukong_time_blocks_data';
const THEME_STORAGE_KEY = 'wukong_time_blocks_theme';
const FIRESTORE_APP_ID = 'time-blocks-app';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // 主题状态：minimalist, midnight, cyberpunk, wukongGold
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_STORAGE_KEY) || 'minimalist');

  const [topic, setTopic] = useState('时光倒计时');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });

  // 切换主题并保存
  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  };

  // 1. 网络与认证逻辑
  useEffect(() => {
    const networkTimeout = setTimeout(() => {
      if (loading) {
        setIsOfflineMode(true);
        setLoading(false);
        loadFromLocal();
      }
    }, 3500);

    getRedirectResult(auth).then((result) => {
      if (result?.user) { setUser(result.user); setIsOfflineMode(false); }
    }).catch(() => setIsOfflineMode(true));

    const unsubscribe = onAuthStateChanged(auth, async (currUser) => {
      clearTimeout(networkTimeout);
      if (currUser) {
        setUser(currUser);
        setIsOfflineMode(false);
      } else {
        try { await signInAnonymously(auth); } catch (e) { setIsOfflineMode(true); }
      }
      setLoading(false);
    });
    return () => { unsubscribe(); clearTimeout(networkTimeout); };
  }, []);

  // 2. 数据同步
  useEffect(() => {
    if (!user || isOfflineMode || loading) return;
    const docRef = doc(db, 'artifacts', FIRESTORE_APP_ID, 'users', user.uid, 'settings', 'config');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.topic) setTopic(data.topic);
        if (data.startDate) setStartDate(data.startDate);
        if (data.targetDate) setTargetDate(data.targetDate);
        saveToLocal(data);
      }
    }, () => setIsOfflineMode(true));
    return () => unsubscribe();
  }, [user, isOfflineMode, loading]);

  // 3. 自动保存
  useEffect(() => {
    if (loading) return;
    const dataToSave = { topic, startDate, targetDate };
    saveToLocal(dataToSave);
    if (!isOfflineMode && user) {
      const saveDataCloud = async () => {
        setIsSaving(true);
        try {
          const docRef = doc(db, 'artifacts', FIRESTORE_APP_ID, 'users', user.uid, 'settings', 'config');
          await setDoc(docRef, { ...dataToSave, updatedAt: new Date().toISOString() }, { merge: true });
        } catch (e) { console.warn("Cloud save failed"); }
        finally { setTimeout(() => setIsSaving(false), 600); }
      };
      const tid = setTimeout(saveDataCloud, 1000);
      return () => clearTimeout(tid);
    }
  }, [topic, startDate, targetDate, user, isOfflineMode, loading]);

  const saveToLocal = (data) => { try { localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(data)); } catch (e) {} };
  const loadFromLocal = () => {
    try {
      const saved = localStorage.getItem(APP_STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.topic) setTopic(data.topic);
        if (data.startDate) setStartDate(data.startDate);
        if (data.targetDate) setTargetDate(data.targetDate);
      }
    } catch (e) {}
  };

  const handleLogin = async () => {
    try {
      if (/Mobi|Android|iPhone/i.test(navigator.userAgent)) await signInWithRedirect(auth, provider);
      else await signInWithPopup(auth, provider);
    } catch (err) { setIsOfflineMode(true); }
  };

  const handleLogout = async () => { await signOut(auth); setUser(null); };

  const stats = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(targetDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const totalDays = Math.max(0, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    let passedDays = Math.ceil((today - start) / (1000 * 60 * 60 * 24));
    if (passedDays < 0) passedDays = 0;
    if (passedDays > totalDays) passedDays = totalDays;
    return { totalDays, passedDays, remainingDays: totalDays - passedDays };
  }, [startDate, targetDate]);

  // 根据主题获取样式
  const getThemeStyles = () => {
    switch (theme) {
      case 'midnight':
        return {
          bg: 'bg-[#09090B]', text: 'text-white',
          card: 'bg-white/5 backdrop-blur-3xl border-white/10 shadow-2xl',
          dotPassed: 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.4)]',
          dotFuture: 'bg-white/10',
          accent: 'bg-white text-black',
          subText: 'text-zinc-500',
          input: 'bg-black/40 border-white/5 text-white'
        };
      case 'cyberpunk':
        return {
          bg: 'bg-[#050505]', text: 'text-white font-mono',
          card: 'bg-zinc-900/40 border-zinc-800 border-l-pink-500 border-l-2 shadow-[inset_0_0_20px_rgba(255,255,255,0.02)]',
          dotPassed: 'bg-pink-500 shadow-[0_0_10px_#ff0055] rounded-none',
          dotFuture: 'bg-transparent border border-cyan-400/20 rounded-none',
          accent: 'bg-pink-500 text-black shadow-[0_0_15px_#ff0055] font-black italic',
          subText: 'text-cyan-400 font-black italic',
          input: 'bg-black border-zinc-800 text-cyan-400'
        };
      case 'wukongGold':
        return {
          bg: 'bg-[#0A0A0A]', text: 'text-[#EAB308]',
          card: 'bg-[#171717] border-[#854D0E]/30 shadow-[0_0_40px_rgba(133,77,14,0.1)]',
          dotPassed: 'bg-[#EAB308] shadow-[0_0_15px_#EAB308]',
          dotFuture: 'bg-[#262626]',
          accent: 'bg-[#EAB308] text-black font-bold shadow-[0_0_20px_rgba(234,179,8,0.3)]',
          subText: 'text-[#854D0E]',
          input: 'bg-[#171717] border-[#854D0E]/20 text-white'
        };
      default: // minimalist
        return {
          bg: 'bg-[#F5F5F7]', text: 'text-[#1D1D1F]',
          card: 'bg-white border-gray-100 shadow-[0_30px_60px_rgba(0,0,0,0.02)]',
          dotPassed: 'bg-[#FF3B30] shadow-[0_2px_8px_rgba(255,59,48,0.15)]',
          dotFuture: 'bg-[#F2F2F7]',
          accent: 'bg-black text-white shadow-xl shadow-black/10',
          subText: 'text-gray-400',
          input: 'bg-white border-gray-100 text-black shadow-inner'
        };
    }
  };

  const s = getThemeStyles();

  if (loading && !user) return (
    <div className={`min-h-screen ${s.bg} flex items-center justify-center`}>
      <Loader2 className={`w-8 h-8 animate-spin ${s.subText}`} />
    </div>
  );

  return (
    <div className={`min-h-screen ${s.bg} ${s.text} p-4 md:p-8 flex flex-col items-center overflow-x-hidden transition-colors duration-700`}>
      
      {/* 赛博扫描线效果 */}
      {theme === 'cyberpunk' && <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 4px, 3px 100%' }}></div>}

      {/* 离线通知 */}
      {isOfflineMode && (
        <div className="w-full max-w-4xl mb-4 bg-amber-500/10 border border-amber-500/20 backdrop-blur-xl rounded-2xl p-3 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2 text-amber-500 text-[10px] font-bold uppercase tracking-widest">
            <WifiOff className="w-3.5 h-3.5" /> 离线模式
          </div>
          <button onClick={() => window.location.reload()} className="bg-amber-500/20 text-amber-200 px-2 py-1 rounded-lg text-[9px] font-bold">重连</button>
        </div>
      )}

      {/* Header */}
      <header className="w-full max-w-4xl flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${theme === 'minimalist' ? 'bg-black' : 'bg-white'} rounded-xl flex items-center justify-center shadow-lg`}>
            <Clock className={`${theme === 'minimalist' ? 'text-white' : 'text-black'} w-6 h-6`} />
          </div>
          <div className="flex flex-col">
            <h1 className={`text-xl font-bold tracking-tight ${theme === 'cyberpunk' ? 'italic uppercase drop-shadow-[2px_2px_0px_#ff0055]' : ''}`}>{topic}</h1>
            <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${s.subText}`}>
              {isOfflineMode ? 'LOCAL' : (user?.isAnonymous ? 'TEMP' : 'SYNC')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 ${s.card} p-1 md:pl-3 rounded-full border`}>
            {user && !user.isAnonymous ? (
              <>
                <div className="hidden sm:flex flex-col items-end pr-1 text-right">
                  <span className="text-[10px] font-bold leading-none">{user.displayName?.split(' ')[0]}</span>
                  <button onClick={handleLogout} className={`text-[9px] ${s.subText} font-bold uppercase mt-1`}>登出</button>
                </div>
                <img src={user.photoURL} alt="User" onClick={() => window.innerWidth < 640 && handleLogout()} className="w-7 h-7 rounded-full object-cover cursor-pointer" />
              </>
            ) : (
              <button onClick={handleLogin} className={`flex items-center gap-1.5 px-3 py-1 text-[10px] md:text-xs font-bold ${s.subText} hover:text-white transition-all`}>
                <LogIn className="w-3.5 h-3.5" /> <span className="hidden xs:inline">登录</span>
              </button>
            )}
          </div>
          <button onClick={() => setShowSettings(!showSettings)} className={`p-3 rounded-full transition-all border ${showSettings ? (theme === 'minimalist' ? 'bg-black text-white' : 'bg-white text-black') : s.card}`}>
            <Settings2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 主题切换标签 - 4个标签 */}
      <div className="w-full max-w-4xl mb-8 flex justify-center">
        <div className={`flex p-1 rounded-2xl ${s.card} border gap-1 overflow-x-auto no-scrollbar`}>
          <button onClick={() => handleThemeChange('minimalist')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${theme === 'minimalist' ? 'bg-black text-white shadow-lg' : 'hover:bg-gray-100 text-gray-400'}`}>
            <Sun className="w-3.5 h-3.5" /> 极简白
          </button>
          <button onClick={() => handleThemeChange('midnight')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${theme === 'midnight' ? 'bg-white text-black shadow-lg' : 'hover:bg-white/5 text-zinc-500'}`}>
            <Moon className="w-3.5 h-3.5" /> 深夜磨砂
          </button>
          <button onClick={() => handleThemeChange('cyberpunk')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${theme === 'cyberpunk' ? 'bg-pink-500 text-black shadow-[0_0_15px_#ff0055]' : 'hover:bg-white/5 text-cyan-400'}`}>
            <Zap className="w-3.5 h-3.5" /> 赛博朋克
          </button>
          <button onClick={() => handleThemeChange('wukongGold')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${theme === 'wukongGold' ? 'bg-[#EAB308] text-black shadow-lg shadow-[#EAB308]/20' : 'hover:bg-white/5 text-[#854D0E]'}`}>
            <Crown className="w-3.5 h-3.5" /> 大圣金
          </button>
        </div>
      </div>

      {/* 设置面板 */}
      {showSettings && (
        <div className={`w-full max-w-2xl mb-8 ${s.card} border rounded-[2rem] p-6 md:p-8 animate-in fade-in slide-in-from-top-4`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className={`text-[10px] font-bold ${s.subText} ml-1 uppercase tracking-widest flex items-center gap-1.5`}><Edit3 className="w-3 h-3" /> 名称</label>
              <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} className={`w-full rounded-xl px-4 py-2.5 text-sm outline-none ${s.input}`} />
            </div>
            <div className="space-y-1.5">
              <label className={`text-[10px] font-bold ${s.subText} ml-1 uppercase tracking-widest flex items-center gap-1.5`}><Calendar className="w-3 h-3" /> 起始</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`w-full rounded-xl px-4 py-2.5 text-sm outline-none ${s.input} [color-scheme:${theme === 'minimalist' ? 'light' : 'dark'}]`} />
            </div>
            <div className="space-y-1.5">
              <label className={`text-[10px] font-bold ${s.subText} ml-1 uppercase tracking-widest flex items-center gap-1.5`}><Calendar className="w-3 h-3" /> 目标</label>
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={`w-full rounded-xl px-4 py-2.5 text-sm outline-none ${s.input} [color-scheme:${theme === 'minimalist' ? 'light' : 'dark'}]`} />
            </div>
          </div>
        </div>
      )}

      {/* 主展示区 */}
      <main className={`w-full max-w-4xl ${s.card} border rounded-[2rem] md:rounded-[3.5rem] p-6 md:p-16 flex flex-col items-center relative overflow-hidden transition-all duration-500`}>
        {theme === 'cyberpunk' && (
          <>
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400"></div>
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-pink-500"></div>
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-pink-500"></div>
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-cyan-400"></div>
          </>
        )}

        <div className="w-full flex flex-wrap gap-1.5 md:gap-2.5 justify-center mb-10 md:mb-16 max-h-[35vh] md:max-h-[45vh] overflow-y-auto no-scrollbar py-2 px-1">
          {Array.from({ length: stats.totalDays }).map((_, i) => (
            <div key={i} className={`w-2.5 h-2.5 md:w-5 md:h-5 transition-all duration-1000 ${i < stats.passedDays ? s.dotPassed : s.dotFuture}`} />
          ))}
        </div>

        <div className="w-full pt-4 text-center flex flex-col items-center">
          <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-full mb-8 select-none transition-all ${s.accent}`}>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{topic}</span>
          </div>
          
          <div className="flex items-baseline justify-center gap-2 md:gap-4 select-none">
            <span className={`text-7xl sm:text-8xl md:text-[11rem] font-black tracking-tighter tabular-nums leading-none ${theme === 'cyberpunk' ? 'glitch-text text-white drop-shadow-[0_0_10px_rgba(0,243,255,0.5)]' : ''}`}>
              {stats.remainingDays}
            </span>
            <span className={`text-lg md:text-2xl font-bold uppercase tracking-widest ${theme === 'cyberpunk' ? 'italic italic skew-x-[-10deg] text-zinc-700' : s.subText}`}>天</span>
          </div>

          <div className={`mt-10 md:mt-16 flex flex-wrap items-center justify-center gap-6 md:gap-10 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] select-none ${s.subText}`}>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${theme === 'minimalist' ? 'bg-[#FF3B30]' : (theme === 'wukongGold' ? 'bg-[#EAB308]' : (theme === 'cyberpunk' ? 'bg-pink-500' : 'bg-white'))}`} />
              <span>已过 {stats.passedDays}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full border border-gray-400" />
              <span>总计 {stats.totalDays}</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-16 text-center select-none pb-8">
        <p className={`text-[10px] uppercase tracking-[0.5em] font-medium opacity-30 ${theme === 'cyberpunk' ? 'text-pink-500' : (theme === 'wukongGold' ? 'text-[#EAB308]' : '')}`}>Time Fragments · wukong.lol</p>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: fadeIn 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        
        .glitch-text::before, .glitch-text::after {
          content: '${stats.remainingDays}';
          position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0.8;
        }
        .glitch-text::before { color: #00f3ff; z-index: -1; animation: glitch-anim 3s infinite linear alternate-reverse; }
        .glitch-text::after { color: #ff0055; z-index: -2; animation: glitch-anim2 2s infinite linear alternate-reverse; }
        
        @keyframes glitch-anim {
          0% { clip: rect(20px, 9999px, 50px, 0); transform: translate(-2px, -2px); }
          20% { clip: rect(80px, 9999px, 90px, 0); transform: translate(2px, 2px); }
          100% { clip: rect(10px, 9999px, 30px, 0); transform: translate(-1px, 1px); }
        }
        @keyframes glitch-anim2 {
          0% { clip: rect(60px, 9999px, 80px, 0); transform: translate(2px, 1px); }
          50% { clip: rect(10px, 9999px, 40px, 0); transform: translate(-2px, -1px); }
          100% { clip: rect(40px, 9999px, 100px, 0); transform: translate(1px, -2px); }
        }
      `}} />
    </div>
  );
}
