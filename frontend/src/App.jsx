import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Landmark, MessageSquare, BarChart3 } from 'lucide-react';
import ChatPage from './pages/ChatPage';
import DashboardPage from './pages/DashboardPage';

function NavLink({ to, icon: Icon, children }) {
  const location = useLocation();
  const isActive = location.pathname === to || (to === '/chat' && location.pathname === '/');
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        isActive
          ? 'bg-white/15 text-white'
          : 'text-gray-300 hover:text-white hover:bg-white/10'
      }`}
    >
      <Icon className="w-4 h-4" />
      {children}
    </Link>
  );
}

function Header() {
  return (
    <header className="bg-gradient-to-r from-[#1E2A38] to-[#2d3e50] text-white shadow-lg border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="p-2 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl shadow-lg shadow-orange-500/20 group-hover:shadow-orange-500/30 transition-shadow">
              <Landmark className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-tight">JanSaathi</h1>
              <p className="text-[11px] text-gray-400 font-medium tracking-wide">Har Yojana, Har Naagrik</p>
            </div>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/chat" icon={MessageSquare}>Chat</NavLink>
            <NavLink to="/dashboard" icon={BarChart3}>Dashboard</NavLink>
          </nav>
        </div>
      </div>
    </header>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
