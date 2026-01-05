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
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';

/**
 * 极简时光方块应用 - 生产环境增强版
 * 针对 Vercel 部署和手机端进行了 Google 登录优化 (Redirect 模式)
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
// 设置建议的登录习惯：总是选择账号
provider.setCustomParameters({ prompt: 'select_account' });

const appId = 'time-blocks-app';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
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
  
  const [showSettings, setShowSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 1. 处理身份验证和跳转结果
  useEffect(() => {
    // 处理从跳转登录返回的结果
    getRedirectResult(auth).catch((err) => {
      console.error("重定向登录出错:", err);
    });

    const unsubscribe = onAuthStateChanged(auth, async (currUser) => {
      if (!currUser) {
        try {
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

  // 2. 数据实时同步
  useEffect(() => {
    if (!user || !db || loading) return;
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.topic) setTopic(data.topic);
        if (data.startDate) setStartDate(data.startDate);
        if (data.targetDate) setTargetDate(data.targetDate);
      }
    }, (err) => {
      console.warn("读取数据受限:", err);
    });
    return () => unsubscribe();
  }, [user, loading]);

  // 3. 自动保存
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
        console.error("保存失败:", err);
      } finally {
        setTimeout(() => setIsSaving(false), 800);
      }
    };
    const timeoutId = setTimeout(saveData, 1000);
    return () => clearTimeout(timeoutId);
  }, [topic, startDate, targetDate, user, loading]);

  // Google 登录：根据环境选择模式
  const handleLogin = async () => {
    try {
      // 手机端或 Vercel 环境建议使用 Redirect 模式，防止弹窗被拦截
      if (/Mobi|Android|iPhone/i.test(navigator.userAgent)) {
        await signInWithRedirect(auth, provider);
      } else {
        await signInWithPopup(auth, provider);
      }
    } catch (err) {
      console.error("登录失败:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("登出失败:", err);
    }
  };

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
      <header className="w-full max-w-4xl flex justify-between items-center mb-6 md:mb-10">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="shrink-0 w-9 h-9 md:w-10 md:h-10 bg-black rounded-xl flex items-center justify-center shadow-lg">
            <Clock className="text-white w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div className="flex flex-col min-w-0">
            <h1 className="text-lg md:text-xl font-bold tracking-tight truncate max-w-[120px] sm:max-w-xs">{topic}</h1>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] md:text-[10px] text-gray-400 font-medium uppercase tracking-[0.2em]">
                {user?.isAnonymous ? '本地模式' : '已同步'}
              </span>
              {isSaving && <Loader2 className="w-2.5 h-2.5 text-blue-400 animate-spin" />}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white p-1 md:p-1.5 md:pl-3 rounded-full shadow-sm border border-gray-100">
            {user && !user.isAnonymous ? (
              <>
                <div className="hidden sm:flex flex-col items-end pr-1">
                  <span className="text-[10px] font-bold text-gray-800 leading-none">{user.displayName?.split(' ')[0]}</span>
                  <button onClick={handleLogout} className="text-[9px] text-gray-400 hover:text-red-400 font-bold">退出</button>
                </div>
                <img 
                  src={user.photoURL} 
                  alt="Avatar" 
                  onClick={() => window.innerWidth < 640 && handleLogout()}
                  className="w-7 h-7 rounded-full object-cover shadow-inner cursor-pointer" 
                />
              </>
            ) : (
              <button onClick={handleLogin} className="flex items-center gap-1.5 px-3 py-1 text-[10px] md:text-xs font-bold text-gray-600 hover:text-black">
                <LogIn className="w-3.5 h-3.5" /> <span className="hidden xs:inline">登录</span>
              </button>
            )}
          </div>
          <button onClick={() => setShowSettings(!showSettings)} className={`p-2.5 md:p-3 rounded-full transition-all ${showSettings ? 'bg-black text-white' : 'bg-white text-gray-400'}`}>
            <Settings2 className="w-5 h-5" />
          </button>
        </div>
      </header>

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
              <label className="text-[10px] font-bold text-gray-400 ml-1 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3 h-3" /> 目标</label>
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="w-full bg-white border-none rounded-xl px-4 py-2.5 text-sm outline-none shadow-inner" />
            </div>
          </div>
        </div>
      )}

      <main className="w-full max-w-4xl bg-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-16 shadow-[0_30px_60px_rgba(0,0,0,0.02)] border border-gray-100 flex flex-col items-center">
        {!stats.isValid ? (
          <div className="py-20 text-center"><p className="text-gray-300">请配置日期</p></div>
        ) : (
          <>
            <div className="w-full flex flex-wrap gap-1.5 md:gap-2 justify-center mb-12 max-h-[40vh] overflow-y-auto no-scrollbar py-2">
              {Array.from({ length: stats.totalDays }).map((_, i) => (
                <div key={i} className={`w-2.5 h-2.5 md:w-5 md:h-5 rounded-[2px] md:rounded-[5px] transition-all duration-1000 ${i < stats.passedDays ? 'bg-[#FF3B30] shadow-[0_2px_8px_rgba(255,59,48,0.15)]' : 'bg-[#F2F2F7]'}`} />
              ))}
            </div>
            <div className="w-full pt-4 text-center flex flex-col items-center">
              <div className="inline-flex items-center gap-2 px-5 py-2 bg-black text-white rounded-full mb-8 shadow-xl shadow-black/10">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{topic}</span>
              </div>
              <div className="flex items-baseline justify-center gap-2 md:gap-3">
                <span className="text-7xl sm:text-8xl md:text-[10rem] font-extrabold tracking-tighter tabular-nums text-[#1D1D1F] leading-none">
                  {stats.remainingDays}
                </span>
                <span className="text-lg md:text-2xl font-bold text-gray-300 tracking-widest uppercase">天</span>
              </div>
              <div className="mt-10 md:mt-16 flex flex-wrap items-center justify-center gap-8 text-[9px] md:text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em]">
                <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] opacity-60" />
                  <span>已过去 {stats.passedDays}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-200" />
                  <span>总计 {stats.totalDays}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="mt-16 text-center opacity-30 pb-8">
        <p className="text-[10px] uppercase tracking-[0.5em] font-medium">Time Fragments · wukong.lol</p>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: fadeIn 0.8s ease-out forwards; }
      `}} />
    </div>
  );
}