import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Home, User, Wallet, Settings, Shield } from 'lucide-react';

const BottomNavbar = () => {
  const location = useLocation();
  const { user } = useAuth();

  const navItems = [
    {
      label: 'Home',
      to: '/chat',
      icon: <Home className="w-6 h-6" />,
      show: user?.role !== 'staff'
    },
    {
      label: 'Profile',
      to: '/profile',
      icon: <User className="w-6 h-6" />,
      show: user?.role !== 'staff'
    },
    {
      label: 'Wallet',
      to: '/wallet',
      icon: <Wallet className="w-6 h-6" />,
      show: user?.role !== 'staff'
    },
    {
      label: 'Settings',
      to: '/settings',
      icon: <Settings className="w-6 h-6" />,
      show: (user?.role !== 'admin' && user?.role !== 'staff') // Disable/hide for admins and staff
    },
    {
      label: 'Admin',
      to: '/admin',
      icon: <Shield className="w-6 h-6 text-primary" />,
      show: (user?.role === 'admin' || user?.role === 'staff') // Only show for admins and staff
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border flex justify-around items-center h-16 z-50 shadow-md bottom-navbar">
      {navItems.filter(item => item.show).map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={`flex flex-col items-center text-[10px] sm:text-xs transition-colors duration-200 ${location.pathname === item.to ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {item.icon}
          <span className="mt-1 font-medium">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
};

export default BottomNavbar;
