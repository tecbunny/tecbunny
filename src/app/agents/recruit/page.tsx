import React from 'react';
import { Metadata } from 'next';
import { Shield, Zap, TrendingUp, Users, Wallet, Rocket, CheckCircle2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Become a TecBunny Certified Agent | Earn High Commissions',
  description: 'Join the TecBunny Certified Agent program. Perfect for tech bloggers, sysadmins, and freelance consultants. Earn high commissions on CCTV and IT infrastructure referrals.',
};

export default function AgentRecruitPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-white/5 py-20 lg:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#0e749020,transparent)]" />
        <div className="container relative mx-auto px-4 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400">
            <Users className="h-8 w-8" />
          </div>
          <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-white md:text-6xl">
            Scale Your Revenue as a <br />
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              TecBunny Certified Agent
            </span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-400">
            Turn your technical expertise and professional network into a high-yield commission engine. We provide the infrastructure; you provide the leads.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" className="h-12 bg-cyan-600 px-8 hover:bg-cyan-500" asChild>
              <Link href="/auth/signup?role=agent">Apply Now to Join</Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 border-white/10 px-8 hover:bg-white/5" asChild>
              <Link href="https://wa.me/917387375651?text=Hi!%20I'm%20interested%20in%20becoming%20a%20TecBunny%20Agent.">
                Chat with Partner Support
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-white">Why TecBunny?</h2>
            <p className="text-slate-400 text-lg">Designed for the modern tech professional.</p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                title: "High-Margin Commissions",
                desc: "Earn up to 10% on every hardware sale and service contract. Multi-tier structures for high-volume performers.",
                icon: Wallet
              },
              {
                title: "Real-time Tracking",
                desc: "Access your dedicated Agent Dashboard to track referrals, order status, and commission redemptions in real-time.",
                icon: TrendingUp
              },
              {
                title: "Premium Tech Stack",
                desc: "Refer industry-leading CCTV, IoT, and IT solutions that your clients will love. Zero compromise on quality.",
                icon: Shield
              }
            ].map((item, i) => (
              <div key={i} className="group rounded-2xl border border-white/5 bg-slate-900/50 p-8 transition hover:border-cyan-500/30">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-3 text-xl font-bold text-white">{item.title}</h3>
                <p className="text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Target Audience */}
      <section className="bg-slate-900/40 py-20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center gap-12 lg:flex-row">
            <div className="flex-1">
              <h2 className="mb-6 text-3xl font-bold text-white">Who is this for?</h2>
              <div className="space-y-4">
                {[
                  { title: "Tech Bloggers & Influencers", desc: "Monetize your content by recommending verified hardware stacks." },
                  { title: "System Administrators", desc: "Streamline procurement for your clients while earning professional fees." },
                  { title: "Freelance Consultants", desc: "Offer end-to-end IT & Security solutions without managing inventory." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white">{item.title}</h4>
                      <p className="text-sm text-slate-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1">
               <div className="relative rounded-3xl border border-cyan-500/20 bg-slate-950 p-8 shadow-2xl">
                 <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-cyan-500/10 blur-2xl" />
                 <h3 className="mb-6 text-2xl font-bold text-white">Agent Milestone Program</h3>
                 <div className="space-y-6">
                    <div className="relative pl-8 before:absolute before:left-0 before:top-2 before:h-full before:w-[2px] before:bg-slate-800">
                       <div className="absolute -left-[5px] top-2 h-[10px] w-[10px] rounded-full bg-cyan-500" />
                       <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">Silver Tier</p>
                       <p className="text-sm text-slate-300 mt-1">₹0 - ₹50k Monthly Sales. 5% Base Commission.</p>
                    </div>
                    <div className="relative pl-8 before:absolute before:left-0 before:top-2 before:h-full before:w-[2px] before:bg-slate-800">
                       <div className="absolute -left-[5px] top-2 h-[10px] w-[10px] rounded-full bg-blue-500" />
                       <p className="text-xs font-bold uppercase tracking-widest text-blue-400">Gold Tier</p>
                       <p className="text-sm text-slate-300 mt-1">₹50k - ₹2L Monthly Sales. 7.5% Commission + Bonus.</p>
                    </div>
                    <div className="relative pl-8">
                       <div className="absolute -left-[5px] top-2 h-[10px] w-[10px] rounded-full bg-emerald-500" />
                       <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Elite Tier</p>
                       <p className="text-sm text-slate-300 mt-1">₹2L+ Monthly Sales. 10% Commission + Priority Support.</p>
                    </div>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="relative overflow-hidden rounded-3xl bg-cyan-600 px-8 py-16 text-center text-white lg:px-16">
            <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] bg-[length:200%_200%] animate-shimmer" />
            <h2 className="relative mb-6 text-3xl font-extrabold md:text-4xl">Ready to Start Your TecBunny Journey?</h2>
            <p className="relative mx-auto mb-10 max-w-2xl text-cyan-100">
              Applications are reviewed within 24 hours. Start earning immediately after approval.
            </p>
            <div className="relative flex justify-center">
              <Button size="lg" className="h-14 bg-white px-10 text-cyan-600 hover:bg-cyan-50" asChild>
                <Link href="/auth/signup?role=agent">Apply Now</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
