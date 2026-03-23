import type { Metadata } from 'next';
import Link from 'next/link';
import { 
  Code, 
  LayoutDashboard, 
  MessageCircle, 
  Palette, 
  Files, 
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createPageMetadata } from '../../lib/metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'Web Development Services in Goa & Maharashtra',
  description: 'Custom business websites, e-commerce storefronts, admin dashboards, and WhatsApp-integrated web development for companies in Goa and Maharashtra.',
  keywords: ['web development Goa', 'website design Goa', 'business website Maharashtra', 'ecommerce website Goa', 'custom web app TecBunny'],
  path: '/webdev',
  image: '/brand.png',
});

export default function WebDevPage() {
  const features = [
    {
      title: "WhatsApp Integration",
      description: "Direct customer communication integrated right into your website.",
      icon: MessageCircle,
    },
    {
      title: "Unique Design",
      description: "Custom-crafted designs tailored to your brand. We don't use common templates.",
      icon: Palette,
    },
    {
      title: "Admin Dashboard",
      description: "Easy-to-use backend for managing your content and viewing analytics.",
      icon: LayoutDashboard,
    },
    {
      title: "Multiple Pages",
      description: "Comprehensive multi-page structure to showcase all aspects of your business.",
      icon: Files,
    },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 py-20 lg:py-32">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl text-primary">
                Professional Web Development
              </h1>
              <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                Build your digital presence with our expert website building services. Custom solutions for modern businesses.
              </p>
            </div>
            <div className="space-x-4">
              <Button asChild size="lg">
                <Link href="/contact?subject=web_development">Get Started</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/services">View All Services</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container px-4 md:px-6">
          <div className="grid gap-10 md:grid-cols-2 lg:items-center">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">
                Website Building Services
              </h2>
              <p className="text-muted-foreground text-lg">
                We create robust, scalable, and secure websites that drive growth. In fact, the website you are viewing right now is engineered by us—a live example of our capabilities. From landing pages to complex web applications, we handle it all.
              </p>
              <ul className="grid gap-4 mt-6">
                {[
                  "Responsive Mobile-First Design",
                  "SEO Optimization Ready",
                  "Fast Loading Speeds",
                  "Secure & Reliable Hosting Setup"
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-2 text-foreground">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-muted rounded-xl p-8 flex items-center justify-center min-h-[300px]">
                 <Code className="h-32 w-32 text-primary/20" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 md:py-24 bg-muted/50">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">
              Why Choose Our Web Solutions?
            </h2>
            <p className="max-w-[700px] text-muted-foreground md:text-lg">
              We deliver more than just a website; we deliver a complete digital business tool.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-none shadow-md hover:shadow-lg transition-shadow bg-card">
                <CardHeader>
                  <feature.icon className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 lg:py-24">
        <div className="container px-4 md:px-6">
          <div className="bg-primary rounded-3xl p-8 md:p-16 text-center text-primary-foreground shadow-xl">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl mb-4 text-white">
              Ready to Build Your Website?
            </h2>
            <p className="max-w-[600px] mx-auto text-primary-foreground/80 mb-8 text-lg text-blue-100">
              Contact us today to discuss your project requirements and get a custom quote.
            </p>
            <Button asChild size="lg" variant="secondary" className="font-semibold text-primary">
              <Link href="/contact?subject=web_development" className="flex items-center gap-2">
                Contact Us Now <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
