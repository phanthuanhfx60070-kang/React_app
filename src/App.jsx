import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, Info, Settings2, Edit3, Loader2, LogIn, LogOut, User, AlertCircle } from 'lucide-react';
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
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';

/**
 * 极简时光方块应用 - 生产环境配置版
 * 已接入用户指定的 Firebase 项目: reactapp-50bdf
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

// 初始化 Firebase
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const provider = new GoogleAuthProvider();

// 这里定义的 appId 需与 Firestore 安全规则中的路径一致
const appId = 'time-blocks-app';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState('我的时光目标');
  
  // 默认起始日期：今天往前 7 天
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
  
  const [showSettings, setShowSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 1. 认证监听 (Rule 3: 先认证再操作)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currUser) => {
      if (!currUser) {
        try {
          // 默认匿名登录，确保即使不点 Google 登录也能用
          await signInAnonymously(auth);
        } catch (err) {
          console.error("匿名登录失败:", err);
        }
      } else {
        setUser(currUser);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. 数据实时同步 (Rule 1 & 2)
  useEffect(() => {
    if (!user || !db || loading) return;
    
    // 路径: /artifacts/time-blocks-app/users/{uid}/settings/config
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config');
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.topic) setTopic(data.topic);
        if (data.startDate) setStartDate(data.startDate);
        if (data.targetDate) setTargetDate(data.targetDate);
      }
    }, (err) => {
      console.warn("读取数据受限，请确认 Firestore 安全规则已配置正确:", err);
    });

    return () => unsubscribe();
  }, [user, loading]);

  // 3. 自动保存 (仅限已登录或有修改时)
  useEffect(() => {
    if (!user || loading || !db) return;

    const saveData = async () => {
      setIsSaving(true);
      try {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config');
        await setDoc(docRef, {
          topic,
          startDate,
          targetDate,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.error("保存至云端失败:", err);
      } finally {
        setTimeout(() => setIsSaving(false), 800);
      }
    };

    const timeoutId = setTimeout(saveData, 1000); // 1秒防抖
    return () => clearTimeout(timeoutId);
  }, [topic, startDate, targetDate, user, loading]);

  // Google 登录
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Google 登录失败:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("退出登录失败:", err);
    }
  };

  // 核心计算逻辑
  const stats = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(targetDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalMs = end - start;
    const totalDays = Math.max(0, Math.ceil(totalMs / (1000 * 60 * 60 * 24)));

    const passedMs = today - start;
    let passedDays = Math.ceil(passedMs / (1000 * 60 * 60 * 24));
    
    if (passedDays < 0) passedDays = 0;
    if (passedDays > totalDays) passedDays = totalDays;

    return {
      totalDays,
      passedDays,
      remainingDays: totalDays - passedDays,
      isValid: totalDays > 0 && end > start
    };
  }, [startDate, targetDate]);

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans selection:bg-blue-100 p-4 md:p-8 flex flex-col items-center overflow-x-hidden">
      
      {/* 顶部导航 */}
      <header className="w-full max-w-4xl flex justify-between items-center mb-6 md:mb-10">
        <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
          <div className="shrink-0 w-9 h-9 md:w-10 md:h-10 bg-black rounded-xl flex items-center justify-center shadow-lg">
            <Clock className="text-white w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div className="flex flex-col min-w-0">
            <h1 className="text-lg md:text-xl font-bold tracking-tight truncate max-w-[120px] sm:max-w-[200px] md:max-w-xs">{topic}</h1>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] md:text-[10px] text-gray-400 font-medium uppercase tracking-[0.1em] md:tracking-[0.2em] whitespace-nowrap">
                {user?.isAnonymous ? '本地临时模式' : '云端同步中'}
              </span>
              {isSaving && <Loader2 className="w-2.5 h-2.5 text-blue-400 animate-spin shrink-0" />}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2">
          {/* 用户/登录按钮 */}
          <div className="flex items-center gap-1.5 md:gap-2 bg-white p-1 md:p-1.5 md:pl-3 rounded-full shadow-sm border border-gray-100 transition-all hover:shadow-md">
            {user && !user.isAnonymous ? (
              <>
                <div className="hidden sm:flex flex-col items-end pr-1">
                  <span className="text-[10px] font-bold text-gray-800 leading-none">{user.displayName?.split(' ')[0]}</span>
                  <button onClick={handleLogout} className="text-[9px] text-gray-400 hover:text-red-400 uppercase tracking-tighter font-bold">退出</button>
                </div>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="avatar" onClick={() => !window.matchMedia('(min-width: 640px)').matches && handleLogout()} className="w-7 h-7 rounded-full object-cover shadow-inner cursor-pointer" />
                ) : (
                  <div onClick={() => !window.matchMedia('(min-width: 640px)').matches && handleLogout()} className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center cursor-pointer"><User className="w-4 h-4 text-gray-400" /></div>
                )}
              </>
            ) : (
              <button onClick={handleLogin} className="flex items-center gap-1 md:gap-2 px-3 py-1 text-[10px] md:text-xs font-bold text-gray-600 hover:text-black transition-colors">
                <LogIn className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Google 登录</span>
              </button>
            )}
          </div>
          
          <button onClick={() => setShowSettings(!showSettings)} className={`p-2.5 md:p-3 rounded-full transition-all duration-300 shadow-sm active:scale-95 ${showSettings ? 'bg-black text-white' : 'bg-white text-gray-400 hover:text-gray-600'}`}>
            <Settings2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 设置面板 */}
      {showSettings && (
        <div className="w-full max-w-2xl mb-8 bg-white/70 backdrop-blur-2xl border border-white/40 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 shadow-2xl transition-all animate-in fade-in slide-in-from-top-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div className="space-y-1.5 md:space-y-2 md:col-span-1">
              <label className="text-[10px] md:text-[11px] font-bold text-gray-400 ml-1 uppercase tracking-widest flex items-center gap-1.5"><Edit3 className="w-3 h-3" /> 目标名称</label>
              <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full bg-white border-none rounded-xl md:rounded-2xl px-4 py-2.5 md:py-3 text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all shadow-inner" />
            </div>
            <div className="space-y-1.5 md:space-y-2">
              <label className="text-[10px] md:text-[11px] font-bold text-gray-400 ml-1 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3 h-3" /> 起始日</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-white border-none rounded-xl md:rounded-2xl px-4 py-2.5 md:py-3 text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all shadow-inner" />
            </div>
            <div className="space-y-1.5 md:space-y-2">
              <label className="text-[10px] md:text-[11px] font-bold text-gray-400 ml-1 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3 h-3" /> 目标日</label>
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="w-full bg-white border-none rounded-xl md:rounded-2xl px-4 py-2.5 md:py-3 text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all shadow-inner" />
            </div>
          </div>
          {user?.isAnonymous && (
            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest mb-2">当前为临时模式</p>
              <button onClick={handleLogin} className="text-xs text-blue-500 font-bold hover:underline">点击 Google 登录以永久保存数据</button>
            </div>
          )}
        </div>
      )}

      {/* 主展示区 */}
      <main className="w-full max-w-4xl bg-white rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-16 shadow-[0_30px_60px_rgba(0,0,0,0.02)] border border-gray-100 flex flex-col items-center transition-all">
        {!stats.isValid ? (
          <div className="py-20 text-center">
            <Info className="w-10 h-10 text-gray-100 mx-auto mb-4" />
            <p className="text-gray-300 text-sm font-medium">请在设置中配置有效日期</p>
          </div>
        ) : (
          <>
            {/* 方块阵列 */}
            <div className="w-full flex flex-wrap gap-1.5 md:gap-2.5 justify-center mb-10 md:mb-16 max-h-[35vh] md:max-h-[45vh] overflow-y-auto no-scrollbar py-2 px-1">
              {Array.from({ length: stats.totalDays }).map((_, i) => (
                <div key={i} className={`w-2.5 h-2.5 md:w-5 md:h-5 rounded-[2px] md:rounded-[5px] transition-all duration-1000 ${i < stats.passedDays ? 'bg-[#FF3B30] shadow-[0_2px_8px_rgba(255,59,48,0.15)]' : 'bg-[#F2F2F7] hover:bg-gray-200 cursor-default'}`} />
              ))}
            </div>

            <div className="w-full pt-4 md:pt-6 text-center flex flex-col items-center">
              {/* 经典黑色标签 */}
              <div className="inline-flex items-center gap-2 px-5 py-2 bg-black text-white rounded-full mb-8 shadow-xl shadow-black/10 select-none">
                <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em]">{topic}</span>
              </div>
              
              <div className="flex items-baseline justify-center gap-2 md:gap-3 select-none">
                <span className="text-7xl sm:text-8xl md:text-[10rem] font-extrabold tracking-tighter tabular-nums text-[#1D1D1F] leading-none">
                  {stats.remainingDays}
                </span>
                <span className="text-lg md:text-2xl font-bold text-gray-300 uppercase tracking-widest">天</span>
              </div>

              <div className="mt-10 md:mt-16 flex flex-wrap items-center justify-center gap-6 md:gap-10 text-[9px] md:text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em] select-none">
                <div className="flex items-center gap-2 bg-gray-50/50 px-3 py-1 rounded-full border border-gray-100">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] opacity-60" />
                  <span>已消逝 {stats.passedDays}</span>
                </div>
                <div className="flex items-center gap-2 bg-gray-50/50 px-3 py-1 rounded-full border border-gray-100">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#F2F2F7] border border-gray-300" />
                  <span>总计 {stats.totalDays}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="mt-12 md:mt-16 text-center opacity-30 select-none pb-8">
        <p className="text-[9px] md:text-[10px] uppercase tracking-[0.5em] mb-2 font-medium">Time Fragments · wukong.lol</p>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-in { animation: fadeIn 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @media (max-width: 400px) {
          .text-7xl { font-size: 4rem; }
        }
      `}} />
    </div>
  );
}