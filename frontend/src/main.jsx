import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BarChart3, Wallet, ArrowUpRight, ArrowDownRight, Plus, Search, Bell, LogOut, LayoutDashboard, ReceiptText, PiggyBank, Target, Settings2, Download, Coffee, CarFront, ShoppingBag, HeartPulse, House, Clapperboard, GraduationCap, CircleDollarSign, CalendarDays, Pencil, Trash2, X, ChevronDown, Sparkles, Menu, Check, TrendingUp } from 'lucide-react';
import { Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler } from 'chart.js';
import './styles.css';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler);

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const categories = ['Food','Transport','Shopping','Bills','Health','Home','Entertainment','Education','Salary','Other'];
const categoryMeta = {
  Food: { icon: Coffee, color: '#ff846e', soft: '#fff0eb' },
  Transport: { icon: CarFront, color: '#7c6cf2', soft: '#efedff' },
  Shopping: { icon: ShoppingBag, color: '#e9a23b', soft: '#fff4dc' },
  Bills: { icon: CircleDollarSign, color: '#3cbaa0', soft: '#e4f8f2' },
  Health: { icon: HeartPulse, color: '#ed70a7', soft: '#ffedf5' },
  Home: { icon: House, color: '#62a7df', soft: '#eaf5ff' },
  Entertainment: { icon: Clapperboard, color: '#aa78db', soft: '#f5ebff' },
  Education: { icon: GraduationCap, color: '#4ba7a4', soft: '#e5f7f6' },
  Salary: { icon: Wallet, color: '#4bbf85', soft: '#e7f9ef' },
  Other: { icon: CircleDollarSign, color: '#8993a7', soft: '#eef1f6' }
};
const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n || 0));
const today = () => new Date().toISOString().slice(0,10);
const currentMonth = () => today().slice(0,7);
const monthLabel = m => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-IN',{month:'short',year:'2-digit'});
const dateLabel = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN',{day:'2-digit',month:'short'});
const getToken = () => localStorage.getItem('pp_token');

