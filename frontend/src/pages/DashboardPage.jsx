import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import {
  Users, MessageSquare, TrendingUp, Activity, Globe, Mic,
  Shield, Clock, ArrowUpRight, ArrowDownRight, RefreshCw,
  Landmark, Heart, GraduationCap, Home, Wallet, Sprout,
  Zap, Award, ChevronRight, BarChart3, PieChart as PieIcon,
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/* ── colour palette ──────────────────────────── */
const COLORS = {
  saffron: '#FF6B35',
  navy: '#1E2A38',
  gold: '#D4A847',
  teal: '#0D9488',
  indigo: '#6366F1',
  rose: '#F43F5E',
  emerald: '#10B981',
  sky: '#0EA5E9',
  amber: '#F59E0B',
  violet: '#8B5CF6',
};

const PIE_COLORS = [COLORS.saffron, COLORS.teal, COLORS.indigo, COLORS.gold, COLORS.rose, COLORS.emerald, COLORS.sky, COLORS.amber];

const CATEGORY_ICONS = {
  Agriculture: Sprout,
  Health: Heart,
  Education: GraduationCap,
  Housing: Home,
  Financial: Wallet,
  Social: Users,
  Energy: Zap,
};

/* ── static fallback data ────────────────────── */
const FALLBACK_STATS = {
  totalUsers: 156,
  totalQueries: 482,
  penetrationRate: 72,
  topSchemes: [
    { name: 'PM-KISAN', queries: 89 },
    { name: 'Ayushman Bharat', queries: 67 },
    { name: 'MGNREGA', queries: 54 },
    { name: 'PM Awas', queries: 43 },
    { name: 'Ujjwala', queries: 38 },
    { name: 'Mudra Yojana', queries: 31 },
  ],
};

const FALLBACK_QUERIES = [
  { id: 1, timestamp: new Date().toISOString(), state: 'Uttar Pradesh', language: 'hi', schemes: ['PM-KISAN', 'Fasal Bima', 'KCC'], sentiment: 'POSITIVE' },
  { id: 2, timestamp: new Date(Date.now() - 300000).toISOString(), state: 'Tamil Nadu', language: 'ta', schemes: ['Ayushman Bharat', 'Ujjwala'], sentiment: 'NEUTRAL' },
  { id: 3, timestamp: new Date(Date.now() - 600000).toISOString(), state: 'Karnataka', language: 'en', schemes: ['NSP SC Scholarship'], sentiment: 'POSITIVE' },
  { id: 4, timestamp: new Date(Date.now() - 900000).toISOString(), state: 'Maharashtra', language: 'mr', schemes: ['MGNREGA', 'PM Awas'], sentiment: 'NEGATIVE' },
  { id: 5, timestamp: new Date(Date.now() - 1200000).toISOString(), state: 'West Bengal', language: 'bn', schemes: ['Mudra Yojana'], sentiment: 'NEUTRAL' },
];

const CATEGORY_DATA = [
  { name: 'Agriculture', value: 35, color: COLORS.emerald },
  { name: 'Health', value: 22, color: COLORS.rose },
  { name: 'Education', value: 18, color: COLORS.indigo },
  { name: 'Financial', value: 15, color: COLORS.gold },
  { name: 'Housing', value: 6, color: COLORS.sky },
  { name: 'Social', value: 4, color: COLORS.violet },
];

const USAGE_TREND = [
  { day: 'Mon', queries: 42, users: 12 },
  { day: 'Tue', queries: 58, users: 18 },
  { day: 'Wed', queries: 65, users: 22 },
  { day: 'Thu', queries: 71, users: 25 },
  { day: 'Fri', queries: 89, users: 31 },
  { day: 'Sat', queries: 94, users: 28 },
  { day: 'Sun', queries: 63, users: 20 },
];

const LANGUAGE_DATA = [
  { name: 'Hindi', value: 45, code: 'hi' },
  { name: 'English', value: 25, code: 'en' },
  { name: 'Tamil', value: 12, code: 'ta' },
  { name: 'Telugu', value: 8, code: 'te' },
  { name: 'Bengali', value: 6, code: 'bn' },
  { name: 'Marathi', value: 4, code: 'mr' },
];

/* ── custom tooltip ──────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl px-4 py-3 shadow-xl">
      <p className="text-sm font-semibold text-gray-800">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm mt-1" style={{ color: entry.color }}>
          {entry.name}: <span className="font-bold">{entry.value}</span>
        </p>
      ))}
    </div>
  );
};

/* ── stat card ───────────────────────────────── */
function StatCard({ icon: Icon, label, value, change, changeType, color, bgColor }) {
  const isPositive = changeType === 'up';
  return (
    <div className="group bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300 hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        <div className={`p-3 rounded-xl ${bgColor}`}>
          <Icon className={`w-6 h-6 ${color}`} strokeWidth={2} />
        </div>
        {change && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
            isPositive ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
          }`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {change}
          </div>
        )}
      </div>
      <p className="mt-4 text-3xl font-bold text-gray-900 tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-gray-500 font-medium">{label}</p>
    </div>
  );
}

/* ── sentiment badge ─────────────────────────── */
function SentimentBadge({ sentiment }) {
  const config = {
    POSITIVE: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    NEUTRAL: { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' },
    NEGATIVE: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
    MIXED: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  };
  const c = config[sentiment] || config.NEUTRAL;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}></span>
      {sentiment?.charAt(0) + sentiment?.slice(1).toLowerCase()}
    </span>
  );
}

/* ── language badge ──────────────────────────── */
function LanguageBadge({ language }) {
  const names = { hi: 'Hindi', en: 'English', ta: 'Tamil', te: 'Telugu', bn: 'Bengali', mr: 'Marathi' };
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700">
      <Globe className="w-3 h-3" />
      {names[language] || language}
    </span>
  );
}

/* ── main dashboard ──────────────────────────── */
function DashboardPage() {
  const [stats, setStats] = useState(FALLBACK_STATS);
  const [queries, setQueries] = useState(FALLBACK_QUERIES);
  const [isLive, setIsLive] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, queriesRes] = await Promise.all([
        axios.get(`${API_URL}/api/dashboard/stats`),
        axios.get(`${API_URL}/api/dashboard/queries`),
      ]);
      setStats(statsRes.data);
      setQueries(queriesRes.data.queries);
      setIsLive(true);
    } catch {
      setIsLive(false);
    }
    setLastRefresh(new Date());
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Header ─────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Analytics Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Real-time welfare scheme discovery insights</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
              isLive ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
              {isLive ? 'Live' : 'Demo Data'}
            </div>
            <button
              onClick={fetchData}
              className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-white hover:text-gray-700 hover:shadow-sm transition-all"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Stat Cards ─────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatCard icon={Users} label="Total Users" value={stats.totalUsers.toLocaleString()} change="+12%" changeType="up" color="text-indigo-600" bgColor="bg-indigo-50" />
          <StatCard icon={MessageSquare} label="Total Queries" value={stats.totalQueries.toLocaleString()} change="+23%" changeType="up" color="text-saffron" bgColor="bg-orange-50" />
          <StatCard icon={TrendingUp} label="Penetration Rate" value={`${stats.penetrationRate}%`} change="+5%" changeType="up" color="text-emerald-600" bgColor="bg-emerald-50" />
          <StatCard icon={Activity} label="Avg. Response" value="3.2s" change="-0.4s" changeType="up" color="text-sky-600" bgColor="bg-sky-50" />
        </div>

        {/* ── Feature Badges ─────────────────── */}
        <div className="flex flex-wrap gap-2 mb-8">
          {[
            { icon: Shield, label: 'Bedrock AI', active: true },
            { icon: Globe, label: '6 Languages', active: true },
            { icon: Mic, label: 'Voice Input', active: true },
            { icon: Landmark, label: '20 Schemes', active: true },
          ].map(({ icon: Ic, label, active }) => (
            <span key={label} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              active ? 'bg-white border-gray-200 text-gray-700' : 'bg-gray-50 border-gray-100 text-gray-400'
            }`}>
              <Ic className="w-3.5 h-3.5" />
              {label}
              {active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-0.5"></span>}
            </span>
          ))}
        </div>

        {/* ── Tab Navigation ─────────────────── */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-8">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'categories', label: 'Categories', icon: PieIcon },
            { id: 'queries', label: 'Recent Queries', icon: Clock },
          ].map(({ id, label, icon: Ic }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Ic className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ───────────────────── */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Schemes Bar Chart */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Top Queried Schemes</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Most searched welfare programs</p>
                </div>
                <BarChart3 className="w-5 h-5 text-gray-400" />
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.topSchemes} barSize={36} barGap={8}>
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.saffron} stopOpacity={1} />
                      <stop offset="100%" stopColor={COLORS.saffron} stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="queries" fill="url(#barGrad)" radius={[8, 8, 0, 0]} name="Queries" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Language Distribution */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Languages</h2>
                  <p className="text-sm text-gray-500 mt-0.5">User language distribution</p>
                </div>
                <Globe className="w-5 h-5 text-gray-400" />
              </div>
              <div className="space-y-4">
                {LANGUAGE_DATA.map((lang, idx) => (
                  <div key={lang.code}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700">{lang.name}</span>
                      <span className="text-sm font-bold text-gray-900">{lang.value}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${lang.value}%`,
                          backgroundColor: PIE_COLORS[idx % PIE_COLORS.length],
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Weekly Trend */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Weekly Trend</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Queries and active users this week</p>
                </div>
                <TrendingUp className="w-5 h-5 text-gray-400" />
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={USAGE_TREND}>
                  <defs>
                    <linearGradient id="areaQueries" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.saffron} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={COLORS.saffron} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="areaUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.teal} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={COLORS.teal} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="queries" stroke={COLORS.saffron} fill="url(#areaQueries)" strokeWidth={2.5} name="Queries" dot={{ fill: COLORS.saffron, r: 4 }} />
                  <Area type="monotone" dataKey="users" stroke={COLORS.teal} fill="url(#areaUsers)" strokeWidth={2.5} name="Users" dot={{ fill: COLORS.teal, r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* AWS Services Status */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">AWS Services</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Infrastructure health</p>
                </div>
                <Activity className="w-5 h-5 text-gray-400" />
              </div>
              <div className="space-y-3">
                {[
                  { name: 'Bedrock (Claude 3)', status: 'active', latency: '1.2s' },
                  { name: 'Translate', status: 'active', latency: '0.3s' },
                  { name: 'Transcribe', status: 'active', latency: '2.1s' },
                  { name: 'Comprehend', status: 'standby', latency: '0.4s' },
                  { name: 'Polly', status: 'standby', latency: '0.8s' },
                  { name: 'DynamoDB', status: 'active', latency: '0.1s' },
                  { name: 'S3', status: 'active', latency: '0.05s' },
                  { name: 'SNS', status: 'standby', latency: '0.2s' },
                ].map((svc) => (
                  <div key={svc.name} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${
                        svc.status === 'active' ? 'bg-emerald-500' : 'bg-amber-400'
                      }`}></span>
                      <span className="text-sm font-medium text-gray-700">{svc.name}</span>
                    </div>
                    <span className="text-xs text-gray-400 font-mono">{svc.latency}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Categories Tab ─────────────────── */}
        {activeTab === 'categories' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Scheme Categories</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Distribution by query topic</p>
                </div>
                <PieIcon className="w-5 h-5 text-gray-400" />
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={CATEGORY_DATA}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={120}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {CATEGORY_DATA.map((entry, idx) => (
                      <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 mt-4">
                {CATEGORY_DATA.map((cat, idx) => (
                  <span key={cat.name} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[idx] }}></span>
                    {cat.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Category Cards */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Scheme Breakdown</h2>
              {CATEGORY_DATA.map((cat, idx) => {
                const CatIcon = CATEGORY_ICONS[cat.name] || Landmark;
                return (
                  <div key={cat.name} className="flex items-center gap-4 bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-all">
                    <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${PIE_COLORS[idx]}15` }}>
                      <CatIcon className="w-5 h-5" style={{ color: PIE_COLORS[idx] }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-800">{cat.name}</span>
                        <span className="text-sm font-bold" style={{ color: PIE_COLORS[idx] }}>{cat.value}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${cat.value}%`, backgroundColor: PIE_COLORS[idx] }}></div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Recent Queries Tab ─────────────── */}
        {activeTab === 'queries' && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Recent Queries</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Latest citizen interactions</p>
                </div>
                <span className="text-xs text-gray-400">
                  Updated {lastRefresh.toLocaleTimeString()}
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/80">
                    <th className="text-left py-3.5 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="text-left py-3.5 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">State</th>
                    <th className="text-left py-3.5 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Language</th>
                    <th className="text-left py-3.5 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sentiment</th>
                    <th className="text-left py-3.5 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Matched Schemes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {queries.map((query) => (
                    <tr key={query.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {new Date(query.timestamp).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm font-medium text-gray-800">{query.state}</td>
                      <td className="py-4 px-6">
                        <LanguageBadge language={query.language || 'en'} />
                      </td>
                      <td className="py-4 px-6">
                        <SentimentBadge sentiment={query.sentiment || 'NEUTRAL'} />
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap gap-1.5">
                          {(query.schemes || []).map((s, i) => (
                            <span key={i} className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Footer ─────────────────────────── */}
        <div className="mt-10 text-center text-xs text-gray-400">
          <p>JanSaathi Analytics Dashboard &middot; Powered by 9 AWS Services &middot; AI for Bharat Hackathon</p>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
