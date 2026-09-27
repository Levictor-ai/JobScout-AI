import {
  LayoutDashboard,
  Compass,
  Bookmark,
  Briefcase,
  Building2,
  User,
  Settings,
} from 'lucide-react';

export const navItems = [
  { id: 'dashboard', label: 'Dashboard', short: 'Home', icon: LayoutDashboard, href: '/' },
  { id: 'discover', label: 'Discover', short: 'Discover', icon: Compass, href: '/discover' },
  { id: 'saved', label: 'Saved Jobs', short: 'Saved', icon: Bookmark, href: '/saved' },
  { id: 'applications', label: 'Applications', short: 'Apps', icon: Briefcase, href: '/applications' },
  { id: 'companies', label: 'Companies & ATS', short: 'Companies', icon: Building2, href: '/companies' },
  { id: 'profile', label: 'Profile & Matching', short: 'Profile', icon: User, href: '/profile' },
  { id: 'settings', label: 'Settings', short: 'Settings', icon: Settings, href: '/settings' },
] as const;

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'JS';
}
