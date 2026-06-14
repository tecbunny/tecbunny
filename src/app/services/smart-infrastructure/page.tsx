import type { Metadata } from 'next';
import Link from 'next/link';
import { 
  Shield, 
  Lock, 
  Zap, 
  Cpu, 
  Wifi, 
  Server, 
  Eye, 
  Key, 
  Smartphone, 
  Sliders, 
  Building, 
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Network
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createPageMetadata } from '@/lib/metadata';
import { InfrastructureLeadForm } from '@/components/InfrastructureLeadForm';

export const metadata: Metadata = createPageMetadata({
  title: 'Next-Gen Smart Infrastructure for Hotels & Builders | TecBunny',
  description: 'Enterprise-grade technology integration for hotels, resorts, and modern real estate builders. CCTV, RFID access, smart automation, and IT networking.',
  keywords: [
    'smart infrastructure', 
    'hotel automation', 
    'CCTV projects', 
    'RFID hotel locks', 
    'hospitality IT infrastructure', 
    'GRMS system', 
    'structured cabling', 
    'TecBunny'
  ],
  path: '/services/smart-infrastructure',
  image: '/brand.png',
});

export default function SmartInfrastructurePage() {
  const services = [
    {
      title: "CCTV Elite Projects",
      subtitle: "High-Definition surveillance engineered for expansive properties & complex layouts.",
      icon: Shield,
      gradient: "from-blue-500/20 via-indigo-500/10 to-transparent",
      border: "hover:border-blue-500/35",
      points: [
        {
          label: "AI-Powered Surveillance",
          desc: "Smart analytics including facial recognition, perimeter intrusion alerts, and crowd management."
        },
        {
          label: "Property-Wide Coverage",
          desc: "Seamlessly integrated IP-based networks offering zero blind spots across vast resort layouts."
        },
        {
          label: "Centralized Control Rooms",
          desc: "Customized monitoring hubs with secure, high-capacity local and cloud storage solutions."
        }
      ]
    },
    {
      title: "Hotel RFID Locks & Access Systems",
      subtitle: "Modern, secure, and friction-free access control tailored for hospitality.",
      icon: Lock,
      gradient: "from-purple-500/20 via-pink-500/10 to-transparent",
      border: "hover:border-purple-500/35",
      points: [
        {
          label: "Contactless Smart Locks",
          desc: "Heavy-duty, aesthetically designed RFID card locks that blend beautifully with luxury interiors."
        },
        {
          label: "Centralized Management",
          desc: "Instantly issue, revoke, or track room access keys from the front desk management software."
        },
        {
          label: "Future-Proof Mobile Access",
          desc: "Ready for quick upgrade to BLE (Bluetooth) smartphone-based keyless entry system."
        }
      ]
    },
    {
      title: "Hotel Complete Smart Lights & Automation",
      subtitle: "Transform guest experiences while optimizing operational energy costs.",
      icon: Zap,
      gradient: "from-amber-500/20 via-orange-500/10 to-transparent",
      border: "hover:border-amber-500/35",
      points: [
        {
          label: "Intelligent Guestroom Automation (GRMS)",
          desc: "Welcome scenes that auto-activate lighting, climate, and motorized curtains upon check-in."
        },
        {
          label: "Energy Management Systems",
          desc: "Smart occupancy sensors that cut power to empty zones, drastically reducing utility bills."
        },
        {
          label: "Centralized Property Control",
          desc: "Schedule and manage architectural facade lighting and common-area ambiance from a single dashboard."
        }
      ]
    },
    {
      title: "Complete IT Services & Infrastructure",
      subtitle: "The robust digital backbone required to power modern operations.",
      icon: Server,
      gradient: "from-emerald-500/20 via-teal-500/10 to-transparent",
      border: "hover:border-emerald-500/35",
      points: [
        {
          label: "High-Density Property Wi-Fi",
          desc: "Seamless roaming across rooms, lobbies, pools, and lawns with zero dropped connections."
        },
        {
          label: "Structured Network Cabling",
          desc: "End-to-end fiber optic and Cat6 network design for new construction and premium renovations."
        },
        {
          label: "Server & POS Integration",
          desc: "Robust setup for PMS, point-of-sale terminals, network firewalls, and secure data backups."
        }
      ]
    }
  ];

  const advantages = [
    {
      title: "Blueprint-to-Execution",
      desc: "We collaborate directly with your architects, interior designers, and MEP contractors from day one to align infrastructure with aesthetics."
    },
    {
      title: "Scalable Architecture",
      desc: "Every system we install is modular and standards-compliant, ensuring your property is ready for tomorrow's technology updates."
    },
    {
      title: "Dedicated Enterprise Support",
      desc: "Round-the-clock SLA support to ensure your guest experiences and critical property operations never skip a beat."
    }
  ];

  return (
    <div className="relative min-h-screen bg-[#09090B] text-zinc-200 selection:bg-blue-500/20 selection:text-white overflow-hidden py-16 sm:py-24">
      {/* Background Noise and Grid (unified style) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        <div className="absolute -left-40 top-0 h-[42rem] w-[42rem] rounded-full bg-blue-500/5 blur-[160px]" />
        <div className="absolute -right-40 top-1/3 h-[46rem] w-[46rem] rounded-full bg-indigo-500/5 blur-[180px]" />
      </div>

      {/* Ambient Blobs */}
      <div className="ambient-blob pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-blue-500/10 blur-[120px] animate-pulse" aria-hidden="true" />
      <div className="ambient-blob ambient-blob--delayed pointer-events-none absolute right-0 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-[120px]" aria-hidden="true" />

      {/* Hero Section */}
      <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 border-b border-zinc-900">
        <div className="container mx-auto px-6 max-w-screen-2xl">
          <div className="flex flex-col items-center text-center space-y-6 max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/5 px-4.5 py-1.5 text-xs font-semibold text-blue-400">
              <Sparkles size={14} className="animate-pulse" />
              <span>Enterprise Technology Integration</span>
            </div>
            
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl font-tech leading-tight">
              Next-Gen Smart Infrastructure <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-200 to-white">
                For Hotels & Builders
              </span>
            </h1>

            <p className="text-zinc-400 text-lg md:text-xl font-light leading-relaxed max-w-2xl">
              We deliver end-to-end, enterprise-grade technology integration for hotels, luxury resorts, and modern real estate builders. Seamless tech. Premium security. Smart automation.
            </p>

            <div className="flex flex-wrap gap-4 pt-4 justify-center">
              <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl px-8 shadow-[0_0_25px_-5px_rgba(59,130,246,0.3)] transition-all">
                <Link href="#lead-form-section">Consult With Us</Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="border-zinc-800 bg-zinc-900/30 text-white hover:bg-white/10 hover:border-zinc-700 rounded-xl px-8 transition-all">
                <Link href="/customised-setups">Configure Custom Setup</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Core Enterprise Services */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-6 max-w-screen-2xl">
          <div className="max-w-2xl mb-16">
            <span className="text-xs uppercase tracking-[0.45em] text-blue-500 font-bold">Services</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-white font-tech tracking-tight">Our Core Enterprise Services</h2>
            <p className="mt-4 text-zinc-400 text-sm sm:text-base font-light">
              Sophisticated tech deployments engineered to operate flawlessly, optimize energy cost, and stand out in the luxury property market.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            {services.map((service, index) => {
              const Icon = service.icon;
              return (
                <div 
                  key={index}
                  className={`relative overflow-hidden rounded-2xl border border-zinc-850 bg-zinc-950/60 p-8 transition-all duration-300 ${service.border} group`}
                >
                  {/* Subtle ambient lighting inside card */}
                  <div className={`absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br ${service.gradient} blur-3xl opacity-60 pointer-events-none transition-all duration-300 group-hover:scale-110`} />
                  
                  <div className="relative z-10 flex flex-col h-full justify-between">
                    <div>
                      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-850 text-white">
                        <Icon size={22} className="text-zinc-200" />
                      </div>
                      <h3 className="text-xl font-bold text-white font-tech mb-2">{service.title}</h3>
                      <p className="text-zinc-400 text-sm font-light mb-8 leading-relaxed max-w-md">{service.subtitle}</p>
                      
                      <div className="space-y-6 border-t border-zinc-900 pt-6">
                        {service.points.map((pt, pIdx) => (
                          <div key={pIdx} className="flex gap-4">
                            <CheckCircle2 size={18} className="text-blue-500 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <h4 className="text-sm font-bold text-white tracking-wide">{pt.label}</h4>
                              <p className="text-xs text-zinc-500 font-light leading-relaxed">{pt.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why Leading Builders & Hoteliers Partner With Us */}
      <section className="py-16 md:py-24 bg-zinc-950/40 border-y border-zinc-900">
        <div className="container mx-auto px-6 max-w-screen-2xl">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            {/* Left promo panel */}
            <div className="lg:col-span-5 space-y-6">
              <span className="text-xs uppercase tracking-[0.45em] text-blue-500 font-bold">Why Partner With Us</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white font-tech leading-tight">
                Designed for Luxury. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-500">
                  Built for Performance.
                </span>
              </h2>
              <blockquote className="border-l-2 border-blue-500 pl-4 py-1.5 italic text-zinc-400 font-light text-base leading-relaxed">
                &ldquo;Technology shouldn&apos;t be an afterthought in luxury hospitality—it should be the foundation.&rdquo;
              </blockquote>
              <p className="text-zinc-400 text-sm font-light leading-relaxed">
                We bridge the gap between architectural layout requirements and technical implementation, ensuring every wire, camera, access point, and automation controller works in harmony.
              </p>
              <div className="pt-2">
                <Button asChild className="bg-zinc-900 border border-zinc-800 text-white hover:bg-zinc-800 rounded-xl px-6">
                  <Link href="/about">Learn About Our Team</Link>
                </Button>
              </div>
            </div>

            {/* Right advantages list */}
            <div className="lg:col-span-7 grid gap-6 md:grid-cols-1">
              {advantages.map((adv, idx) => (
                <div key={idx} className="flex gap-6 rounded-2xl border border-zinc-900 bg-[#09090B] p-6 shadow-sm">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    <Building size={20} />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-white font-tech">{adv.title}</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed font-light">{adv.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Lead Form Section */}
      <section id="lead-form-section" className="py-16 md:py-24 border-b border-zinc-900 bg-zinc-950/20">
        <div className="container mx-auto px-6 max-w-screen-2xl">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs uppercase tracking-[0.45em] text-blue-500 font-bold">Proposal Intake</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-white font-tech tracking-tight">Request Infrastructure Proposal</h2>
            <p className="mt-4 text-zinc-400 text-sm sm:text-base font-light">
              Submit details using the input columns below. Leads are routed directly to the Root Console.
            </p>
          </div>
          <InfrastructureLeadForm />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32">
        <div className="container px-6 mx-auto max-w-screen-2xl">
          <div className="relative bg-gradient-to-br from-blue-600 via-indigo-900 to-zinc-950 rounded-3xl p-8 md:p-16 text-center text-white shadow-2xl overflow-hidden border border-blue-500/20">
            {/* Visual gradient overlays */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.35),_transparent)] pointer-events-none" />
            
            <div className="relative z-10 space-y-6 max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight font-tech">
                Elevate Your Project Experience Today
              </h2>
              <p className="text-zinc-200 text-base md:text-lg font-light leading-relaxed">
                Connect with our expert team to review your floor plans, architectural drafts, or current site layouts and design a state-of-the-art technology setup.
              </p>
              <div className="flex flex-wrap gap-4 justify-center pt-4">
                <Button asChild size="lg" variant="secondary" className="bg-white hover:bg-zinc-100 text-zinc-950 font-bold rounded-xl px-8 shadow-md">
                  <a href="#lead-form-section" className="flex items-center gap-2">
                    Submit Project Columns <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:border-white/40 rounded-xl px-8">
                  <Link href="/customised-setups">Go To Custom Builder</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
