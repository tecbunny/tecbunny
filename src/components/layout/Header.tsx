'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '../ui/logo';
import {
  Menu,
  X,
  ChevronRight,
  ArrowRight,
  ShoppingCart,
  User,
  LogOut,
} from 'lucide-react';

import { useAnalytics } from '../../hooks/use-analytics';
import { useAuth, useCart } from '@/lib/hooks';
import { hasRoleClient } from '@/lib/permissions-client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { EnhancedCartSheet as CartSheet } from '../cart/EnhancedCartSheet';

const navLinks = [
  { name: 'Home', href: '/' },
  { name: 'Products', href: '/products' },
  { 
    name: 'Services', 
    href: '/services',
    children: [
      { name: 'All Services', href: '/services' },
      { name: 'Web Development', href: '/webdev' },
    ]
  },
  { name: 'About Us', href: '/about' },
  { name: 'Contact Us', href: '/contact' },
  {
    name: 'Policies',
    href: '/info/policies',
    children: [
      { name: 'Privacy Policy', href: '/info/policies/privacy' },
      { name: 'Shipping Policies', href: '/info/policies/shipping' },
      { name: 'Terms & Conditions', href: '/info/policies/terms' },
    ],
  },
];

export function Header() {
  useAnalytics();
  const { user, loading, logout } = useAuth();
  const { cartCount, isHydrated } = useCart();
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [mobileSubmenuOpen, setMobileSubmenuOpen] = React.useState<string | null>(null);
  const [desktopSubmenuOpen, setDesktopSubmenuOpen] = React.useState<string | null>(null);
  const [topInfo, setTopInfo] = React.useState({
    location: 'Goa',
    phone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || '+91 96041 36010',
    hours: '',
  });

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  React.useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadCompanyInfo = async () => {
      try {
        let dbPhone = undefined;
        try {
          const settingsRes = await fetch('/api/settings?key=phone', { signal: controller.signal });
          if (settingsRes.ok) {
            const settingsData = await settingsRes.json();
            if (settingsData && settingsData.value) {
              dbPhone = String(settingsData.value).trim();
            }
          }
        } catch {
          // Ignore settings fetch error
        }

        const response = await fetch('/company-info.json', { cache: 'no-store', signal: controller.signal });
        let data: any = {};
        if (response.ok) {
          data = await response.json();
        }

        const supportPhone = dbPhone || (typeof data?.supportPhone === 'string' && data.supportPhone.trim()
          ? data.supportPhone.trim()
          : typeof data?.phone === 'string' && data.phone.trim()
            ? data.phone.trim()
            : undefined);

        const supportHours = typeof data?.supportHours === 'string' && data.supportHours.trim()
          ? data.supportHours.trim()
          : undefined;

        let location = typeof data?.locationShort === 'string' && data.locationShort.trim()
          ? data.locationShort.trim()
          : undefined;

        if (!location && typeof data?.registeredAddress === 'string') {
          const match = data.registeredAddress.match(/([A-Za-z\s]+Goa)/i);
          if (match && match[1]) {
            location = match[1].replace(/\s+/g, ' ').trim();
          }
        }

        if (!location && typeof data?.city === 'string' && typeof data?.state === 'string') {
          location = `${data.city}, ${data.state}`;
        }

        if (isMounted) {
          setTopInfo((current) => ({
            location: location || current.location,
            phone: supportPhone || current.phone,
            hours: supportHours || current.hours,
          }));
        }
      } catch (_error) {
        // Keep defaults on failure
      }
    };

    loadCompanyInfo();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  React.useEffect(() => {
    setMobileMenuOpen(false);
    setMobileSubmenuOpen(null);
    setDesktopSubmenuOpen(null);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const applyMagneticEffect = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    target.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
  };

  const resetMagneticEffect = (event: React.MouseEvent<HTMLElement>) => {
    event.currentTarget.style.transform = 'translate(0px, 0px)';
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // AuthProvider handles redirect; ignore here
    }
  };

  const showDashboard = !loading && !!user && user.role !== 'customer';
  const showAdminOption = !loading && hasRoleClient(user, 'admin');

  const dashboardHref = React.useMemo(() => {
    if (!user?.role) return '/mgmt';
    switch (user.role) {
      case 'superadmin':
        return '/superadmin/mgmt/dashboard';
      case 'admin':
        return '/mgmt/admin';
      case 'manager':
        return '/mgmt/manager';
      case 'sales-staff':
        return '/mgmt/sales-staff';
      case 'sales':
      case 'service_engineer':
        return '/mgmt/sales';
      case 'sales-external':
        return '/mgmt/sales-external';
      default:
        return '/mgmt';
    }
  }, [user?.role]);

  const accountHref = showDashboard ? dashboardHref : '/orders';

  return (
    <nav
      id="navbar"
      className={`sticky top-0 z-50 w-full transition-all duration-300 ease-in-out border-b tech-header
        ${isScrolled
          ? 'py-2.5 shadow-md'
          : 'py-4'}
      `}
    >
      <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-blue-500/20 to-transparent"></div>

      <div className="mx-auto max-w-6xl px-6 sm:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="relative z-20 flex min-w-0 flex-shrink items-center gap-2.5 group sm:w-[240px]">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 p-1 transition-transform group-hover:scale-105 shadow-sm">
              <Logo width={24} height={24} className="sm:hidden" />
              <Logo width={32} height={32} className="hidden sm:block" />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="font-sans text-sm font-bold leading-none tracking-tight text-white sm:text-base">
                TECBUNNY<span className="text-blue-600">.</span>
              </span>
              <span className="mt-0.5 text-[8px] sm:text-[9px] font-medium uppercase tracking-[0.15em] text-blue-300 transition-colors group-hover:text-blue-200">
                Solutions Pvt Ltd
              </span>
            </div>
          </Link>

          <div className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
            <nav className="flex items-center gap-1 overflow-hidden rounded-full border border-zinc-800 bg-zinc-900/50 p-1">
              {navLinks.map((item) => (
                item.children ? (
                  <div
                    key={item.name}
                    className="relative group"
                    onMouseEnter={() => setDesktopSubmenuOpen(item.name)}
                    onMouseLeave={() => setDesktopSubmenuOpen((current) => (current === item.name ? null : current))}
                    onFocusCapture={() => setDesktopSubmenuOpen(item.name)}
                    onBlurCapture={(event) => {
                      const nextTarget = event.relatedTarget as Node | null;
                      if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
                        setDesktopSubmenuOpen((current) => (current === item.name ? null : current));
                      }
                    }}
                  >
                    <Link
                      href={item.href}
                      className={`relative rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-all duration-200 inline-flex items-center gap-1 xl:px-3
                        ${isActive(item.href)
                          ? 'bg-blue-500/20 text-white border border-blue-500/30 shadow-sm'
                          : 'text-zinc-300 hover:text-white hover:bg-zinc-800/50'
                        }
                      `}
                    >
                      {item.name}
                      {isActive(item.href) && (
                        <span className="h-1 w-1 rounded-full bg-blue-500" />
                      )}
                    </Link>
                    <div
                      className={`absolute left-1/2 top-full z-50 mt-2.5 w-48 -translate-x-1/2 rounded-xl border border-zinc-800 bg-zinc-950 p-1.5 shadow-lg backdrop-blur-md transition-all duration-200 before:absolute before:-top-3 before:left-0 before:h-3 before:w-full ${desktopSubmenuOpen === item.name ? 'visible opacity-100 translate-y-0' : 'invisible opacity-0 -translate-y-1 pointer-events-none'}`}
                      aria-hidden={desktopSubmenuOpen === item.name ? 'false' : 'true'}
                    >
                      {item.children.map((child) => (
                        <Link
                          key={child.name}
                          href={child.href}
                          tabIndex={desktopSubmenuOpen === item.name ? 0 : -1}
                          className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-white"
                        >
                          {child.name}
                          <ChevronRight size={12} className="text-zinc-500" />
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`relative inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-200 xl:px-3
                      ${isActive(item.href)
                        ? 'bg-blue-500/20 text-white border border-blue-500/30 shadow-sm'
                        : 'text-zinc-300 hover:text-white hover:bg-zinc-800/50'
                      }
                    `}
                  >
                    {item.name}
                    {isActive(item.href) && (
                      <span className="h-1 w-1 rounded-full bg-blue-500" />
                    )}
                  </Link>
                )
              ))}
            </nav>
          </div>

          <div className="relative z-20 hidden flex-shrink-0 items-center gap-2 lg:flex xl:gap-3.5">
            {loading ? (
              <div className="flex items-center gap-2 animate-pulse">
                <div className="h-8 w-14 rounded-full bg-zinc-100" />
                <div className="h-8 w-14 rounded-full bg-zinc-150" />
              </div>
            ) : !user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/auth/signin"
                  className="rounded-full border border-zinc-700 bg-zinc-900/60 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 transition-all duration-200 hover:border-zinc-500 hover:bg-zinc-850 hover:text-white shadow-sm"
                >
                  Login
                </Link>
                <Link
                  href="/auth/signup"
                  className="rounded-full border border-blue-500 bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-all duration-200 hover:bg-blue-500 shadow-sm"
                >
                  Signup
                </Link>
              </div>
            ) : (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/60 text-zinc-300 transition-all duration-200 hover:border-zinc-500 hover:text-white shadow-sm"
                      aria-label="Open profile menu"
                    >
                      <User size={16} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="border-zinc-200 bg-white text-zinc-700">
                    <DropdownMenuItem asChild className="cursor-pointer focus:bg-zinc-50 focus:text-zinc-900 text-xs py-1.5">
                      <Link href="/profile">Profile</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer focus:bg-zinc-50 focus:text-zinc-900 text-xs py-1.5">
                      <Link href="/orders">My Orders</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer focus:bg-zinc-50 focus:text-zinc-900 text-xs py-1.5">
                      <Link href={accountHref}>Account</Link>
                    </DropdownMenuItem>
                    {showAdminOption && (
                      <DropdownMenuItem asChild className="cursor-pointer focus:bg-zinc-50 focus:text-zinc-900 text-xs py-1.5">
                        <Link href="/mgmt/admin">Admin Panel</Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild className="cursor-pointer focus:bg-zinc-50 focus:text-zinc-900 text-xs py-1.5">
                      <Link href="/auth/change-password">Change Password</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-zinc-100" />
                    <DropdownMenuItem
                      className="cursor-pointer focus:bg-zinc-50 focus:text-zinc-900 text-xs py-1.5 text-red-600 focus:text-red-700"
                      onClick={handleLogout}
                    >
                      <LogOut className="mr-2 h-3.5 w-3.5" /> Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}

            <CartSheet>
              <button
                type="button"
                className="relative flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/60 text-zinc-300 transition-all duration-200 hover:border-zinc-500 hover:text-white shadow-sm"
                aria-label="Open cart"
              >
                <ShoppingCart size={16} />
                {isHydrated && cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-bold text-white">
                    {cartCount}
                  </span>
                )}
              </button>
            </CartSheet>

            <Link
              href="/customised-setups"
              onMouseMove={applyMagneticEffect}
              onMouseLeave={resetMagneticEffect}
              className="group relative rounded-lg border border-blue-600/30 bg-blue-600/10 px-4 py-2 text-xs font-bold text-blue-400 transition-all duration-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 shadow-sm"
            >
              Get Quote
            </Link>
          </div>

          {/* Mobile: cart icon + hamburger */}
          <div className="flex items-center gap-2 lg:hidden">
            <CartSheet>
              <button
                type="button"
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:text-white transition-colors shadow-sm"
                aria-label="Open cart"
              >
                <ShoppingCart size={15} />
                {isHydrated && cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-blue-600 px-0.5 text-[9px] font-bold text-white">
                    {cartCount}
                  </span>
                )}
              </button>
            </CartSheet>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 p-1.5 text-zinc-300 hover:text-white hover:bg-zinc-900/60 transition-colors shadow-sm"
              onClick={() =>
                setMobileMenuOpen((open) => {
                  const next = !open;
                  if (!next) {
                    setMobileSubmenuOpen(null);
                  }
                  return next;
                })
              }
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>
      </div>

      <div
        id="mobile-menu"
        className={`absolute left-0 top-full w-full border-t border-zinc-200 bg-white/95 backdrop-blur-md lg:hidden transition-all duration-300
          ${mobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}
        `}
      >
        <div className="max-h-[calc(100vh-5rem)] overflow-y-auto px-6 pt-3 pb-6 space-y-1.5">
          {navLinks.map((item) => (
            <div key={item.name} className="space-y-1">
              {item.children ? (
                <>
                  <button
                    type="button"
                    onClick={() => setMobileSubmenuOpen((current) => (current === item.name ? null : item.name))}
                    className={`flex min-h-[36px] w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs transition-colors ${
                      mobileSubmenuOpen === item.name
                        ? 'text-zinc-950 font-bold bg-zinc-100'
                        : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-955'
                    }`}
                  >
                    {item.name}
                    <ChevronRight
                      size={14}
                      className={`text-zinc-400 transition-transform ${mobileSubmenuOpen === item.name ? 'rotate-90' : ''}`}
                    />
                  </button>
                  <div
                    className={`space-y-1 pl-3 overflow-hidden transition-all ${
                      mobileSubmenuOpen === item.name
                        ? 'max-h-60 opacity-100'
                        : 'max-h-0 opacity-0 pointer-events-none'
                    }`}
                  >
                    {!item.children.some((c) => c.href === item.href) && (
                      <Link
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex min-h-[36px] items-center justify-between rounded-lg px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
                      >
                        All {item.name}
                        <ChevronRight size={12} className="text-zinc-300" />
                      </Link>
                    )}
                    {item.children.map((child) => (
                      <Link
                        key={child.name}
                        href={child.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex min-h-[36px] items-center justify-between rounded-lg px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
                      >
                        {child.name}
                        <ChevronRight size={12} className="text-zinc-300" />
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <Link
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex min-h-[36px] items-center justify-between rounded-lg px-3 py-1.5 text-xs transition-colors ${
                    isActive(item.href)
                      ? 'text-zinc-955 font-bold bg-zinc-100'
                      : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-955'
                  }`}
                >
                  {item.name}
                  <ChevronRight size={14} className="text-zinc-400" />
                </Link>
              )}
            </div>
          ))}
          {showDashboard && (
            <Link
              href={dashboardHref}
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-[36px] items-center justify-between rounded-lg px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 hover:text-zinc-955 transition-colors"
            >
              Dashboard
              <ChevronRight size={14} className="text-zinc-400" />
            </Link>
          )}
          <Link
            href="/cart"
            onClick={() => setMobileMenuOpen(false)}
            className="flex min-h-[36px] items-center justify-between rounded-lg px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 hover:text-zinc-955 transition-colors"
          >
            Cart
            <ChevronRight size={14} className="text-zinc-400" />
          </Link>
          {loading ? (
            <div className="space-y-1.5 animate-pulse pt-2">
              <div className="h-8 w-full rounded-lg bg-zinc-100" />
              <div className="h-8 w-full rounded-lg bg-zinc-100" />
            </div>
          ) : !user ? (
            <div className="space-y-1.5 pt-2">
              <Link
                href="/auth/signin"
                onClick={() => setMobileMenuOpen(false)}
                className="flex min-h-[36px] items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Login
                <ChevronRight size={14} className="text-zinc-400" />
              </Link>
              <Link
                href="/auth/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="flex min-h-[36px] items-center justify-between rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-500/10 transition-colors"
              >
                Signup
                <ChevronRight size={14} className="text-blue-600" />
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5 pt-2">
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex min-h-[36px] items-center justify-between rounded-lg px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 transition-colors"
              >
                Profile
                <ChevronRight size={14} className="text-zinc-400" />
              </Link>
              <Link
                href={accountHref}
                onClick={() => setMobileMenuOpen(false)}
                className="flex min-h-[36px] items-center justify-between rounded-lg px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 transition-colors"
              >
                Account
                <ChevronRight size={14} className="text-zinc-400" />
              </Link>
              {showAdminOption && (
                <Link
                  href="/mgmt/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-[36px] items-center justify-between rounded-lg px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 transition-colors"
                >
                  Admin Panel
                  <ChevronRight size={14} className="text-zinc-400" />
                </Link>
              )}
              <button
                type="button"
                onClick={async () => {
                  setMobileMenuOpen(false);
                  await handleLogout();
                }}
                className="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Logout
                <ChevronRight size={14} className="text-zinc-400" />
              </button>
            </div>
          )}
          <div className="pt-3 border-t border-zinc-100">
            <Link
              href="/customised-setups"
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full rounded-lg bg-blue-600 py-2.5 text-center text-xs font-bold text-white shadow-sm hover:bg-blue-500 transition-colors"
            >
              Get Instant Quote
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