async function api(path, options={}) {
  const headers = { 'Content-Type':'application/json', ...(options.headers || {}) };
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
  const response = await fetch(`${API}${path}`, { ...options, headers });
  if (!response.ok) {
    let message = 'Something went wrong. Please try again.';
    try { const data = await response.json(); message = data.detail || message; } catch {}
    if (response.status === 401) { localStorage.removeItem('pp_token'); localStorage.removeItem('pp_user'); }
    throw new Error(message);
  }
  if (response.status === 204) return null;
  return response.json();
}
function App() {
  const [user,setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('pp_user')); } catch { return null; } });
  const [tokenReady,setTokenReady] = useState(!!getToken());
  const [authMode,setAuthMode] = useState('login');
  const [page,setPage] = useState('Overview');
  const [toast,setToast] = useState('');
  const [busy,setBusy] = useState(false);
  const [month,setMonth] = useState(currentMonth());
  const [transactions,setTransactions] = useState([]);
  const [analytics,setAnalytics] = useState(null);
  const [budgets,setBudgets] = useState([]);
  const [goals,setGoals] = useState([]);
  const [filter,setFilter] = useState({search:'',category:'All categories',kind:'all',sort:'newest',start:'',end:''});
  const [modal,setModal] = useState(null);
  const [mobileNav,setMobileNav] = useState(false);
  const notify = msg => { setToast(msg); setTimeout(()=>setToast(''),3200); };
  const signOut = () => { localStorage.removeItem('pp_token'); localStorage.removeItem('pp_user'); setUser(null); setTokenReady(false); setTransactions([]); };
  async function loadAll() {
    try {
      const params = new URLSearchParams({ month });
      const [tx,an,b,g] = await Promise.all([
        api(`/api/transactions?${new URLSearchParams({sort:'newest'})}`),
        api(`/api/analytics?${params}`),
        api(`/api/budgets?${params}`),
        api('/api/goals')
      ]);
      setTransactions(tx); setAnalytics(an); setBudgets(b); setGoals(g);
    } catch(e) { notify(e.message); }
  }
  useEffect(()=>{ if (getToken()) api('/api/auth/me').then(me=>{setUser(me);localStorage.setItem('pp_user',JSON.stringify(me));setTokenReady(true);}).catch(()=>{setUser(null);setTokenReady(false);}); },[]);
  useEffect(()=>{ if(user && getToken()) loadAll(); },[user,month]);
  const filtered = useMemo(()=>transactions.filter(t=>{
    const matchSearch = t.title.toLowerCase().includes(filter.search.toLowerCase());
    const matchCategory = filter.category === 'All categories' || t.category === filter.category;
    const matchKind = filter.kind === 'all' || t.kind === filter.kind;
    const matchStart = !filter.start || t.spent_on >= filter.start;
    const matchEnd = !filter.end || t.spent_on <= filter.end;
    return matchSearch && matchCategory && matchKind && matchStart && matchEnd;
  }).sort((a,b)=>filter.sort==='highest'?b.amount-a.amount:filter.sort==='lowest'?a.amount-b.amount:filter.sort==='oldest'?a.spent_on.localeCompare(b.spent_on):b.spent_on.localeCompare(a.spent_on)),[transactions,filter]);
  async function submitAuth(e) {
    e.preventDefault(); setBusy(true);
    const data = new FormData(e.currentTarget);
    const payload = { email:data.get('email'), password:data.get('password') };
    if(authMode==='register') payload.name=data.get('name');
    try {
      const result = await api(`/api/auth/${authMode==='register'?'register':'login'}`,{method:'POST',body:JSON.stringify(payload)});
      localStorage.setItem('pp_token',result.token); localStorage.setItem('pp_user',JSON.stringify(result.user));
      setUser(result.user); setTokenReady(true); notify(authMode==='register'?'Your money journey starts now ✨':'Welcome back!'); 
    } catch(e) { notify(e.message); } finally { setBusy(false); }
  }
  async function saveTransaction(payload,id) {
    try { await api(`/api/transactions${id?`/${id}`:''}`,{method:id?'PUT':'POST',body:JSON.stringify(payload)}); setModal(null); await loadAll(); notify(id?'Transaction updated ✨':'Transaction added ✨'); }
    catch(e){notify(e.message);}
  }
  async function deleteTransaction(id) {
    if(!confirm('Delete this transaction? This cannot be undone.')) return;
    try { await api(`/api/transactions/${id}`,{method:'DELETE'}); await loadAll(); notify('Transaction removed.'); } catch(e){notify(e.message);}
  }
  async function saveBudget(payload) {
    try { await api('/api/budgets',{method:'POST',body:JSON.stringify(payload)}); setModal(null); await loadAll(); notify('Budget saved!'); } catch(e){notify(e.message);}
  }
  async function deleteBudget(id) {
    if(!confirm('Delete this budget?')) return;
    try { await api(`/api/budgets/${id}`,{method:'DELETE'}); await loadAll(); notify('Budget removed.'); } catch(e){notify(e.message);}
  }
  async function saveGoal(payload,id) {
    try { await api(`/api/goals${id?`/${id}`:''}`,{method:id?'PUT':'POST',body:JSON.stringify(payload)}); setModal(null); await loadAll(); notify('Savings goal saved!'); } catch(e){notify(e.message);}
  }
  async function deleteGoal(id) {
    if(!confirm('Delete this savings goal?')) return;
    try { await api(`/api/goals/${id}`,{method:'DELETE'}); await loadAll(); notify('Goal removed.'); } catch(e){notify(e.message);}
  }
  async function exportCsv() {
    try {
      const res = await fetch(`${API}/api/export.csv`,{headers:{Authorization:`Bearer ${getToken()}`}});
      if(!res.ok) throw new Error('Could not export transactions.');
      const blob = await res.blob(), url=URL.createObjectURL(blob), a=document.createElement('a');
      a.href=url; a.download='pocketpalette-transactions.csv'; a.click(); URL.revokeObjectURL(url); notify('Your CSV is ready!');
    } catch(e){notify(e.message);}
  }
  if(!user || !tokenReady) return <AuthScreen mode={authMode} setMode={setAuthMode} submit={submitAuth} busy={busy} toast={toast}/>;
  const totalIncome = analytics?.income || 0, totalExpenses = analytics?.expenses || 0, balance = analytics?.balance || 0;
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav?'nav-open':''}`}>
      <div className="brand"><div className="brand-mark"><Wallet size={22}/><span className="spark">✦</span></div><div><b>Pocket<span>Palette</span></b><small>YOUR MONEY, IN COLOUR</small></div><button className="icon-btn close-nav" onClick={()=>setMobileNav(false)}><X/></button></div>
      <div className="profile-mini"><div className="avatar">{(user.name||'F').slice(0,1).toUpperCase()}</div><div><strong>{user.name}</strong><small>Personal space</small></div><span className="online-dot"/></div>
      <p className="nav-label">WORKSPACE</p>
      <nav>{[
        {name:'Overview',icon:LayoutDashboard},{name:'Transactions',icon:ReceiptText},{name:'Budgets',icon:PiggyBank},{name:'Savings goals',icon:Target}
      ].map(item=><button key={item.name} className={`nav-item ${page===item.name?'active':''}`} onClick={()=>{setPage(item.name);setMobileNav(false);}}><item.icon size={18}/><span>{item.name}</span>{item.name==='Transactions'&&<em>{transactions.length}</em>}</button>)}</nav>
      <div className="sidebar-tip"><div className="tip-art">✿</div><b>A little progress adds up.</b><p>Small choices today make room for big dreams tomorrow.</p><button onClick={()=>setPage('Savings goals')}>Explore goals <ArrowUpRight size={14}/></button></div>
      <div className="sidebar-bottom"><div className="help-chip"><span className="help-spark">✦</span><div><b>Money tip</b><small>Give every rupee a purpose.</small></div></div><button className="nav-item logout" onClick={signOut}><LogOut size={18}/><span>Log out</span></button><small className="version">POCKETPALETTE · MADE FOR YOU</small></div>
    </aside>
    {mobileNav&&<div className="scrim" onClick={()=>setMobileNav(false)}/>}
    <main className="main-area">
      <header className="topbar"><button className="icon-btn mobile-menu" onClick={()=>setMobileNav(true)}><Menu/></button><div className="breadcrumb">Workspace <span>/</span> <b>{page}</b></div><div className="top-actions"><div className="month-picker"><CalendarDays size={15}/><input aria-label="Choose month" type="month" value={month} onChange={e=>setMonth(e.target.value)}/><ChevronDown size={14}/></div><button className="icon-btn notification" title="Notifications"><Bell size={18}/><i/></button><div className="top-avatar">{(user.name||'F').slice(0,1).toUpperCase()}</div></div></header>
      <div className="page-content">
        {page==='Overview'&&<Overview user={user} analytics={analytics} transactions={transactions} budgets={budgets} goals={goals} month={month} onAdd={()=>setModal({type:'transaction'})} onPage={setPage} onExport={exportCsv}/>}
        {page==='Transactions'&&<TransactionsPage items={filtered} filter={filter} setFilter={setFilter} onAdd={()=>setModal({type:'transaction'})} onEdit={t=>setModal({type:'transaction',item:t})} onDelete={deleteTransaction} onExport={exportCsv}/>}
        {page==='Budgets'&&<BudgetsPage budgets={budgets} month={month} onAdd={()=>setModal({type:'budget'})} onDelete={deleteBudget}/>}
        {page==='Savings goals'&&<GoalsPage goals={goals} onAdd={()=>setModal({type:'goal'})} onEdit={g=>setModal({type:'goal',item:g})} onDelete={deleteGoal}/>}
      </div>
      <footer className="footer"><span>Made with <b>♥</b> for your future self</span><span>One mindful money move at a time ✦</span></footer>
    </main>
    {modal&&<Modal modal={modal} onClose={()=>setModal(null)} onSaveTransaction={saveTransaction} onSaveBudget={saveBudget} onSaveGoal={saveGoal} month={month}/>}
    {toast&&<div className="toast"><span>✦</span>{toast}</div>}
  </div>;
}

function AuthScreen({mode,setMode,submit,busy,toast}) {
  return <div className="auth-layout"><div className="auth-art"><div className="auth-logo"><div className="brand-mark"><Wallet size={23}/></div><b>Pocket<span>Palette</span></b></div><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="auth-art-copy"><span className="eyebrow light">A FRESH TAKE ON YOUR FINANCES</span><h1>Your money story<br/>deserves <i>colour.</i></h1><p>A little clarity. A little confidence. A whole lot more room for what matters.</p><div className="art-stat"><div className="mini-avatars"><span>✿</span><span>☻</span><span>✦</span></div><div><b>Make your money make sense.</b><small>One thoughtful step at a time.</small></div></div></div><div className="floating-card float-a"><span className="float-icon mint">↗</span><div><small>MONTHLY SAVINGS</small><b>Looking brighter ✨</b></div></div><div className="floating-card float-b"><span className="float-icon yellow">✦</span><div><small>YOUR NEXT CHAPTER</small><b>Starts with a plan</b></div></div><div className="auth-decoration deco-flower">✿</div><div className="auth-decoration deco-star">✦</div></div>
  <div className="auth-panel"><div className="auth-form-wrap"><div className="mobile-auth-brand"><div className="brand-mark"><Wallet/></div><b>Pocket<span>Palette</span></b></div><div className="welcome-tag"><Sparkles size={14}/> YOUR FINANCIAL RESET</div><h2>{mode==='login'?'Welcome back!':'Let’s make it count.'}</h2><p className="auth-sub">{mode==='login'?'Your little corner of financial clarity is waiting.':'Create your space and start building healthier money habits.'}</p><form onSubmit={submit} className="auth-form">
    {mode==='register'&&<label>Your name<input name="name" placeholder="What should we call you?" minLength="2" required/></label>}
    <label>Email address<input name="email" type="email" placeholder="you@example.com" autoComplete="email" required/></label>
    <label>Password<input name="password" type="password" placeholder="At least 8 characters" minLength="8" autoComplete={mode==='login'?'current-password':'new-password'} required/></label>
    <button className="primary-btn auth-submit" disabled={busy}>{busy?'One moment…':mode==='login'?'Sign in to your space':'Create my account'} <ArrowUpRight size={17}/></button>
  </form><div className="auth-switch">{mode==='login'?"New to PocketPalette?":"Already have an account?"} <button onClick={()=>setMode(mode==='login'?'register':'login')}>{mode==='login'?'Create an account':'Sign in'}</button></div><div className="privacy-note"><span>♧</span> Your finances are personal. Your account is, too.</div></div><div className="auth-bottom">© 2026 PocketPalette <span>•</span> Small steps, brighter futures.</div></div>{toast&&<div className="toast"><span>✦</span>{toast}</div>}</div>;
}

function Overview({user,analytics,transactions,budgets,goals,month,onAdd,onPage,onExport}) {
  const cats=analytics?.category_totals||[], trend=analytics?.monthly_trend||[];
  const spent=analytics?.expenses||0, income=analytics?.income||0, balance=analytics?.balance||0;
  const palette=['#ff806b','#7968ee','#f3b94f','#4dbda7','#e879ae','#6caee4','#ad7de0','#7cbd68'];
  const chartData={labels:cats.map(c=>c.category),datasets:[{data:cats.map(c=>c.total),backgroundColor:cats.map((_,i)=>palette[i%palette.length]),borderWidth:0,hoverOffset:7}]};
  const lineData={labels:trend.map(t=>monthLabel(t.month)),datasets:[{data:trend.map(t=>t.total),fill:true,borderColor:'#8170ef',backgroundColor:'rgba(129,112,239,.10)',borderWidth:3,tension:.42,pointRadius:4,pointHoverRadius:6,pointBackgroundColor:'#fff',pointBorderColor:'#8170ef',pointBorderWidth:2}]};
  const options={plugins:{legend:{display:false},tooltip:{backgroundColor:'#28243d',padding:12,displayColors:false,callbacks:{label:c=>money(c.raw)}}},maintainAspectRatio:false};
  return <><div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot"/> YOUR MONEY, YOUR RHYTHM</div><h1>Hey, {user.name?.split(' ')[0]||'there'} <span className="wave">✦</span></h1><p className="page-sub">Here’s the colourful picture of your money this month.</p></div><button className="primary-btn" onClick={onAdd}><Plus size={17}/> Add transaction</button></div>
    <section className="hero-banner"><div className="hero-copy"><div className="hero-pill"><Sparkles size={13}/> YOUR MONTHLY SNAPSHOT</div><h2>Little steps.<br/><em>Big possibilities.</em></h2><p>Every mindful choice is a step toward the life you want.</p><button onClick={()=>onPage('Budgets')}>Check your budget <ArrowUpRight size={15}/></button></div><div className="hero-art"><div className="hero-sun"/><div className="hero-plant plant-one"><i/><i/><i/><b/></div><div className="hero-plant plant-two"><i/><i/><i/><b/></div><div className="hero-pot"/><div className="hero-orb">✦</div><div className="hero-doodle">〰</div></div><div className="hero-side-note"><span>✿</span><b>You're doing<br/>better than you think.</b></div></section>
    <div className="section-heading"><div><h3>Your money at a glance</h3><p>Here’s where things stand for {monthLabel(month)}.</p></div><button className="text-button" onClick={()=>onPage('Transactions')}>All transactions <ArrowUpRight size={15}/></button></div>
    <div className="stats-grid">
      <StatCard title="Total income" value={money(income)} note="Money coming in" icon={ArrowDownRight} color="mint" change="INCOME"/>
      <StatCard title="Total expenses" value={money(spent)} note="Money going out" icon={ArrowUpRight} color="coral" change="SPENDING"/>
      <StatCard title="Net balance" value={money(balance)} note={balance>=0?'You’re in the green!':'Time to review spending'} icon={Wallet} color="lilac" change="BALANCE"/>
      <StatCard title="Transactions" value={analytics?.transaction_count||0} note="This month so far" icon={ReceiptText} color="yellow" change="ACTIVITY"/>
    </div>
    <div className="charts-grid"><section className="panel trend-panel"><div className="panel-head"><div><h3>Spending rhythm</h3><p>Your last 6 months, at a glance</p></div><span className="chart-badge"><TrendingUp size={14}/> TREND</span></div><div className="chart-area line-area">{trend.length?<Line data={lineData} options={{...options,scales:{x:{grid:{display:false},ticks:{color:'#9b98aa'},border:{display:false}},y:{grid:{color:'#f0edf5'},ticks:{color:'#9b98aa',callback:v=>v>=1000?`${Math.round(v/1000)}k`:v},border:{display:false}}}}}/>:<EmptyChart/>}</div><div className="chart-foot"><span><i className="legend-dot purple"/> Monthly expenses</span><span>Values in ₹</span></div></section>
    <section className="panel category-panel"><div className="panel-head"><div><h3>Where it goes</h3><p>Spending by category</p></div><span className="tiny-spark">✳</span></div><div className="donut-wrap">{cats.length?<><Doughnut data={chartData} options={{...options,cutout:'73%'}}/><div className="donut-center"><small>TOTAL SPENT</small><b>{money(spent)}</b></div></>:<div className="empty-donut"><span>✿</span><b>Your story starts here</b><small>Add an expense to see the breakdown.</small></div>}</div><div className="category-legend">{cats.slice(0,5).map((c,i)=><div className="legend-row" key={c.category}><span className="legend-name"><i style={{background:palette[i%palette.length]}}/>{c.category}</span><b>{money(c.total)}</b></div>)}{cats.length>5&&<button className="text-button" onClick={()=>onPage('Transactions')}>See all categories</button>}</div></section></div>
    <div className="bottom-grid"><section className="panel transactions-panel"><div className="panel-head"><div><h3>Recent activity</h3><p>Your latest money moves</p></div><button className="text-button" onClick={()=>onPage('Transactions')}>View all <ArrowUpRight size={14}/></button></div>{transactions.length?<div className="recent-list">{transactions.slice(0,5).map(t=><TransactionRow key={t.id} item={t}/>)}</div>:<EmptyState icon={ReceiptText} title="No transactions yet" text="Add your first money move to get started."/>}</section>
    <section className="panel budget-preview"><div className="panel-head"><div><h3>Budget check-in</h3><p>Keep your spending on track</p></div><button className="round-arrow" onClick={()=>onPage('Budgets')}><ArrowUpRight size={16}/></button></div>{budgets.length?budgets.slice(0,3).map(b=><div className="budget-mini" key={b.id}><div className="budget-mini-head"><span>{b.category}</span><b>{money(b.spent)} <small>/ {money(b.monthly_limit)}</small></b></div><Progress percent={b.percent} tone={b.percent>=100?'coral':b.percent>=80?'yellow':'mint'}/><small className="budget-foot">{b.remaining>=0?`${money(b.remaining)} left to spend`:`${money(Math.abs(b.remaining))} over budget`}</small></div>):<EmptyState icon={PiggyBank} title="Make a little plan" text="Set a monthly category budget to stay on track." action="Create a budget" onAction={()=>onPage('Budgets')}/>}</section></div>
    <div className="bottom-callout"><div className="callout-icon">✦</div><div><b>Your future self says thanks.</b><p>Every time you check in, you’re building a healthier relationship with money.</p></div><button onClick={onExport}><Download size={15}/> Export my data</button></div>
  </>;
}
function StatCard({title,value,note,icon:Icon,color,change}){return <div className={`stat-card ${color}`}><div className="stat-top"><span>{title}</span><div className="stat-icon"><Icon size={19}/></div></div><div className="stat-value">{value}</div><div className="stat-bottom"><span>{note}</span><small>{change}</small></div><div className="stat-decoration"/></div>}
function Progress({percent=0,tone='mint'}){return <div className={`progress-track ${tone}`}><span style={{width:`${Math.max(0,Math.min(100,percent))}%`}}/></div>}
function TransactionRow({item,onEdit,onDelete,actions=false}){const meta=categoryMeta[item.category]||categoryMeta.Other, Icon=meta.icon;return <div className="transaction-row"><div className="tx-icon" style={{background:meta.soft,color:meta.color}}><Icon size={18}/></div><div className="tx-info"><b>{item.title}</b><small>{item.category} <span>•</span> {dateLabel(item.spent_on)}</small></div><div className={`tx-amount ${item.kind}`}>{item.kind==='income'?'+':'−'}{money(item.amount)}</div>{actions&&<div className="row-actions"><button title="Edit" onClick={()=>onEdit(item)}><Pencil size={14}/></button><button title="Delete" onClick={()=>onDelete(item.id)}><Trash2 size={14}/></button></div>}</div>}
function EmptyState({icon:Icon,title,text,action,onAction}){return <div className="empty-state"><div className="empty-icon"><Icon size={22}/></div><b>{title}</b><p>{text}</p>{action&&<button className="text-button" onClick={onAction}>{action} <ArrowUpRight size={14}/></button>}</div>}
function EmptyChart(){return <div className="empty-state chart-empty"><div className="empty-icon"><BarChart3 size={23}/></div><b>Your chart is waiting</b><p>Add expenses to see your trend.</p></div>}
function TransactionsPage({items,filter,setFilter,onAdd,onEdit,onDelete,onExport}) {
  const update=(k,v)=>setFilter(f=>({...f,[k]:v}));
  return <><div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot"/> EVERY LITTLE MONEY MOVE</div><h1>Transactions <span className="wave">✦</span></h1><p className="page-sub">The details make the difference. Keep them all in one place.</p></div><button className="primary-btn" onClick={onAdd}><Plus size={17}/> Add transaction</button></div>
    <div className="filter-bar"><div className="search-box"><Search size={17}/><input value={filter.search} onChange={e=>update('search',e.target.value)} placeholder="Search transactions…"/></div><select value={filter.category} onChange={e=>update('category',e.target.value)}><option>All categories</option>{categories.map(c=><option key={c}>{c}</option>)}</select><select value={filter.kind} onChange={e=>update('kind',e.target.value)}><option value="all">All types</option><option value="expense">Expenses</option><option value="income">Income</option></select><select value={filter.sort} onChange={e=>update('sort',e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="highest">Highest amount</option><option value="lowest">Lowest amount</option></select><button className="soft-btn" onClick={()=>setFilter({search:'',category:'All categories',kind:'all',sort:'newest',start:'',end:''})}><Settings2 size={15}/> Reset</button><button className="soft-btn" onClick={onExport}><Download size={15}/> CSV</button></div>
    <div className="date-filter"><label>From <input type="date" value={filter.start} onChange={e=>update('start',e.target.value)}/></label><label>To <input type="date" value={filter.end} onChange={e=>update('end',e.target.value)}/></label><span>{items.length} transaction{items.length===1?'':'s'} found</span></div>
    <section className="panel full-table"><div className="panel-head"><div><h3>Your money moves</h3><p>All the details, neatly organised.</p></div><span className="table-count">{items.length} RECORDS</span></div>{items.length?<div className="table-scroll"><table><thead><tr><th>DESCRIPTION</th><th>CATEGORY</th><th>DATE</th><th>TYPE</th><th>AMOUNT</th><th>ACTIONS</th></tr></thead><tbody>{items.map(t=>{const meta=categoryMeta[t.category]||categoryMeta.Other,Icon=meta.icon;return <tr key={t.id}><td><div className="table-title"><span style={{background:meta.soft,color:meta.color}}><Icon size={17}/></span><div><b>{t.title}</b>{t.note&&<small>{t.note}</small>}</div></div></td><td><span className="category-chip" style={{background:meta.soft,color:meta.color}}>{t.category}</span></td><td>{dateLabel(t.spent_on)}</td><td><span className={`type-chip ${t.kind}`}>{t.kind}</span></td><td><b className={`table-amount ${t.kind}`}>{t.kind==='income'?'+':'−'}{money(t.amount)}</b></td><td><div className="table-actions"><button onClick={()=>onEdit(t)} title="Edit"><Pencil size={15}/></button><button onClick={()=>onDelete(t.id)} title="Delete"><Trash2 size={15}/></button></div></td></tr>})}</tbody></table></div>:<EmptyState icon={Search} title="No matching transactions" text="Try changing your filters, or add a new transaction."/>}</section>
  </>;
}
function BudgetsPage({budgets,month,onAdd,onDelete}){return <><div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot"/> A PLAN THAT FEELS GOOD</div><h1>Budget garden <span className="wave">✿</span></h1><p className="page-sub">Give your money a direction, not a restriction.</p></div><button className="primary-btn" onClick={onAdd}><Plus size={17}/> Set a budget</button></div><div className="budget-hero"><div><span className="hero-pill">✦ MONTHLY INTENTION</span><h2>Spend with purpose.<br/><em>Save with joy.</em></h2><p>Your budget is a guide for the things you care about.</p></div><div className="budget-hero-flower">✿</div></div><div className="section-heading"><div><h3>Your category budgets</h3><p>Showing budgets for {monthLabel(month)}.</p></div><span className="table-count">{budgets.length} CATEGORIES</span></div>{budgets.length?<div className="budget-grid">{budgets.map((b,i)=>{const m=categoryMeta[b.category]||categoryMeta.Other,Icon=m.icon;return <div className="budget-card" key={b.id}><div className="budget-card-top"><span className="budget-cat-icon" style={{background:m.soft,color:m.color}}><Icon size={20}/></span><button className="icon-btn delete-small" title="Delete budget" onClick={()=>onDelete(b.id)}><Trash2 size={15}/></button></div><h3>{b.category}</h3><div className="budget-numbers"><b>{money(b.spent)}</b><span>of {money(b.monthly_limit)}</span></div><Progress percent={b.percent} tone={b.percent>=100?'coral':b.percent>=80?'yellow':['mint','lilac','coral'][i%3]}/><div className="budget-card-foot"><span>{b.percent}% used</span><b className={b.remaining<0?'over':''}>{b.remaining>=0?`${money(b.remaining)} left`:`${money(-b.remaining)} over`}</b></div>{b.percent>=100&&<div className="budget-alert">A little over plan — take a look at this category.</div>}</div>})}<button className="budget-add-card" onClick={onAdd}><span><Plus size={22}/></span><b>Add another category</b><small>Build a budget that fits your life.</small></button></div>:<section className="panel empty-budget"><EmptyState icon={PiggyBank} title="Your budget garden is ready to grow" text="Choose a category and set a monthly limit. We'll compare it with your real spending." action="Create your first budget" onAction={onAdd}/></section>}</>}
function GoalsPage({goals,onAdd,onEdit,onDelete}){return <><div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot"/> DREAM IT, THEN PLAN IT</div><h1>Savings goals <span className="wave">✦</span></h1><p className="page-sub">Big dreams are built from small, steady steps.</p></div><button className="primary-btn" onClick={onAdd}><Plus size={17}/> New goal</button></div><div className="goal-banner"><div><span className="hero-pill">A LITTLE CLOSER EVERY DAY</span><h2>Make room for<br/><em>what matters.</em></h2><p>Give your next big thing a name, a number, and a plan.</p></div><div className="goal-banner-art"><div className="goal-ring">✦</div><span className="goal-star s1">✧</span><span className="goal-star s2">✦</span><span className="goal-star s3">✿</span></div></div>{goals.length?<div className="goal-grid">{goals.map((g,i)=><div className={`goal-card goal-${i%4}`} key={g.id}><div className="goal-card-head"><span className="goal-symbol">{['✈','⌂','✿','✦'][i%4]}</span><div className="goal-actions"><button onClick={()=>onEdit(g)} title="Edit goal"><Pencil size={14}/></button><button onClick={()=>onDelete(g.id)} title="Delete goal"><Trash2 size={14}/></button></div></div><h3>{g.title}</h3><p className="goal-target">A future worth saving for</p><div className="goal-amounts"><b>{money(g.saved_amount)}</b><span>of {money(g.target_amount)}</span></div><Progress percent={g.percent} tone={['lilac','mint','yellow','coral'][i%4]}/><div className="goal-bottom"><span>{g.percent}% there</span><b>{money(Math.max(0,g.target_amount-g.saved_amount))} to go</b></div>{g.target_date&&<small className="goal-date"><CalendarDays size={13}/> Target: {dateLabel(g.target_date)}</small>}</div>)}<button className="goal-add-card" onClick={onAdd}><span><Plus size={23}/></span><b>Dream up a new goal</b><small>Every dream deserves a little plan.</small></button></div>:<section className="panel empty-goals"><EmptyState icon={Target} title="What are you saving for?" text="A trip, a new laptop, an emergency fund — give your next goal a name." action="Create a savings goal" onAction={onAdd}/></section>}</>}
function Modal({modal,onClose,onSaveTransaction,onSaveBudget,onSaveGoal,month}) {
  const item=modal.item||{},type=modal.type;
  function submit(e){e.preventDefault();const d=new FormData(e.currentTarget);
    if(type==='transaction')onSaveTransaction({title:d.get('title'),amount:Number(d.get('amount')),kind:d.get('kind'),category:d.get('category'),spent_on:d.get('spent_on'),note:d.get('note')||null},item.id);
    if(type==='budget')onSaveBudget({category:d.get('category'),monthly_limit:Number(d.get('monthly_limit')),month:d.get('month')});
    if(type==='goal')onSaveGoal({title:d.get('title'),target_amount:Number(d.get('target_amount')),saved_amount:Number(d.get('saved_amount')||0),target_date:d.get('target_date')||null},item.id);
  }
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className="modal-card"><div className="modal-head"><div><span className="modal-kicker">{type==='transaction'?'KEEP YOUR MONEY STORY UPDATED':type==='budget'?'A PLAN THAT FITS YOU':'A DREAM WITH A PLAN'}</span><h2>{type==='transaction'?(item.id?'Edit transaction':'Add a transaction'):type==='budget'?'Set a category budget':item.id?'Edit savings goal':'Create a savings goal'}</h2></div><button className="icon-btn" onClick={onClose}><X size={20}/></button></div><form onSubmit={submit} className="modal-form">
    {type==='transaction'&&<><label>What was it for?<input name="title" defaultValue={item.title||''} placeholder="e.g. Lunch with friends" maxLength="120" required autoFocus/></label><div className="form-two"><label>Amount (₹)<input name="amount" type="number" min="0.01" step="0.01" defaultValue={item.amount||''} placeholder="0.00" required/></label><label>Type<select name="kind" defaultValue={item.kind||'expense'}><option value="expense">Expense</option><option value="income">Income</option></select></label></div><div className="form-two"><label>Category<select name="category" defaultValue={item.category||'Food'}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Date<input name="spent_on" type="date" defaultValue={item.spent_on||today()} required/></label></div><label>Note <span className="optional">(optional)</span><textarea name="note" defaultValue={item.note||''} placeholder="Add a little context…" rows="2" maxLength="1000"/></label></>}
    {type==='budget'&&<><label>Category<select name="category" defaultValue="Food">{categories.filter(c=>c!=='Salary').map(c=><option key={c}>{c}</option>)}</select></label><label>Monthly limit (₹)<input name="monthly_limit" type="number" min="1" step="1" placeholder="e.g. 5000" required/></label><label>Month<input name="month" type="month" defaultValue={month} required/></label><p className="modal-hint">We'll compare this limit with the expenses you record in this category.</p></>}
    {type==='goal'&&<><label>What are you saving for?<input name="title" defaultValue={item.title||''} placeholder="e.g. Goa trip, new laptop…" maxLength="120" required/></label><div className="form-two"><label>Target amount (₹)<input name="target_amount" type="number" min="1" step="1" defaultValue={item.target_amount||''} required/></label><label>Already saved (₹)<input name="saved_amount" type="number" min="0" step="1" defaultValue={item.saved_amount||0} required/></label></div><label>Target date <span className="optional">(optional)</span><input name="target_date" type="date" defaultValue={item.target_date||''}/></label><p className="modal-hint">Update the saved amount whenever you make progress. Keep your dream in sight!</p></>}
    <div className="modal-actions"><button type="button" className="soft-btn" onClick={onClose}>Cancel</button><button className="primary-btn" type="submit"><Check size={16}/>{type==='transaction'?(item.id?'Save changes':'Add transaction'):type==='budget'?'Save budget':item.id?'Save goal':'Create goal'}</button></div>
  </form></div></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
