'use client';

import Link from 'next/link';

import { cn } from '@/lib/utils';

interface NavigationLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  prefetch?: boolean;
}

export function NavigationLink({ 
  href, 
  children, 
  className, 
  onClick,
  prefetch = true 
}: NavigationLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Call any custom onClick handler
    if (onClick) {
      onClick();
    }

    // For external links or hash links, use default behavior
    if (href.startsWith('http') || href.startsWith('#')) {
      return;
    }

    // Prevent default and use programmatic navigation for internal links
    e.preventDefault();
    
    // Use window.location for more reliable navigation
    if (window.location.pathname !== href) {
      window.location.href = href;
    }
  };

  return (
    <Link
      href={href}
      className={cn(
        "transition-all duration-200 hover:opacity-80",
        className
      )}
      onClick={handleClick}
      prefetch={prefetch}
    >
      {children}
    </Link>
  );
}
