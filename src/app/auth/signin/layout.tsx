import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Access your TecBunny Solutions account to manage orders, quotes, and support requests.',
};

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children;
}