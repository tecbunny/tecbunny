'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
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
import { useAuth, useCart } from '../../lib/hooks';
import { hasRoleClient } from '../../lib/permissions-client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { CartSheet } from '../cart/CartSheet';

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
  { name: 'Innovation', href: '/innovation' },
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
  const { cartCount } = useCart();
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [mobileSubmenuOpen, setMobileSubmenuOpen] = React.useState<string | null>(null);
  const [desktopSubmenuOpen, setDesktopSubmenuOpen] = React.useState<string | null>(null);
  const [topInfo, setTopInfo] = React.useState({
    location: 'Goa',
    phone: '+91 96041 36010',
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
        const response = await fetch('/company-info.json', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();

        const supportPhone = typeof data?.supportPhone === 'string' && data.supportPhone.trim()
          ? data.supportPhone.trim()
          : typeof data?.phone === 'string' && data.phone.trim()
            ? data.phone.trim()
            : undefined;

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
    if (!user?.role) return '/management';
    switch (user.role) {
      case 'admin':
        return '/management/admin';
      case 'accounts':
        return '/management/accounts';
      case 'sales':
      case 'manager':
      case 'service_engineer':
        return '/management/sales';
      default:
        return '/management';
    }
  }, [user?.role]);

  const accountHref = showDashboard ? dashboardHref : '/orders';

  return (
    <nav
      id="navbar"
      className={`sticky top-0 z-50 w-full transition-all duration-500 ease-in-out
        ${isScrolled
          ? 'bg-slate-950/95 backdrop-blur-xl border-b border-white/5 py-3 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]'
          : 'bg-slate-950/85 backdrop-blur-xl border-b border-white/5 py-5'}
      `}
    >
      <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60"></div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="relative z-20 flex items-center gap-4 group">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/70 bg-white shadow-[0_0_28px_rgba(6,182,212,0.35)] transition-all duration-300 group-hover:border-cyan-300/80 group-hover:bg-white group-hover:shadow-[0_0_36px_rgba(6,182,212,0.5)]">
              <Image
                src="/brand.png"
                alt="TecBunny Solutions"
                width={72}
                height={72}
                className="h-14 w-14 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.4)] transition-transform group-hover:scale-110"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="font-tech text-2xl font-bold tracking-wide text-white leading-none">
                TECBUNNY<span className="text-cyan-300 animate-pulse">.</span>
              </span>
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-medium group-hover:text-cyan-300 transition-colors">
                Solutions Pvt Ltd
              </span>
            </div>
          </Link>

          <div className="hidden flex-1 items-center justify-center lg:flex">
            <nav className="flex items-center gap-0.5 xl:gap-1 rounded-full border border-white/5 bg-white/5 p-1.5 backdrop-blur-md shadow-lg shadow-black/20">
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
                      className={`nav-pill relative rounded-full px-3 xl:px-4 py-2 text-sm font-medium whitespace-nowrap transition-all duration-300 inline-flex items-center gap-1
                        ${isActive(item.href)
                          ? 'nav-pill--active bg-white/10 text-white border border-white/5 shadow-inner'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }
                      `}
                    >
                      {item.name}
                      <span className="nav-pill__indicator" aria-hidden="true" />
                      {isActive(item.href) && (
                        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]" />
                      )}
                    </Link>
                    <div
                      className={`absolute left-1/2 top-full z-50 mt-3 w-56 -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl backdrop-blur-xl transition-all duration-200 before:absolute before:-top-3 before:left-0 before:h-3 before:w-full ${desktopSubmenuOpen === item.name ? 'visible opacity-100' : 'invisible opacity-0 pointer-events-none'}`}
                      aria-hidden={desktopSubmenuOpen === item.name ? 'false' : 'true'}
                    >
                      {item.children.map((child) => (
                        <Link
                          key={child.name}
                          href={child.href}
                          tabIndex={desktopSubmenuOpen === item.name ? 0 : -1}
                          className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                        >
                          {child.name}
                          <ChevronRight size={14} className="text-slate-500" />
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`nav-pill relative inline-flex items-center whitespace-nowrap rounded-full px-3 xl:px-4 py-2 text-sm font-medium transition-all duration-300
                      ${isActive(item.href)
                        ? 'nav-pill--active bg-white/10 text-white border border-white/5 shadow-inner'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }
                    `}
                  >
                    {item.name}
                    <span className="nav-pill__indicator" aria-hidden="true" />
                    {isActive(item.href) && (
                      <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]" />
                    )}
                  </Link>
                )
              ))}
            </nav>
          </div>

          <div className="relative z-20 hidden items-center gap-4 lg:flex">
            {!loading && !user && (
              <div className="flex items-center gap-2">
                <Link
                  href="/auth/signin"
                  className="rounded-full px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:text-white hover:bg-white/5"
                >
                  Login
                </Link>
                <Link
                  href="/auth/signup"
                  className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition-colors hover:border-cyan-400/70"
                >
                  Signup
                </Link>
              </div>
            )}
            {!loading && user && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition-colors hover:border-cyan-400/50 hover:text-white"
                      aria-label="Open profile menu"
                    >
                      <User size={18} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="border-white/10 bg-slate-950 text-slate-200">
                    <DropdownMenuItem asChild className="cursor-pointer focus:bg-white/10">
                      <Link href="/profile">Profile</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer focus:bg-white/10">
                      <Link href="/orders">My Orders</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer focus:bg-white/10">
                      <Link href={accountHref}>Account</Link>
                    </DropdownMenuItem>
                    {showAdminOption && (
                      <DropdownMenuItem asChild className="cursor-pointer focus:bg-white/10">
                        <Link href="/admin">Admin Panel</Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild className="cursor-pointer focus:bg-white/10">
                      <Link href="/auth/change-password">Change Password</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem
                      className="cursor-pointer focus:bg-white/10"
                      onClick={handleLogout}
                    >
                      <LogOut className="mr-2 h-4 w-4" /> Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}

            <CartSheet>
              <button
                type="button"
                className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition-colors hover:border-cyan-400/50 hover:text-white"
                aria-label="Open cart"
              >
                <ShoppingCart size={18} />
                {cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-cyan-400 px-1 text-[10px] font-bold text-slate-900">
                    {cartCount}
                  </span>
                )}
              </button>
            </CartSheet>

            <Link
              href="/customised-setups"
              onMouseMove={applyMagneticEffect}
              onMouseLeave={resetMagneticEffect}
              className="magnetic-btn group relative rounded-lg border border-white/10 bg-gradient-to-r from-cyan-500/20 to-violet-500/20 px-6 py-2.5 text-sm font-bold text-white shadow-[0_0_15px_rgba(6,182,212,0.05)] transition-all hover:border-cyan-400/50 hover:shadow-[0_0_25px_rgba(6,182,212,0.2)]"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 opacity-0 transition-opacity duration-300 group-hover:opacity-20"></span>
              <span className="relative flex items-center gap-2">
                Get Quote <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          </div>

          <button
            className="lg:hidden h-10 w-10 rounded-lg border border-white/10 p-1.5 text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
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
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      <div
        id="mobile-menu"
        className={`absolute left-0 top-full w-full border-t border-white/5 bg-slate-950/95 backdrop-blur-xl md:hidden transition-all duration-500
          ${mobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}
        `}
      >
        <div className="max-h-[calc(100vh-5rem)] overflow-y-auto px-4 pt-3 pb-5 space-y-2">
          {navLinks.map((item) => (
            <div key={item.name} className="space-y-2">
              {item.children ? (
                <>
                  <button
                    type="button"
                    onClick={() => setMobileSubmenuOpen((current) => (current === item.name ? null : item.name))}
                    className={`flex min-h-[40px] w-full items-center justify-between rounded-lg px-4 py-2 text-sm transition-colors ${
                      mobileSubmenuOpen === item.name
                        ? 'text-cyan-300 font-bold bg-cyan-500/10 border border-cyan-400/20'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {item.name}
                    <ChevronRight
                      size={16}
                      className={`text-slate-500 transition-transform ${mobileSubmenuOpen === item.name ? 'rotate-90' : ''}`}
                    />
                  </button>
                  <div
                    className={`space-y-1 pl-4 overflow-hidden transition-all ${
                      mobileSubmenuOpen === item.name
                        ? 'max-h-96 opacity-100'
                        : 'max-h-0 opacity-0 pointer-events-none'
                    }`}
                  >
                    {!item.children.some((c) => c.href === item.href) && (
                      <Link
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex min-h-[40px] items-center justify-between rounded-lg px-4 py-2 text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                      >
                        All {item.name}
                        <ChevronRight size={14} className="text-slate-600" />
                      </Link>
                    )}
                    {item.children.map((child) => (
                      <Link
                        key={child.name}
                        href={child.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex min-h-[40px] items-center justify-between rounded-lg px-4 py-2 text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                      >
                        {child.name}
                        <ChevronRight size={14} className="text-slate-600" />
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <Link
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex min-h-[40px] items-center justify-between rounded-lg px-4 py-2 text-sm transition-colors ${
                    isActive(item.href)
                      ? 'text-cyan-300 font-bold bg-cyan-500/10 border border-cyan-400/20'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {item.name}
                  <ChevronRight size={16} className="text-slate-500" />
                </Link>
              )}
            </div>
          ))}
          <Link
            href="/contact"
            onClick={() => setMobileMenuOpen(false)}
            className="flex min-h-[40px] items-center justify-between rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
          >
            Contact Support
            <ChevronRight size={16} className="text-slate-500" />
          </Link>
          {showDashboard && (
            <Link
              href={dashboardHref}
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-[40px] items-center justify-between rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
            >
              Dashboard
              <ChevronRight size={16} className="text-slate-500" />
            </Link>
          )}
          <Link
            href="/cart"
            onClick={() => setMobileMenuOpen(false)}
            className="flex min-h-[40px] items-center justify-between rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
          >
            Cart
            <ChevronRight size={16} className="text-slate-500" />
          </Link>
          {!loading && !user && (
            <div className="space-y-2">
              <Link
                href="/auth/signin"
                onClick={() => setMobileMenuOpen(false)}
                className="flex min-h-[40px] items-center justify-between rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                Login
                <ChevronRight size={16} className="text-slate-500" />
              </Link>
              <Link
                href="/auth/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200 hover:border-cyan-400/70 transition-colors"
              >
                Signup
                <ChevronRight size={16} className="text-cyan-300" />
              </Link>
            </div>
          )}
          {!loading && user && (
            <div className="space-y-2">
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex min-h-[40px] items-center justify-between rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                Profile
                <ChevronRight size={16} className="text-slate-500" />
              </Link>
              <Link
                href={accountHref}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                Account
                <ChevronRight size={16} className="text-slate-500" />
              </Link>
              {showAdminOption && (
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
                >
                  Admin Panel
                  <ChevronRight size={16} className="text-slate-500" />
                </Link>
              )}
              <button
                type="button"
                onClick={async () => {
                  setMobileMenuOpen(false);
                  await handleLogout();
                }}
                className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:border-cyan-400/50 hover:text-white transition-colors"
              >
                Logout
                <ChevronRight size={16} className="text-slate-500" />
              </button>
            </div>
          )}
          <div className="pt-4 mt-2 border-t border-white/5 space-y-3">
            <Link
              href="/customised-setups"
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full rounded-lg bg-cyan-500 py-2 text-center text-sm font-bold text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.35)]"
            >
              Get Instant Quote
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}