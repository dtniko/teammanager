import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    Menu,
    X,
    Home,
    Users,
    Calendar,
    FileText,
    MessageSquare,
    Bell,
    Settings,
    LogOut,
    UserCircle,
    Shield,
    ChevronDown,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import NotificationDropdown from '../Notifications/NotificationDropdown';

const Layout = ({ user, onLogout, children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const location = useLocation();
    const { unreadCount } = useNotifications();

    // Configurazione menu di navigazione
    const navigationItems = [
        {
            name: 'Dashboard',
            href: '/dashboard',
            icon: Home,
            roles: ['admin', 'coach', 'parent', 'athlete']
        },
        {
            name: 'Atleti',
            href: '/athletes',
            icon: Users,
            roles: ['admin', 'coach', 'parent']
        },
        {
            name: 'Calendario',
            href: '/calendar',
            icon: Calendar,
            roles: ['admin', 'coach', 'parent', 'athlete']
        },
        {
            name: 'Documenti',
            href: '/documents',
            icon: FileText,
            roles: ['admin', 'coach', 'parent', 'athlete']
        },
        {
            name: 'Comunicazioni',
            href: '/communications',
            icon: MessageSquare,
            roles: ['admin', 'coach', 'parent', 'athlete']
        },
        {
            name: 'Gruppi',
            href: '/groups',
            icon: Shield,
            roles: ['admin', 'coach']
        },
        {
            name: 'Utenti',
            href: '/users',
            icon: UserCircle,
            roles: ['admin']
        }
    ];

    // Filtra elementi di navigazione in base al ruolo
    const allowedNavItems = navigationItems.filter(item =>
        item.roles.includes(user.role)
    );

    const isActiveRoute = (href) => {
        return location.pathname === href ||
            (href !== '/dashboard' && location.pathname.startsWith(href));
    };

    const getRoleBadgeColor = (role) => {
        const colors = {
            admin: 'bg-red-100 text-red-800',
            coach: 'bg-blue-100 text-blue-800',
            parent: 'bg-green-100 text-green-800',
            athlete: 'bg-purple-100 text-purple-800'
        };
        return colors[role] || 'bg-gray-100 text-gray-800';
    };

    const getRoleLabel = (role) => {
        const labels = {
            admin: 'Amministratore',
            coach: 'Allenatore',
            parent: 'Genitore',
            athlete: 'Atleta'
        };
        return labels[role] || role;
    };

    const sidebarWidth = sidebarCollapsed ? 'w-16' : 'w-64';

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Sidebar Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={`
                fixed inset-y-0 left-0 z-50 ${sidebarWidth} bg-white shadow-lg transform transition-all duration-300 ease-in-out 
                lg:translate-x-0
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                {/* Header Sidebar */}
                <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
                    {!sidebarCollapsed && (
                        <div className="flex items-center min-w-0">
                            <div className="flex-shrink-0">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                                    <span className="text-white font-bold text-lg">SC</span>
                                </div>
                            </div>
                            <div className="ml-3 min-w-0">
                                <h1 className="text-xl font-bold text-gray-900 truncate">SportClub</h1>
                                <p className="text-xs text-gray-500">Manager</p>
                            </div>
                        </div>
                    )}

                    {sidebarCollapsed && (
                        <div className="flex justify-center">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                                <span className="text-white font-bold text-lg">SC</span>
                            </div>
                        </div>
                    )}

                    {/* Collapse/Expand button per desktop */}
                    <div className="hidden lg:flex">
                        <button
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            {sidebarCollapsed ? (
                                <ChevronRight className="h-4 w-4" />
                            ) : (
                                <ChevronLeft className="h-4 w-4" />
                            )}
                        </button>
                    </div>

                    {/* Close button per mobile */}
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
                    {allowedNavItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = isActiveRoute(item.href);

                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={`
                                    group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                                    ${isActive
                                    ? 'bg-blue-100 text-blue-700 shadow-sm'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                }
                                    ${sidebarCollapsed ? 'justify-center' : ''}
                                `}
                                title={sidebarCollapsed ? item.name : ''}
                            >
                                <Icon className={`
                                    h-5 w-5 transition-colors duration-200 flex-shrink-0
                                    ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}
                                    ${sidebarCollapsed ? '' : 'mr-3'}
                                `} />
                                {!sidebarCollapsed && (
                                    <span className="truncate">{item.name}</span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* User Info in Sidebar */}
                <div className="flex-shrink-0 p-4 border-t border-gray-200">
                    {!sidebarCollapsed ? (
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                {user.avatarUrl ? (
                                    <img
                                        src={user.avatarUrl}
                                        alt={`${user.firstName} ${user.lastName}`}
                                        className="w-10 h-10 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center">
                                        <span className="text-white font-medium text-sm">
                                            {user.firstName?.[0]}{user.lastName?.[0]}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="ml-3 min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                    {user.firstName} {user.lastName}
                                </p>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${getRoleBadgeColor(user.role)}`}>
                                    {getRoleLabel(user.role)}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-center">
                            {user.avatarUrl ? (
                                <img
                                    src={user.avatarUrl}
                                    alt={`${user.firstName} ${user.lastName}`}
                                    className="w-10 h-10 rounded-full object-cover"
                                    title={`${user.firstName} ${user.lastName}`}
                                />
                            ) : (
                                <div
                                    className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center"
                                    title={`${user.firstName} ${user.lastName}`}
                                >
                                    <span className="text-white font-medium text-sm">
                                        {user.firstName?.[0]}{user.lastName?.[0]}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
                {/* Top Navigation - HEADER GLOBALE */}
                <header className="bg-white shadow-sm border-b border-gray-200 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-30">
                    {/* Mobile menu button */}
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                    >
                        <Menu className="h-6 w-6" />
                    </button>

                    {/* Page title for mobile */}
                    <div className="flex-1 lg:flex-none">
                        <h2 className="text-lg font-semibold text-gray-900 lg:hidden">
                            SportClub Manager
                        </h2>
                    </div>

                    {/* Right side actions */}
                    <div className="flex items-center space-x-3">
                        {/* Notifications */}
                        <div className="relative">
                            <button
                                onClick={() => setNotificationsOpen(!notificationsOpen)}
                                className="p-2 rounded-lg text-gray-400 hover:text-gray-500 hover:bg-gray-100 relative transition-colors"
                            >
                                <Bell className="h-6 w-6" />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>

                            {notificationsOpen && (
                                <NotificationDropdown onClose={() => setNotificationsOpen(false)} />
                            )}
                        </div>

                        {/* User menu */}
                        <div className="relative">
                            <button
                                onClick={() => setUserMenuOpen(!userMenuOpen)}
                                className="flex items-center space-x-2 p-2 rounded-lg text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                            >
                                {user.avatarUrl ? (
                                    <img
                                        src={user.avatarUrl}
                                        alt={`${user.firstName} ${user.lastName}`}
                                        className="w-8 h-8 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center">
                                        <span className="text-white font-medium text-xs">
                                            {user.firstName?.[0]}{user.lastName?.[0]}
                                        </span>
                                    </div>
                                )}
                                <ChevronDown className="h-4 w-4" />
                            </button>

                            {/* User dropdown menu */}
                            {userMenuOpen && (
                                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg py-1 z-50 border border-gray-200">
                                    <div className="px-4 py-3 border-b border-gray-100">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                            {user.firstName} {user.lastName}
                                        </p>
                                        <p className="text-sm text-gray-500 truncate">{user.email}</p>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-2 ${getRoleBadgeColor(user.role)}`}>
                                            {getRoleLabel(user.role)}
                                        </span>
                                    </div>

                                    <Link
                                        to="/profile"
                                        onClick={() => setUserMenuOpen(false)}
                                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                    >
                                        <Settings className="mr-3 h-4 w-4" />
                                        Profilo e Impostazioni
                                    </Link>

                                    <button
                                        onClick={() => {
                                            setUserMenuOpen(false);
                                            onLogout();
                                        }}
                                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                    >
                                        <LogOut className="mr-3 h-4 w-4" />
                                        Disconnetti
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="min-h-[calc(100vh-4rem)] bg-gray-50">
                    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>

            {/* Click outside to close dropdowns */}
            {(userMenuOpen || notificationsOpen) && (
                <div
                    className="fixed inset-0 z-20"
                    onClick={() => {
                        setUserMenuOpen(false);
                        setNotificationsOpen(false);
                    }}
                />
            )}
        </div>
    );
};

export default Layout;
