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
    ChevronDown
} from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import NotificationDropdown from '../Notifications/NotificationDropdown';

const Layout = ({ user, onLogout, children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const location = useLocation();
    const { unreadCount } = useNotifications();

    // Configurazione menu di navigazione riorganizzato
    const navigationItems = [
        {
            name: 'Dashboard',
            href: '/dashboard',
            icon: Home,
            roles: ['admin', 'coach', 'parent', 'athlete']
        },
        {
            name: 'Gruppi',
            href: '/groups',
            icon: Shield,
            roles: ['admin', 'coach']
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
            coach: 'Dirigente/Allenatore',
            parent: 'Genitore',
            athlete: 'Atleta'
        };
        return labels[role] || role;
    };

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
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
                <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">SC</span>
                            </div>
                        </div>
                        <div className="ml-3">
                            <h1 className="text-lg font-semibold text-gray-900">SportClub</h1>
                            <p className="text-xs text-gray-500">Manager</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
                    {allowedNavItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = isActiveRoute(item.href);

                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={`
                  group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150
                  ${isActive
                                    ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-600'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }
                `}
                            >
                                <Icon className={`
                  mr-3 h-5 w-5 transition-colors duration-150
                  ${isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}
                `} />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                {/* User Info in Sidebar */}
                <div className="flex-shrink-0 p-4 border-t border-gray-200">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            {user.avatarUrl ? (
                                <img
                                    src={user.avatarUrl}
                                    alt={`${user.firstName} ${user.lastName}`}
                                    className="w-8 h-8 rounded-full"
                                />
                            ) : (
                                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                                    <UserCircle className="h-5 w-5 text-gray-600" />
                                </div>
                            )}
                        </div>
                        <div className="ml-3 min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">
                                {user.firstName} {user.lastName}
                            </p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                {getRoleLabel(user.role)}
              </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="lg:pl-64 flex flex-col min-h-screen">
                {/* Top Navigation */}
                <header className="bg-white shadow-sm border-b border-gray-200">
                    <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
                        {/* Mobile menu button */}
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                        >
                            <Menu className="h-6 w-6" />
                        </button>

                        {/* Page title */}
                        <div className="flex-1 lg:flex-none">
                            <h2 className="text-lg font-semibold text-gray-900 lg:hidden">
                                SportClub Manager
                            </h2>
                        </div>

                        {/* Right side actions */}
                        <div className="flex items-center space-x-4">
                            {/* Notifications */}
                            <div className="relative">
                                <button
                                    onClick={() => setNotificationsOpen(!notificationsOpen)}
                                    className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 relative"
                                >
                                    <Bell className="h-6 w-6" />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
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
                                    className="flex items-center space-x-2 p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                                >
                                    {user.avatarUrl ? (
                                        <img
                                            src={user.avatarUrl}
                                            alt={`${user.firstName} ${user.lastName}`}
                                            className="w-8 h-8 rounded-full"
                                        />
                                    ) : (
                                        <UserCircle className="h-8 w-8" />
                                    )}
                                    <ChevronDown className="h-4 w-4" />
                                </button>

                                {/* User dropdown menu */}
                                {userMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                                        <div className="px-4 py-2 border-b border-gray-100">
                                            <p className="text-sm font-medium text-gray-900">
                                                {user.firstName} {user.lastName}
                                            </p>
                                            <p className="text-sm text-gray-500">{user.email}</p>
                                        </div>

                                        <Link
                                            to="/profile"
                                            onClick={() => setUserMenuOpen(false)}
                                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                        >
                                            <Settings className="mr-3 h-4 w-4" />
                                            Profilo
                                        </Link>

                                        <button
                                            onClick={() => {
                                                setUserMenuOpen(false);
                                                onLogout();
                                            }}
                                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                        >
                                            <LogOut className="mr-3 h-4 w-4" />
                                            Disconnetti
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto">
                    <div className="p-4 sm:p-6 lg:p-8">
                        {children}
                    </div>
                </main>
            </div>

            {/* Click outside to close dropdowns */}
            {(userMenuOpen || notificationsOpen) && (
                <div
                    className="fixed inset-0 z-30"
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
