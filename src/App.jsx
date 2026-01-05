import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, Clock, Info, Settings2, Edit3, Loader2, LogIn, LogOut, User, WifiOff, RefreshCw } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  onSnapshot, 
  setDoc,
  enableNetwork,
  disableNetwork
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
 * 极简时光方块应用 - 强健网络版
 * 1. 增加 3.5s 响应超时检测，自动切入本地模式
 * 2. 离线时使用 localStorage 备份数据
 * 3. 针对移动端优化登录回调同步
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

// 安全初始化
let firebaseApp, auth, db, provider;
try {
  firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
  provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
} catch (e) {
  console.error("Firebase Init Error", e);
}

const APP_STORAGE_KEY = 'wukong_time_blocks_data';
const FIRESTORE_APP_ID = 'time-blocks-app';

export default function App() {
  // 基础状态
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // 应用配置状态
  const [topic, setTopic] = useState('我的时光目标');
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

  // 1. 网络与认证逻辑
  useEffect(() => {
    // 超时检测：如果 3.5s 还没加载完，强制切入本地模式
    const networkTimeout = setTimeout(() => {
      if (loading) {
        console.warn("网络连接超时，切换至本地模式");
        setIsOfflineMode(true);
        setLoading(false);
        loadFromLocal(); // 从本地缓存加载
      }
    }, 2500);

    // 处理移动端重定向登录结果
    getRedirectResult(auth).then((result) => {
      if (result?.user) {
        setUser(result.user);
        setIsOfflineMode(false);
      }
    }).catch(() => setIsOfflineMode(true));

    const unsubscribe = onAuthStateChanged(auth, async (currUser) => {
      clearTimeout(networkTimeout);
      if (currUser) {
        setUser(currUser);
        setIsOfflineMode(false);
      } else {
        try {
          await signInAnonymously(auth);
        } catch (e) {
          setIsOfflineMode(true);
        }
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      clearTimeout(networkTimeout);
    };
  }, []);

  // 2. 数据同步逻辑 (Firestore)
  useEffect(() => {
    if (!user || isOfflineMode || loading) return;

    const docRef = doc(db, 'artifacts', FIRESTORE_APP_ID, 'users', user.uid, 'settings', 'config');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.topic) setTopic(data.topic);
        if (data.startDate) setStartDate(data.startDate);
        if (data.targetDate) setTargetDate(data.targetDate);
        // 同时更新本地备份
        saveToLocal(data);
      }
    }, (err) => {
      console.error("Firestore sync error", err);
      setIsOfflineMode(true);
    });

    return () => unsubscribe();
  }, [user, isOfflineMode, loading]);

  // 3. 自动保存 (云端 + 本地)
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
        } catch (e) {
          console.warn("Cloud save failed, keeping local only");
        } finally {
          setTimeout(() => setIsSaving(false), 600);
        }
      };
      const tid = setTimeout(saveDataCloud, 1000);
      return () => clearTimeout(tid);
    }
  }, [topic, startDate, targetDate, user, isOfflineMode, loading]);

  // 本地存储辅助
  const saveToLocal = (data) => {
    try {
      localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  };

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

  // 交互逻辑
  const handleLogin = async () => {
    try {
      if (/Mobi|Android|iPhone/i.test(navigator.userAgent)) {
        await signInWithRedirect(auth, provider);
      } else {
        await signInWithPopup(auth, provider);
      }
    } catch (err) {
      setIsOfflineMode(true);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
  };

  // 计算逻辑
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

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans p-4 md:p-8 flex flex-col items-center overflow-x-hidden">
      
      {/* 状态通知栏 (仅在离线时显示) */}
      {isOfflineMode && (
        <div className="w-full max-w-4xl mb-4 bg-amber-50 border border-amber-100 rounded-2xl p-3 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-amber-700 text-[10px] font-bold uppercase tracking-wider">
            <WifiOff className="w-3.5 h-3.5" />
            无法连接云端，已切换至本地存储
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-1 text-[9px] bg-amber-200/50 hover:bg-amber-200 px-2 py-1 rounded-lg font-bold transition-all"
          >
            <RefreshCw className="w-3 h-3" /> 重试
          </button>
        </div>
      )}

      {/* Header */}
      <header className="w-full max-w-4xl flex justify-between items-center mb-6 md:mb-10">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="shrink-0 w-9 h-9 md:w-10 md:h-10 bg-black rounded-xl flex items-center justify-center shadow-lg">
            <Clock className="text-white w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div className="flex flex-col min-w-0">
            <h1 className="text-lg md:text-xl font-bold tracking-tight truncate max-w-[120px] sm:max-w-xs">{topic}</h1>
            <div className="flex items-center gap-1.5">
              <span className={`text-[9px] md:text-[10px] font-medium uppercase tracking-[0.2em] ${isOfflineMode ? 'text-amber-500' : 'text-gray-400'}`}>
                {isOfflineMode ? '离线模式' : (user?.isAnonymous ? '本地临时' : '云端同步')}
              </span>
              {isSaving && <Loader2 className="w-2.5 h-2.5 text-blue-400 animate-spin" />}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white p-1 md:p-1.5 md:pl-3 rounded-full shadow-sm border border-gray-100">
            {user && !user.isAnonymous ? (
              <>
                <div className="hidden sm:flex flex-col items-end pr-1 text-right">
                  <span className="text-[10px] font-bold text-gray-800 leading-none">{user.displayName?.split(' ')[0]}</span>
                  <button onClick={handleLogout} className="text-[9px] text-gray-400 hover:text-red-400 font-bold uppercase tracking-tighter">登出</button>
                </div>
                <img src={user.photoURL} alt="Avatar" onClick={() => window.innerWidth < 640 && handleLogout()} className="w-7 h-7 rounded-full object-cover shadow-inner cursor-pointer" />
              </>
            ) : (
              <button 
                onClick={handleLogin} 
                disabled={isOfflineMode}
                className={`flex items-center gap-1.5 px-3 py-1 text-[10px] md:text-xs font-bold transition-all ${isOfflineMode ? 'opacity-30' : 'text-gray-600 hover:text-black'}`}
              >
                <LogIn className="w-3.5 h-3.5" /> <span className="hidden xs:inline">登录</span>
              </button>
            )}
          </div>
          <button onClick={() => setShowSettings(!showSettings)} className={`p-2.5 md:p-3 rounded-full transition-all ${showSettings ? 'bg-black text-white' : 'bg-white text-gray-400'}`}>
            <Settings2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Settings */}
      {showSettings && (
        <div className="w-full max-w-2xl mb-8 bg-white/70 backdrop-blur-2xl border border-white/40 rounded-[2rem] p-6 md:p-8 shadow-2xl transition-all animate-in fade-in slide-in-from-top-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 ml-1 uppercase tracking-widest flex items-center gap-1.5"><Edit3 className="w-3 h-3" /> 目标</label>
              <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full bg-white border-none rounded-xl px-4 py-2.5 text-sm outline-none shadow-inner" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 ml-1 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3 h-3" /> 起始</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-white border-none rounded-xl px-4 py-2.5 text-sm outline-none shadow-inner" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 ml-1 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3 h-3" /> 结束</label>
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="w-full bg-white border-none rounded-xl px-4 py-2.5 text-sm outline-none shadow-inner" />
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="w-full max-w-4xl bg-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-16 shadow-[0_30px_60px_rgba(0,0,0,0.02)] border border-gray-100 flex flex-col items-center">
        {stats.totalDays === 0 ? (
          <div className="py-20 text-center"><p className="text-gray-300 font-medium tracking-widest uppercase text-xs">Waiting for setup...</p></div>
        ) : (
          <>
            <div className="w-full flex flex-wrap gap-1.5 md:gap-2 justify-center mb-10 md:mb-16 max-h-[35vh] md:max-h-[45vh] overflow-y-auto no-scrollbar py-2 px-1">
              {Array.from({ length: stats.totalDays }).map((_, i) => (
                <div key={i} className={`w-2.5 h-2.5 md:w-5 md:h-5 rounded-[2px] md:rounded-[5px] transition-all duration-1000 ${i < stats.passedDays ? 'bg-[#FF3B30] shadow-[0_2px_8px_rgba(255,59,48,0.15)]' : 'bg-[#F2F2F7]'}`} />
              ))}
            </div>

            <div className="w-full pt-4 text-center flex flex-col items-center">
              {/* 经典黑色胶囊风格 */}
              <div className="inline-flex items-center gap-2 px-5 py-2 bg-black text-white rounded-full mb-8 shadow-xl shadow-black/10 select-none transform transition-transform active:scale-95">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{topic}</span>
              </div>
              
              <div className="flex items-baseline justify-center gap-2 md:gap-4 select-none">
                <span className="text-7xl sm:text-8xl md:text-[10.5rem] font-extrabold tracking-tighter tabular-nums text-[#1D1D1F] leading-none">
                  {stats.remainingDays}
                </span>
                <span className="text-lg md:text-2xl font-bold text-gray-300 uppercase tracking-widest">天</span>
              </div>

              <div className="mt-12 md:mt-16 flex flex-wrap items-center justify-center gap-8 md:gap-12 text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] select-none">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#FF3B30] opacity-60" />
                  <span>已过去 {stats.passedDays}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gray-100 border border-gray-200" />
                  <span>总计 {stats.totalDays}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="mt-16 text-center opacity-30 select-none pb-8">
        <p className="text-[10px] uppercase tracking-[0.5em] font-medium">Time Fragments · wukong.lol</p>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: fadeIn 0.8s ease-out forwards; }
        @media (max-width: 400px) { .text-7xl { font-size: 4rem; } }
      `}} />
    </div>
  );
}