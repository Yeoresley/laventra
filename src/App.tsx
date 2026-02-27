/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Package, 
  User as UserIcon, 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  Truck, 
  Store,
  ChevronRight,
  Filter,
  MoreVertical,
  AlertCircle,
  LogOut,
  Lock,
  Download,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Branch, Client, Order, User } from './types';

const STATUS_LABELS = {
  received: { label: 'Recibido', color: 'bg-blue-100 text-blue-700', icon: Clock },
  processing: { label: 'En Proceso', color: 'bg-amber-100 text-amber-700', icon: Package },
  ready: { label: 'Listo', color: 'bg-indigo-100 text-indigo-700', icon: CheckCircle2 },
  delivered: { label: 'Entregado', color: 'bg-emerald-100 text-emerald-700', icon: Truck },
};

const PAYMENT_LABELS = {
  pending: { label: 'Pendiente', color: 'text-red-600' },
  paid_at_reception: { label: 'Pagado al Recibir', color: 'text-emerald-600' },
  paid_at_delivery: { label: 'Pagado al Entregar', color: 'text-emerald-600' },
};

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('laundry_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Error parsing saved user:", e);
      return null;
    }
  });
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  const [orders, setOrders] = useState<Order[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showUserManagementModal, setShowUserManagementModal] = useState(false);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<number | 'all'>('all');

  // Form State
  const [newOrder, setNewOrder] = useState({
    folio: '',
    client_id: '',
    branch_id: '',
    description: '',
    weight: '',
    pieces: '',
    total_price: '',
    status: 'received',
    payment_status: 'pending'
  });

  const [newClient, setNewClient] = useState({
    name: '',
    phone: '',
    email: ''
  });
  const [showClientForm, setShowClientForm] = useState(false);

  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    role: 'operator' as 'admin' | 'operator',
    branch_id: '',
    name: ''
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const headers = { 'x-user-id': user.id.toString() };
      const [ordersRes, branchesRes, clientsRes] = await Promise.all([
        fetch('/api/orders', { headers }),
        fetch('/api/branches', { headers }),
        fetch('/api/clients', { headers })
      ]);
      
      const [ordersData, branchesData, clientsData] = await Promise.all([
        ordersRes.json(),
        branchesRes.json(),
        clientsRes.json()
      ]);

      setOrders(ordersData);
      setBranches(branchesData);
      setClients(clientsData);
      
      if (user.role === 'admin') {
        const usersRes = await fetch('/api/admin/users', { headers });
        const usersData = await usersRes.json();
        setAdminUsers(usersData);
      }

      if (branchesData.length > 0) {
        setNewOrder(prev => ({ ...prev, branch_id: branchesData[0].id.toString() }));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        localStorage.setItem('laundry_user', JSON.stringify(userData));
      } else {
        setLoginError('Usuario o contraseña incorrectos');
      }
    } catch (error) {
      setLoginError('Error de conexión');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('laundry_user');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': user!.id.toString()
        },
        body: JSON.stringify({
          ...newUser,
          branch_id: newUser.role === 'operator' ? parseInt(newUser.branch_id) : null
        })
      });
      if (res.ok) {
        setShowNewUserModal(false);
        setNewUser({
          username: '',
          password: '',
          role: 'operator',
          branch_id: '',
          name: ''
        });
        fetchData();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating user:', error);
    }
  };

  const handleDownloadBackup = async () => {
    if (!user || user.role !== 'admin') return;
    try {
      const response = await fetch('/api/admin/backup', {
        headers: { 'x-user-id': user.id.toString() }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'respaldo_lavanderia.db';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        alert('Error al descargar el respaldo');
      }
    } catch (error) {
      console.error('Backup error:', error);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': user!.id.toString()
        },
        body: JSON.stringify(newClient)
      });
      const data = await res.json();
      const updatedClients = [...clients, { ...newClient, id: data.id }];
      setClients(updatedClients);
      setNewOrder(prev => ({ ...prev, client_id: data.id.toString() }));
      setShowClientForm(false);
      setNewClient({ name: '', phone: '', email: '' });
    } catch (error) {
      console.error('Error creating client:', error);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': user!.id.toString()
        },
        body: JSON.stringify({
          ...newOrder,
          client_id: parseInt(newOrder.client_id),
          branch_id: parseInt(newOrder.branch_id),
          weight: parseFloat(newOrder.weight) || 0,
          pieces: parseInt(newOrder.pieces) || 0,
          total_price: parseFloat(newOrder.total_price) || 0
        })
      });
      
      if (res.ok) {
        setShowNewOrderModal(false);
        setNewOrder({
          folio: '',
          client_id: '',
          branch_id: branches[0]?.id.toString() || '',
          description: '',
          weight: '',
          pieces: '',
          total_price: '',
          status: 'received',
          payment_status: 'pending'
        });
        fetchData();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating order:', error);
    }
  };

  const updateOrderStatus = async (id: number, status: string) => {
    await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'x-user-id': user!.id.toString()
      },
      body: JSON.stringify({ status })
    });
    fetchData();
  };

  const updateOrderPayment = async (id: number, payment_status: string) => {
    await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'x-user-id': user!.id.toString()
      },
      body: JSON.stringify({ payment_status })
    });
    fetchData();
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesBranch = selectedBranch === 'all' || order.branch_id === selectedBranch;
    
    return matchesSearch && matchesBranch;
  });

  const isToday = (dateStr: string) => {
    if (!dateStr) return false;
    try {
      // SQLite format: YYYY-MM-DD HH:MM:SS (UTC)
      const isoStr = dateStr.replace(' ', 'T') + 'Z';
      const date = new Date(isoStr);
      const today = new Date();
      
      return date.getFullYear() === today.getFullYear() &&
             date.getMonth() === today.getMonth() &&
             date.getDate() === today.getDate();
    } catch (e) {
      console.error("Error checking date:", e);
      return false;
    }
  };

  // Stats should respect the branch filter if selected
  const statsBaseOrders = selectedBranch === 'all' ? orders : orders.filter(o => o.branch_id === selectedBranch);
  const todayOrders = statsBaseOrders.filter(o => isToday(o.created_at));

  const stats = {
    today: {
      received: todayOrders.filter(o => o.status === 'received').length,
      processing: todayOrders.filter(o => o.status === 'processing').length,
      ready: todayOrders.filter(o => o.status === 'ready').length,
      delivered: todayOrders.filter(o => o.status === 'delivered').length,
      total: todayOrders.length
    },
    all: {
      received: statsBaseOrders.filter(o => o.status === 'received').length,
      processing: statsBaseOrders.filter(o => o.status === 'processing').length,
      ready: statsBaseOrders.filter(o => o.status === 'ready').length,
      delivered: statsBaseOrders.filter(o => o.status === 'delivered').length,
      total: statsBaseOrders.length
    },
    payments: {
      pending: statsBaseOrders.filter(o => o.payment_status === 'pending').length,
      paid: statsBaseOrders.filter(o => o.payment_status !== 'pending').length
    },
    global: {
      pending_delivery: statsBaseOrders.filter(o => o.status !== 'delivered').length
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-xl w-full max-w-md"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-indigo-200">
              <Package size={32} />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900">Lavandería Pro</h1>
            <p className="text-zinc-500 text-sm">Ingresa a tu cuenta para continuar</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase">Usuario</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input 
                  type="text" 
                  value={loginData.username}
                  onChange={(e) => setLoginData({...loginData, username: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="admin o operador1"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input 
                  type="password" 
                  value={loginData.password}
                  onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {loginError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle size={16} />
                {loginError}
              </div>
            )}

            <button 
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-200 mt-4"
            >
              Iniciar Sesión
            </button>
          </form>
          
          <div className="mt-8 pt-6 border-t border-zinc-100 text-center">
            <p className="text-xs text-zinc-400">Demo: admin/admin123 o operador1/op123</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
              <Package size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Lavandería Pro</h1>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                {user.role === 'admin' ? 'Panel Administrador' : `Sucursal: ${branches.find(b => b.id === user.branch_id)?.name || 'Cargando...'}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
              <p className="text-sm font-bold text-zinc-900">{user.name}</p>
              <p className="text-[10px] text-zinc-400 font-bold uppercase">{user.role}</p>
            </div>
            <button 
              onClick={fetchData}
              className="p-2 text-zinc-400 hover:text-indigo-600 transition-colors"
              title="Actualizar Datos"
            >
              <Clock size={20} className={loading ? "animate-spin" : ""} />
            </button>
            {user.role === 'admin' && (
              <>
                <button 
                  onClick={() => setShowUserManagementModal(true)}
                  className="p-2 text-zinc-400 hover:text-indigo-600 transition-colors"
                  title="Gestión de Usuarios"
                >
                  <Users size={20} />
                </button>
                <button 
                  onClick={handleDownloadBackup}
                  className="p-2 text-zinc-400 hover:text-indigo-600 transition-colors"
                  title="Descargar Respaldo DB"
                >
                  <Download size={20} />
                </button>
              </>
            )}
            <button 
              onClick={handleLogout}
              className="p-2 text-zinc-400 hover:text-red-600 transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut size={20} />
            </button>
            <button 
              onClick={() => setShowNewOrderModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Nuevo Ticket</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Stats Section */}
        <div className="space-y-6 mb-8">
          <div>
            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Package size={14} /> Estado Actual (Todo)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Recibidos', value: stats.all.received, color: 'text-blue-600', bg: 'bg-blue-50', icon: Clock },
                { label: 'En Proceso', value: stats.all.processing, color: 'text-amber-600', bg: 'bg-amber-50', icon: Package },
                { label: 'Listos', value: stats.all.ready, color: 'text-indigo-600', bg: 'bg-indigo-50', icon: CheckCircle2 },
                { label: 'Entregados', value: stats.all.delivered, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: Truck },
                { label: 'Total Tickets', value: stats.all.total, color: 'text-zinc-600', bg: 'bg-zinc-100', icon: Filter },
              ].map((stat, i) => (
                <div key={i} className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
                  <div className={`${stat.bg} ${stat.color} w-8 h-8 rounded-lg flex items-center justify-center mb-2`}>
                    <stat.icon size={16} />
                  </div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-xl font-bold mt-0.5">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Clock size={14} /> Actividad de Hoy ({new Date().toLocaleDateString()})
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 opacity-80">
              {[
                { label: 'Recibidos', value: stats.today.received },
                { label: 'En Proceso', value: stats.today.processing },
                { label: 'Listos', value: stats.today.ready },
                { label: 'Entregados', value: stats.today.delivered },
                { label: 'Total Hoy', value: stats.today.total },
              ].map((stat, i) => (
                <div key={i} className="bg-zinc-50 p-3 rounded-xl border border-zinc-200">
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-lg font-bold text-zinc-700">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <CreditCard size={14} /> Resumen de Pagos y Pendientes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Pendientes de Entrega</p>
                  <p className="text-2xl font-bold mt-0.5 text-indigo-600">{stats.global.pending_delivery}</p>
                </div>
                <div className="bg-indigo-50 text-indigo-600 w-12 h-12 rounded-xl flex items-center justify-center">
                  <Package size={24} />
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Pendientes de Pago</p>
                  <p className="text-2xl font-bold mt-0.5 text-red-600">{stats.payments.pending}</p>
                </div>
                <div className="bg-red-50 text-red-600 w-12 h-12 rounded-xl flex items-center justify-center">
                  <AlertCircle size={24} />
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Pagados</p>
                  <p className="text-2xl font-bold mt-0.5 text-emerald-600">{stats.payments.paid}</p>
                </div>
                <div className="bg-emerald-50 text-emerald-600 w-12 h-12 rounded-xl flex items-center justify-center">
                  <CheckCircle2 size={24} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por folio, cliente o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
            />
          </div>
          <div className="flex gap-2">
            <select 
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className="bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">Todas las Sucursales</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {loading ? (
              <div className="py-20 text-center text-zinc-500">Cargando datos...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-zinc-300">
                <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400">
                  <AlertCircle size={32} />
                </div>
                <p className="font-medium text-zinc-900">No se encontraron tickets</p>
                <p className="text-sm text-zinc-500 mt-1">Intenta con otra búsqueda o crea uno nuevo.</p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const StatusIcon = STATUS_LABELS[order.status].icon;
                return (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={order.id}
                    className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${STATUS_LABELS[order.status].color}`}>
                          <StatusIcon size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-900">Folio: {order.folio}</span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_LABELS[order.status].color}`}>
                              {STATUS_LABELS[order.status].label}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-zinc-600">{order.client_name || 'Cliente General'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-zinc-900">${order.total_price.toFixed(2)}</p>
                        <p className={`text-xs font-semibold ${PAYMENT_LABELS[order.payment_status].color}`}>
                          {PAYMENT_LABELS[order.payment_status].label}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-3 border-y border-zinc-100 mb-4">
                      <div>
                        <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Descripción</p>
                        <p className="text-xs font-medium text-zinc-700 truncate">{order.description || 'Sin descripción'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Peso / Piezas</p>
                        <p className="text-xs font-medium text-zinc-700">{order.weight}kg • {order.pieces} pzas</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Sucursal</p>
                        <p className="text-xs font-medium text-zinc-700">{order.branch_name}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Fecha</p>
                        <p className="text-xs font-medium text-zinc-700">{new Date(order.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <select 
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                        className="text-xs font-semibold bg-zinc-100 border-none rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500/20"
                      >
                        {Object.entries(STATUS_LABELS).map(([val, { label }]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                      <select 
                        value={order.payment_status}
                        onChange={(e) => updateOrderPayment(order.id, e.target.value)}
                        className="text-xs font-semibold bg-zinc-100 border-none rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500/20"
                      >
                        {Object.entries(PAYMENT_LABELS).map(([val, { label }]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* User Management Modal */}
      <AnimatePresence>
        {showUserManagementModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUserManagementModal(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h2 className="text-xl font-bold">Gestión de Usuarios</h2>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowNewUserModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
                  >
                    <Plus size={14} /> Nuevo
                  </button>
                  <button onClick={() => setShowUserManagementModal(false)} className="text-zinc-400 hover:text-zinc-600">
                    <AlertCircle size={24} className="rotate-45" />
                  </button>
                </div>
              </div>

              <div className="p-6 max-h-[70vh] overflow-y-auto">
                <div className="space-y-3">
                  {adminUsers.map(u => (
                    <div key={u.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-zinc-200 rounded-full flex items-center justify-center text-zinc-600">
                          <UserIcon size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-900">{u.name}</p>
                          <p className="text-xs text-zinc-500">@{u.username} • {u.role === 'admin' ? 'Admin' : `Operador (${(u as any).branch_name || 'Sin sucursal'})`}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New User Modal */}
      <AnimatePresence>
        {showNewUserModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewUserModal(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h2 className="text-xl font-bold">Nuevo Usuario</h2>
                <button onClick={() => setShowNewUserModal(false)} className="text-zinc-400 hover:text-zinc-600">
                  <AlertCircle size={24} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Nombre Completo</label>
                  <input 
                    required
                    type="text" 
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                    placeholder="Ej: Juan Pérez"
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Usuario</label>
                  <input 
                    required
                    type="text" 
                    value={newUser.username}
                    onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                    placeholder="Ej: juanp"
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Contraseña</label>
                  <input 
                    required
                    type="password" 
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Rol</label>
                  <select 
                    required
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value as 'admin' | 'operator'})}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
                  >
                    <option value="operator">Operador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                {newUser.role === 'operator' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Sucursal</label>
                    <select 
                      required
                      value={newUser.branch_id}
                      onChange={(e) => setNewUser({...newUser, branch_id: e.target.value})}
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
                    >
                      <option value="">Seleccionar Sucursal</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="pt-4">
                  <button 
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-200"
                  >
                    Crear Usuario
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Order Modal */}
      <AnimatePresence>
        {showNewOrderModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewOrderModal(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h2 className="text-xl font-bold">Nuevo Ticket de Lavandería</h2>
                <button onClick={() => setShowNewOrderModal(false)} className="text-zinc-400 hover:text-zinc-600">
                  <AlertCircle size={24} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={handleCreateOrder} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Folio / Ticket</label>
                    <input 
                      required
                      type="text" 
                      value={newOrder.folio}
                      onChange={(e) => setNewOrder({...newOrder, folio: e.target.value})}
                      placeholder="Ej: A-101"
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Sucursal</label>
                    <select 
                      required
                      value={newOrder.branch_id}
                      onChange={(e) => setNewOrder({...newOrder, branch_id: e.target.value})}
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
                    >
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Cliente</label>
                    <button 
                      type="button"
                      onClick={() => setShowClientForm(!showClientForm)}
                      className="text-[10px] font-bold text-indigo-600 uppercase hover:underline"
                    >
                      {showClientForm ? 'Cancelar' : '+ Nuevo Cliente'}
                    </button>
                  </div>
                  
                  {showClientForm ? (
                    <div className="p-4 bg-indigo-50 rounded-2xl space-y-3 border border-indigo-100">
                      <input 
                        type="text" 
                        placeholder="Nombre Completo"
                        value={newClient.name}
                        onChange={(e) => setNewClient({...newClient, name: e.target.value})}
                        className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm outline-none"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input 
                          type="tel" 
                          placeholder="Teléfono"
                          value={newClient.phone}
                          onChange={(e) => setNewClient({...newClient, phone: e.target.value})}
                          className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm outline-none"
                        />
                        <button 
                          type="button"
                          onClick={handleCreateClient}
                          className="bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase"
                        >
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <select 
                      required
                      value={newOrder.client_id}
                      onChange={(e) => setNewOrder({...newOrder, client_id: e.target.value})}
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
                    >
                      <option value="">Seleccionar Cliente</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Descripción de la Ropa</label>
                  <textarea 
                    value={newOrder.description}
                    onChange={(e) => setNewOrder({...newOrder, description: e.target.value})}
                    placeholder="Ej: 5 camisas, 2 pantalones, edredón matrimonial..."
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm h-20 resize-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Peso (kg)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      value={newOrder.weight}
                      onChange={(e) => setNewOrder({...newOrder, weight: e.target.value})}
                      placeholder="0.0"
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Piezas</label>
                    <input 
                      type="number" 
                      value={newOrder.pieces}
                      onChange={(e) => setNewOrder({...newOrder, pieces: e.target.value})}
                      placeholder="0"
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Total ($)</label>
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      value={newOrder.total_price}
                      onChange={(e) => setNewOrder({...newOrder, total_price: e.target.value})}
                      placeholder="0.00"
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-bold text-indigo-600"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Estado de Pago</label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(PAYMENT_LABELS).map(([val, { label }]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setNewOrder({...newOrder, payment_status: val})}
                        className={`py-2 px-1 rounded-lg text-[10px] font-bold uppercase transition-all border ${
                          newOrder.payment_status === val 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                            : 'bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-200"
                  >
                    Registrar Ticket
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
