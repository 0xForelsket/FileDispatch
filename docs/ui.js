import React, { useState, useEffect } from 'react';
import {
  Folder,
  Settings,
  Plus,
  MoreVertical,
  Trash2,
  Edit3,
  ArrowRight,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  Zap,
  Activity,
  Terminal,
  Sun,
  Moon,
  BarChart3,
  FileDigit,
  Cpu,
  X,
  User,
  Bell,
  Shield,
  Monitor
} from 'lucide-react';

const App = () => {
  // --- State Management ---
  const [isDark, setIsDark] = useState(true);
  const [activeFolderId, setActiveFolderId] = useState('f1');
  const [mounted, setMounted] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('general');

  // Simulate mount animation
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const [folders, setFolders] = useState([
    { id: 'f1', name: 'Downloads', path: '/Users/jdoe/Downloads', enabled: true, ruleCount: 2 },
    { id: 'f2', name: 'Desktop Screenshots', path: '/Users/jdoe/Desktop', enabled: true, ruleCount: 1 },
    { id: 'f3', name: 'Work Dropzone', path: '/Users/jdoe/Work', enabled: false, ruleCount: 0 },
    { id: 'f4', name: 'Creative Assets', path: '/Volumes/Ext_SSD/Assets', enabled: true, ruleCount: 5 },
  ]);

  const [rules, setRules] = useState([
    {
      id: 'r1',
      folderId: 'f1',
      name: 'Organize PDF Invoices',
      enabled: true,
      triggerSummary: '*.pdf',
      actionSummary: 'mv → /Documents/Invoices'
    },
    {
      id: 'r2',
      folderId: 'f1',
      name: 'Cleanup Old Installers',
      enabled: false,
      triggerSummary: '*.dmg | *.exe (>30d)',
      actionSummary: 'delete --permanently'
    },
    {
      id: 'r3',
      folderId: 'f2',
      name: 'Archive Screenshots',
      enabled: true,
      triggerSummary: 'Screenshot*',
      actionSummary: 'mv → /Photos/Screenshots'
    }
  ]);

  const logs = [
    { id: 'l1', folderId: 'f1', time: '10:45:22', type: 'success', action: 'MOVED', details: 'invoice_2023.pdf → /Documents/Invoices', size: '2.4 MB' },
    { id: 'l2', folderId: 'f1', time: '10:42:01', type: 'success', action: 'MOVED', details: 'report_final.pdf → /Documents/Reports', size: '1.1 MB' },
    { id: 'l3', folderId: 'f1', time: '09:15:00', type: 'warning', action: 'SKIP', details: 'setup.exe (Rule disabled)', size: '0 KB' },
    { id: 'l4', folderId: 'f2', time: 'Yesterday', type: 'success', action: 'MOVED', details: 'Screenshot 192.png → /Photos/Screenshots', size: '4.2 MB' },
    { id: 'l5', folderId: 'f1', time: '08:30:15', type: 'success', action: 'COMPRESSED', details: 'backup.zip → /Archive', size: '124 MB' },
  ];

  // --- Helpers ---
  const activeFolder = folders.find(f => f.id === activeFolderId);
  const activeRules = rules.filter(r => r.folderId === activeFolderId);
  const activeLogs = logs.filter(l => l.folderId === activeFolderId);

  const toggleRule = (ruleId) => {
    setRules(rules.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r));
  };

  const toggleFolderStatus = (folderId, e) => {
    e.stopPropagation();
    setFolders(folders.map(f => f.id === folderId ? { ...f, enabled: !f.enabled } : f));
  };

  const gridColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';

  // --- Components ---

  // A reusable "Glass Card" with top highlight for depth
  const GlassCard = ({ children, className = "", hoverEffect = false }) => (
    <div className={`
      relative overflow-hidden
      bg-white/40 dark:bg-neutral-900/40 
      backdrop-blur-xl 
      border border-white/40 dark:border-white/5 
      shadow-[0_8px_32px_0_rgba(0,0,0,0.05)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]
      rounded-2xl
      ${hoverEffect ? 'transition-all duration-300 hover:bg-white/60 dark:hover:bg-neutral-800/60 hover:-translate-y-1 hover:shadow-xl hover:border-white/60 dark:hover:border-white/10' : ''}
      ${className}
    `}>
      {/* Top Specular Highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 dark:via-white/20 to-transparent opacity-50" />
      {children}
    </div>
  );

  // --- Settings Modal Component ---
  const SettingsModal = () => {
    if (!isSettingsOpen) return null;

    const tabs = [
      { id: 'general', label: 'General', icon: Settings },
      { id: 'account', label: 'Account', icon: User },
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'system', label: 'System', icon: Monitor },
      { id: 'security', label: 'Security', icon: Shield },
    ];

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-slate-900/20 dark:bg-black/40 backdrop-blur-sm transition-opacity" 
          onClick={() => setIsSettingsOpen(false)}
        />
        
        {/* Modal Window */}
        <div className="relative w-full max-w-4xl h-[600px] bg-white/80 dark:bg-[#0f0f0f]/90 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-2xl rounded-3xl overflow-hidden flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-200">
          
          {/* Sidebar */}
          <div className="w-full md:w-64 bg-slate-50/50 dark:bg-black/20 border-b md:border-b-0 md:border-r border-slate-200/50 dark:border-white/5 p-4 flex flex-col">
            <h2 className="text-sm font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider mb-4 px-2">Settings</h2>
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSettingsTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    settingsTab === tab.id
                      ? 'bg-blue-500/10 dark:bg-cyan-500/10 text-blue-600 dark:text-cyan-400 border border-blue-500/20 dark:border-cyan-500/20'
                      : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
            <div className="mt-auto pt-4 border-t border-slate-200/50 dark:border-white/5">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500"></div>
                <div>
                  <div className="text-sm font-bold text-slate-700 dark:text-neutral-200">John Doe</div>
                  <div className="text-xs text-slate-500 dark:text-neutral-500">Pro License</div>
                </div>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col h-full bg-white/40 dark:bg-transparent">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200/50 dark:border-white/5">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                  {tabs.find(t => t.id === settingsTab)?.label}
                </h2>
                <p className="text-sm text-slate-500 dark:text-neutral-500">Manage your {tabs.find(t => t.id === settingsTab)?.label.toLowerCase()} preferences</p>
              </div>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 dark:text-neutral-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="max-w-2xl space-y-8">
                
                {/* Section 1 */}
                <section>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-neutral-200 mb-4">Startup Behavior</h3>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between group p-3 rounded-xl border border-transparent hover:bg-slate-50 dark:hover:bg-white/5 hover:border-slate-200 dark:hover:border-white/5 transition-all cursor-pointer">
                      <div>
                        <div className="font-medium text-slate-700 dark:text-neutral-300">Launch on Login</div>
                        <div className="text-xs text-slate-500 dark:text-neutral-500">Start Dispatch automatically when you log in</div>
                      </div>
                      <div className="w-10 h-6 bg-slate-200 dark:bg-neutral-800 rounded-full relative">
                        <div className="absolute top-1 left-1 w-4 h-4 bg-white dark:bg-neutral-500 rounded-full shadow-sm transition-all"></div>
                      </div>
                    </label>
                    <label className="flex items-center justify-between group p-3 rounded-xl border border-blue-500/20 dark:border-cyan-500/30 bg-blue-50/50 dark:bg-cyan-500/5 cursor-pointer">
                      <div>
                        <div className="font-medium text-slate-900 dark:text-white">Run in Background</div>
                        <div className="text-xs text-slate-500 dark:text-neutral-400">Keep watchers active when window is closed</div>
                      </div>
                      <div className="w-10 h-6 bg-blue-500 dark:bg-cyan-600 rounded-full relative">
                        <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all"></div>
                      </div>
                    </label>
                  </div>
                </section>

                {/* Section 2 */}
                <section>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-neutral-200 mb-4">Performance</h3>
                  <div className="space-y-4">
                     <div>
                        <div className="flex justify-between text-sm mb-2">
                           <span className="text-slate-600 dark:text-neutral-400">CPU Usage Limit</span>
                           <span className="font-mono text-blue-600 dark:text-cyan-400">Unrestricted</span>
                        </div>
                        <div className="h-2 bg-slate-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                           <div className="h-full bg-blue-500 dark:bg-cyan-500 w-[80%] rounded-full"></div>
                        </div>
                     </div>
                     
                     <div>
                        <div className="flex justify-between text-sm mb-2">
                           <span className="text-slate-600 dark:text-neutral-400">Concurrent Operations</span>
                           <span className="font-mono text-slate-900 dark:text-white">8 threads</span>
                        </div>
                         <div className="flex gap-2">
                            {[2,4,8,16].map(n => (
                               <button key={n} className={`flex-1 py-1.5 text-xs font-medium rounded-lg border ${n === 8 ? 'bg-slate-800 dark:bg-white text-white dark:text-black border-transparent' : 'bg-transparent border-slate-200 dark:border-white/10 text-slate-500 dark:text-neutral-400'}`}>
                                 {n}x
                               </button>
                            ))}
                         </div>
                     </div>
                  </div>
                </section>

                {/* Section 3 */}
                <section>
                   <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0" />
                      <div>
                        <h4 className="text-sm font-bold text-amber-900 dark:text-amber-400">Experimental Features</h4>
                        <p className="text-xs text-amber-700 dark:text-amber-500/80 mt-1">Enable AI-based file categorization (Beta) to automatically tag and sort unknown file types.</p>
                        <button className="mt-3 text-xs font-bold text-amber-800 dark:text-amber-400 hover:underline">Enable Beta Features &rarr;</button>
                      </div>
                   </div>
                </section>

              </div>
            </div>
            
            {/* Footer Buttons */}
            <div className="p-4 border-t border-slate-200/50 dark:border-white/5 flex justify-end gap-3 bg-slate-50/50 dark:bg-black/20">
               <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white transition-colors">Cancel</button>
               <button onClick={() => setIsSettingsOpen(false)} className="px-6 py-2 text-sm font-bold text-white bg-blue-600 dark:bg-cyan-600 hover:bg-blue-700 dark:hover:bg-cyan-500 rounded-lg shadow-lg shadow-blue-500/20 dark:shadow-cyan-500/20 transition-all">Save Changes</button>
            </div>
          </div>
        </div>
      </div>
    );
  };


  return (
    <div className={`${isDark ? 'dark' : ''} h-screen w-full relative overflow-hidden transition-colors duration-700 ease-in-out`}>
      
      {/* --- SETTINGS MODAL --- */}
      <SettingsModal />

      {/* --- AMBIENT BACKGROUNDS --- */}
      <div className="absolute inset-0 bg-[#f8fafc] dark:bg-[#0a0a0a] transition-colors duration-700 z-0">
         {/* Animated Orbs */}
         <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-500/10 dark:bg-cyan-500/10 blur-[120px] animate-pulse-slow" />
         <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-indigo-500/10 dark:bg-violet-500/10 blur-[100px] animate-pulse-slower" />
         
         {/* Noise Texture */}
         <div className="absolute inset-0 opacity-[0.35] dark:opacity-[0.15] mix-blend-overlay pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.5'/%3E%3C/svg%3E")` }}></div>
         
         {/* Technical Grid */}
         <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `linear-gradient(${gridColor} 1px, transparent 1px), linear-gradient(to right, ${gridColor} 1px, transparent 1px)`, backgroundSize: '60px 60px' }}></div>
      </div>


      {/* --- MAIN LAYOUT --- */}
      <div className={`relative z-10 flex h-screen font-sans text-slate-600 dark:text-neutral-300 antialiased selection:bg-cyan-500/30 selection:text-cyan-900 dark:selection:text-cyan-100 transition-opacity duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
        
        {/* --- SIDEBAR --- */}
        <aside className="w-[280px] flex flex-col border-r border-white/20 dark:border-white/5 bg-white/30 dark:bg-black/20 backdrop-blur-2xl transition-all duration-500">
          
          {/* Header */}
          <div className="p-6 pb-2">
            <div className="flex items-center gap-3.5 mb-8 group cursor-pointer">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500 dark:bg-cyan-500 blur-md opacity-20 group-hover:opacity-40 transition-opacity rounded-full"></div>
                <div className="relative bg-gradient-to-br from-white to-slate-100 dark:from-neutral-800 dark:to-neutral-900 border border-white/60 dark:border-white/10 p-2.5 rounded-xl shadow-lg ring-1 ring-black/5">
                  <Zap className="w-5 h-5 text-blue-600 dark:text-cyan-400 fill-current" />
                </div>
              </div>
              <div className="flex flex-col">
                <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-none">DISPATCH</h1>
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-cyan-500 mt-1">Command Center</span>
              </div>
            </div>
            
            <button className="w-full group relative overflow-hidden bg-gradient-to-b from-white to-slate-50 dark:from-white/10 dark:to-white/5 hover:to-white hover:shadow-lg dark:hover:to-white/10 text-slate-700 dark:text-neutral-200 font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border border-white/60 dark:border-white/10 shadow-sm">
              <Plus className="w-4 h-4 text-blue-600 dark:text-cyan-400 transition-transform group-hover:rotate-90" />
              <span className="text-sm font-semibold tracking-tight">New Watcher</span>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5 custom-scrollbar">
            <div className="flex items-center justify-between px-3 mb-3">
              <h2 className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-widest">Targets</h2>
              <div className="flex items-center gap-1.5 bg-slate-200/50 dark:bg-white/5 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-500 dark:text-neutral-400">
                <Activity className="w-2.5 h-2.5" />
                {folders.filter(f => f.enabled).length} LIVE
              </div>
            </div>
            
            {folders.map((item) => (
              <div
                key={item.id}
                onClick={() => setActiveFolderId(item.id)}
                className={`group relative flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border duration-200 ${
                  activeFolderId === item.id
                    ? 'bg-white/80 dark:bg-white/10 border-white/60 dark:border-white/10 shadow-md backdrop-blur-md'
                    : 'border-transparent hover:bg-white/40 dark:hover:bg-white/5 text-slate-500 dark:text-neutral-400'
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                   {/* Folder Icon Container */}
                  <div className={`p-2 rounded-lg transition-all duration-300 shadow-inner ${
                    activeFolderId === item.id 
                    ? 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-cyan-500/20 dark:to-blue-600/20 text-blue-600 dark:text-cyan-300' 
                    : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-neutral-500 group-hover:text-slate-600 dark:group-hover:text-neutral-300'
                  }`}>
                      <Folder className="w-4 h-4" />
                  </div>
                  
                  <div className="truncate flex-1 min-w-0">
                    <div className={`font-semibold text-sm truncate flex items-center gap-2 ${activeFolderId === item.id ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-neutral-400'}`}>
                        {item.name}
                        {item.ruleCount > 0 && <span className="text-[9px] bg-slate-200 dark:bg-neutral-800 px-1 rounded text-slate-500 dark:text-neutral-500">{item.ruleCount}</span>}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 dark:text-neutral-500 truncate opacity-80 mt-0.5">{item.path}</div>
                  </div>
                </div>

                 {/* Status Indicator */}
                 <div className="pl-2">
                    {activeFolderId === item.id ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-cyan-400 shadow-[0_0_8px_currentColor]"></div>
                    ) : item.enabled && (
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-neutral-700"></div>
                    )}
                 </div>
              </div>
            ))}
          </nav>

          {/* Footer Controls */}
          <div className="p-4 border-t border-white/20 dark:border-white/5 flex items-center gap-2 mt-auto">
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="flex-1 flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-white/60 dark:hover:bg-white/10 text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white transition-all text-xs font-semibold border border-transparent hover:border-white/40 dark:hover:border-white/10"
            >
               <Settings className="w-4 h-4" />
               Settings
            </button>
            <button 
                onClick={() => setIsDark(!isDark)}
                className="p-2.5 rounded-xl hover:bg-white/60 dark:hover:bg-white/10 text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white transition-all border border-transparent hover:border-white/40 dark:hover:border-white/10"
            >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </aside>


        {/* --- MAIN CONTENT AREA --- */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          
          {/* Top Navbar */}
          <header className="px-8 py-6 flex items-start justify-between shrink-0 z-20 transition-all duration-300">
            <div>
              <div className="flex items-center gap-4 mb-2">
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight drop-shadow-sm">{activeFolder.name}</h2>
                  
                  {/* Status Badge */}
                  <div className={`pl-2 pr-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border backdrop-blur-md shadow-sm flex items-center gap-1.5 ${
                      activeFolder.enabled 
                      ? 'bg-green-500/10 dark:bg-cyan-500/10 text-green-700 dark:text-cyan-300 border-green-500/20 dark:border-cyan-500/20' 
                      : 'bg-slate-500/10 dark:bg-neutral-500/10 text-slate-600 dark:text-neutral-400 border-slate-500/20 dark:border-neutral-500/20'
                  }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${activeFolder.enabled ? 'bg-green-500 dark:bg-cyan-400 animate-pulse' : 'bg-slate-400'}`}></span>
                      {activeFolder.enabled ? 'Live Monitoring' : 'Offline'}
                  </div>
              </div>
              
              {/* Path Display */}
              <div className="flex items-center gap-2 font-mono text-xs text-slate-500 dark:text-neutral-400 group">
                 <span className="text-blue-600 dark:text-cyan-500 font-semibold flex items-center gap-1">
                    <Folder className="w-3 h-3" />
                    source:
                 </span>
                 <span className="bg-white/50 dark:bg-white/5 border border-white/40 dark:border-white/10 px-2 py-1 rounded text-slate-600 dark:text-neutral-300 select-all backdrop-blur-sm cursor-text hover:bg-white/80 dark:hover:bg-white/10 transition-colors">
                    {activeFolder.path}
                 </span>
              </div>
            </div>
             
             {/* Action Buttons */}
             <div className="flex items-center gap-2">
                 <button className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/40 dark:bg-white/5 border border-white/40 dark:border-white/10 text-slate-400 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all hover:scale-105 hover:shadow-lg">
                     <Trash2 className="w-4.5 h-4.5" />
                 </button>
                 <button className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/40 dark:bg-white/5 border border-white/40 dark:border-white/10 text-slate-400 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10 transition-all hover:scale-105 hover:shadow-lg">
                     <MoreVertical className="w-4.5 h-4.5" />
                 </button>
             </div>
          </header>

          {/* Scrollable Workspace */}
          <div className="flex-1 overflow-y-auto p-8 z-10 custom-scrollbar pb-20">
            <div className="max-w-6xl mx-auto space-y-12">
              
              {/* --- DASHBOARD STATS ROW --- */}
              <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <GlassCard className="p-5 flex flex-col justify-between h-32 hoverEffect">
                     <div className="flex items-start justify-between">
                        <div>
                            <div className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-neutral-500 font-bold mb-1">Throughput</div>
                            <div className="text-2xl font-bold text-slate-800 dark:text-white">142 <span className="text-sm font-normal text-slate-500 dark:text-neutral-500">files</span></div>
                        </div>
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-cyan-500/10 text-blue-600 dark:text-cyan-400">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                     </div>
                     {/* Mini Chart Visualization */}
                     <div className="flex items-end gap-1 h-8 mt-2">
                        {[40, 70, 45, 90, 60, 75, 50, 80, 95, 60].map((h, i) => (
                            <div key={i} className="flex-1 bg-blue-200/50 dark:bg-cyan-500/20 rounded-sm hover:bg-blue-400 dark:hover:bg-cyan-400 transition-colors" style={{ height: `${h}%` }}></div>
                        ))}
                     </div>
                  </GlassCard>

                  <GlassCard className="p-5 flex flex-col justify-between h-32 hoverEffect">
                     <div className="flex items-start justify-between">
                        <div>
                            <div className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-neutral-500 font-bold mb-1">Efficiency</div>
                            <div className="text-2xl font-bold text-slate-800 dark:text-white">98.5%</div>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <Cpu className="w-5 h-5" />
                        </div>
                     </div>
                     <div className="mt-auto">
                        <div className="w-full bg-slate-100 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-emerald-500 dark:bg-emerald-400 h-full rounded-full" style={{ width: '98.5%' }}></div>
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-neutral-500 mt-2 text-right">0.2s avg processing time</div>
                     </div>
                  </GlassCard>

                  <GlassCard className="p-5 flex flex-col justify-between h-32 hoverEffect">
                     <div className="flex items-start justify-between">
                        <div>
                            <div className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-neutral-500 font-bold mb-1">Storage Saved</div>
                            <div className="text-2xl font-bold text-slate-800 dark:text-white">4.2 GB</div>
                        </div>
                        <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400">
                            <FileDigit className="w-5 h-5" />
                        </div>
                     </div>
                     <div className="mt-auto flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400">
                        <span className="text-green-500 flex items-center gap-0.5 font-semibold"><ArrowRight className="w-3 h-3 -rotate-45" /> +12%</span>
                        <span>vs last week</span>
                     </div>
                  </GlassCard>
              </section>


              {/* --- LOGIC GATES (Rules) --- */}
              <section>
                <div className="flex items-center justify-between mb-6 px-1">
                  <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-neutral-200 uppercase tracking-widest flex items-center gap-2 drop-shadow-sm">
                          <Terminal className="w-4 h-4 text-blue-600 dark:text-cyan-500" />
                          Logic Gates
                      </h3>
                  </div>
                  <button className="group text-xs bg-white/60 dark:bg-cyan-500/10 hover:bg-white dark:hover:bg-cyan-500/20 text-blue-700 dark:text-cyan-300 border border-blue-200/50 dark:border-cyan-500/30 font-semibold py-2 px-4 rounded-xl shadow-sm backdrop-blur-md flex items-center gap-2 transition-all hover:scale-[1.03] hover:shadow-md">
                    <Plus className="w-3.5 h-3.5 transition-transform group-hover:rotate-90" />
                    New Logic Gate
                  </button>
                </div>

                <div className="grid gap-4">
                    {activeRules.map(rule => (
                    <GlassCard 
                        key={rule.id} 
                        hoverEffect={true}
                        className={`p-4 flex items-center gap-5 group ${!rule.enabled ? 'grayscale opacity-70' : ''}`}
                    >
                        {/* Status Line Indicator */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${rule.enabled ? 'bg-blue-500 dark:bg-cyan-500' : 'bg-slate-300 dark:bg-neutral-800'}`}></div>

                        {/* Icon */}
                        <div className={`p-3 rounded-xl border shadow-inner transition-colors duration-300 ml-2 ${
                            rule.enabled 
                            ? 'bg-blue-50/50 dark:bg-cyan-900/20 border-blue-100/50 dark:border-cyan-500/20 text-blue-600 dark:text-cyan-400' 
                            : 'bg-slate-100/50 dark:bg-white/5 border-slate-200/50 dark:border-white/5 text-slate-400 dark:text-neutral-600'
                        }`}>
                            <Zap className="w-5 h-5"/>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                            <div className="lg:col-span-4">
                                <h4 className={`font-bold text-sm truncate ${rule.enabled ? 'text-slate-800 dark:text-neutral-100' : 'text-slate-500 dark:text-neutral-500'}`}>{rule.name}</h4>
                            </div>
                            
                            {/* Logic Visualizer */}
                            <div className="lg:col-span-8 flex items-center gap-2 font-mono text-[11px]">
                                <div className="bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-neutral-300 px-3 py-1.5 rounded-lg truncate max-w-[140px] shadow-sm flex items-center gap-2" title="Condition">
                                    <span className="text-slate-400 dark:text-neutral-600 font-sans font-bold text-[9px] uppercase">IF</span>
                                    {rule.triggerSummary}
                                </div>
                                <ArrowRight className="w-3 h-3 text-slate-300 dark:text-neutral-600 flex-shrink-0" />
                                <div className="bg-blue-50/50 dark:bg-cyan-900/10 border border-blue-100/50 dark:border-cyan-500/20 text-blue-700 dark:text-cyan-300 px-3 py-1.5 rounded-lg truncate flex-1 shadow-sm flex items-center gap-2" title="Action">
                                    <span className="text-blue-400 dark:text-cyan-700 font-sans font-bold text-[9px] uppercase">THEN</span>
                                    {rule.actionSummary}
                                </div>
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-5 pl-5 border-l border-black/5 dark:border-white/5">
                            {/* Custom Toggle Switch */}
                            <button 
                                onClick={() => toggleRule(rule.id)}
                                className={`w-11 h-6 rounded-full transition-all duration-300 relative focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-neutral-900 ${
                                    rule.enabled 
                                    ? 'bg-blue-500 dark:bg-cyan-600 shadow-[0_0_12px_rgba(59,130,246,0.5)] dark:shadow-[0_0_15px_rgba(8,145,178,0.4)]' 
                                    : 'bg-slate-200 dark:bg-white/10'
                                }`}
                            >
                                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300 ${
                                    rule.enabled ? 'left-6' : 'left-1'
                                }`}></span>
                            </button>
                            
                            <button className="text-slate-400 dark:text-neutral-500 hover:text-slate-800 dark:hover:text-white transition-colors p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg">
                                <Edit3 className="w-4 h-4" />
                            </button>
                        </div>
                    </GlassCard>
                    ))}
                </div>
              </section>


              {/* --- LIVE STREAM (Logs) --- */}
              <section className="pb-8">
                <div className="flex items-center justify-between mb-6 px-1">
                   <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-neutral-200 uppercase tracking-widest flex items-center gap-2 drop-shadow-sm">
                          <Activity className="w-4 h-4 text-blue-600 dark:text-cyan-500" />
                          Event Stream
                      </h3>
                  </div>
                  
                  <div className="flex gap-2">
                      <div className="relative group">
                          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 dark:text-neutral-500 group-focus-within:text-blue-500 dark:group-focus-within:text-cyan-400 transition-colors" />
                          <input type="text" placeholder="Filter events..." className="bg-white/40 dark:bg-black/20 border border-white/40 dark:border-white/10 text-slate-700 dark:text-neutral-300 pl-9 pr-4 py-1.5 text-xs rounded-xl focus:outline-none focus:border-blue-400 dark:focus:border-cyan-500/50 focus:bg-white/60 dark:focus:bg-black/40 w-48 transition-all font-mono placeholder:text-slate-400 dark:placeholder:text-neutral-600 shadow-sm backdrop-blur-sm" />
                      </div>
                  </div>
                </div>

                <GlassCard className="overflow-hidden">
                  {/* Log Header */}
                  <div className="flex items-center bg-white/40 dark:bg-white/5 border-b border-black/5 dark:border-white/5 px-6 py-3 text-slate-500 dark:text-neutral-500 text-[10px] uppercase tracking-wider font-bold">
                      <div className="w-32">Timestamp</div>
                      <div className="w-28">Status</div>
                      <div className="flex-1">File Operation</div>
                      <div className="w-24 text-right">Size</div>
                  </div>

                  {/* Log Rows */}
                  <div className="divide-y divide-black/5 dark:divide-white/5 font-mono text-xs">
                      {activeLogs.map((log, index) => (
                      <div 
                        key={log.id} 
                        className="group hover:bg-blue-50/30 dark:hover:bg-cyan-900/10 transition-colors flex items-center px-6 py-3.5"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                          <div className="w-32 text-slate-500 dark:text-neutral-500 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-neutral-700 group-hover:bg-blue-400 dark:group-hover:bg-cyan-400 transition-colors"></span>
                              {log.time}
                          </div>
                          
                          <div className="w-28">
                              {log.type === 'success' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100/50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20">
                                    {log.action}
                                  </span>
                              ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100/50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20">
                                    {log.action}
                                  </span>
                              )}
                          </div>
                          
                          <div className="flex-1 text-slate-600 dark:text-neutral-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors truncate pr-4">
                              <span className="opacity-40 mr-2 text-slate-400 dark:text-neutral-500 select-none">~/</span>
                              {log.details}
                          </div>

                          <div className="w-24 text-right text-slate-400 dark:text-neutral-600 group-hover:text-slate-600 dark:group-hover:text-neutral-400">
                             {log.size}
                          </div>
                      </div>
                      ))}
                  </div>
                  
                  <div className="bg-white/30 dark:bg-white/5 px-6 py-2.5 border-t border-black/5 dark:border-white/5 text-[10px] text-slate-400 dark:text-neutral-600 flex justify-between backdrop-blur-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        STREAM ACTIVE
                      </div>
                      <button className="hover:text-blue-600 dark:hover:text-cyan-400 transition-colors flex items-center gap-1 group font-semibold uppercase tracking-wider">
                          View All History
                          <ArrowRight className="w-2.5 h-2.5 transition-transform group-hover:translate-x-0.5" />
                      </button>
                  </div>
                </GlassCard>
              </section>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;