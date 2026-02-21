'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Sparkles,
  CheckCircle2,
  TrendingUp,
  Users,
  Shield,
  Package,
  Wallet,
  Star,
  ArrowRight,
  ClipboardList,
} from 'lucide-react'

const HERO_IMAGE = 'https://images.unsplash.com/photo-1582735689369-4fe89db7114f?w=1200&q=80'
const FEATURE_IMAGE = 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80'
const DASHBOARD_IMAGE = 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&q=80'
const HAPPY_OWNER_IMAGE = 'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=800&q=80'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold">Laundry Marketplace</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link href="/sign-in">
              <Button variant="ghost" className="rounded-xl">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="rounded-xl">Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero with image */}
        <section className="relative overflow-hidden border-b">
          <div className="absolute inset-0 z-0">
            <Image
              src={HERO_IMAGE}
              alt=""
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
            <div className="absolute inset-0 bg-navy-900/60" />
          </div>
          <div className="container relative z-10 mx-auto flex flex-col items-center justify-center px-4 py-24 text-center md:py-32">
            <div className="mb-6 flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 backdrop-blur">
              <Sparkles className="h-4 w-4 text-white" />
              <span className="text-sm font-medium text-white">Partner with us</span>
            </div>
            <h1 className="mb-6 text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
              Grow Your Laundry Business
              <br />
              <span className="text-primary">Join Our Marketplace</span>
            </h1>
            <p className="mb-8 max-w-2xl text-lg text-white/90 sm:text-xl">
              Connect with customers, manage orders seamlessly, and grow your laundry
              business with our partner dashboard. Start receiving orders today.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link href="/signup">
                <Button size="lg" className="w-full rounded-xl text-base sm:w-auto">
                  Start Your Application
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/sign-in">
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/20 sm:w-auto"
                >
                  Already a Partner? Sign In
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-b py-12">
          <div className="container mx-auto px-4">
            <div className="grid gap-8 text-center sm:grid-cols-3">
              <div>
                <p className="text-3xl font-bold text-primary md:text-4xl">500+</p>
                <p className="text-sm text-muted-foreground">Active partners</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-primary md:text-4xl">50k+</p>
                <p className="text-sm text-muted-foreground">Orders completed</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-primary md:text-4xl">98%</p>
                <p className="text-sm text-muted-foreground">Partner satisfaction</p>
              </div>
            </div>
          </div>
        </section>

        {/* Why partner */}
        <section className="border-b py-20">
          <div className="container mx-auto px-4">
            <h2 className="mb-4 text-center text-2xl font-bold tracking-tight md:text-3xl">
              Why Partner With Us?
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground">
              Join a platform built for laundry businesses. More orders, less hassle,
              and payments you can count on.
            </p>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="rounded-xl border-2 transition-shadow hover:shadow-card-hover">
                <CardHeader>
                  <TrendingUp className="mb-2 h-8 w-8 text-primary" />
                  <CardTitle className="text-lg">Grow Your Business</CardTitle>
                  <CardDescription>
                    Reach more customers and increase order volume with our marketplace.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="rounded-xl border-2 transition-shadow hover:shadow-card-hover">
                <CardHeader>
                  <Package className="mb-2 h-8 w-8 text-primary" />
                  <CardTitle className="text-lg">Easy Order Management</CardTitle>
                  <CardDescription>
                    One dashboard with real-time updates, status tracking, and notifications.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="rounded-xl border-2 transition-shadow hover:shadow-card-hover">
                <CardHeader>
                  <CheckCircle2 className="mb-2 h-8 w-8 text-primary" />
                  <CardTitle className="text-lg">Streamlined Process</CardTitle>
                  <CardDescription>
                    Simple onboarding gets you approved and receiving orders quickly.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="rounded-xl border-2 transition-shadow hover:shadow-card-hover">
                <CardHeader>
                  <Shield className="mb-2 h-8 w-8 text-primary" />
                  <CardTitle className="text-lg">Secure Payments</CardTitle>
                  <CardDescription>
                    Get paid on time with integrated payouts and transparent commission.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* How it works + image */}
        <section className="border-b py-20">
          <div className="container mx-auto px-4">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
                <Image
                  src={FEATURE_IMAGE}
                  alt="Modern laundry facility"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
              <div>
                <h2 className="mb-4 text-2xl font-bold tracking-tight md:text-3xl">
                  How it works
                </h2>
                <p className="mb-8 text-muted-foreground">
                  Apply once, get verified, and start receiving orders. You set your
                  services and capacity; we handle discovery and payments.
                </p>
                <div className="space-y-6">
                  {[
                    { step: 1, icon: ClipboardList, title: 'Apply', text: 'Submit your business details and service offering.' },
                    { step: 2, icon: CheckCircle2, title: 'Get approved', text: 'Our team reviews and activates your partner account.' },
                    { step: 3, icon: Package, title: 'Receive orders', text: 'Accept orders, manage capacity, and update status.' },
                    { step: 4, icon: Wallet, title: 'Get paid', text: 'Earnings and payouts in your dashboard.' },
                  ].map((item) => (
                    <div key={item.step} className="flex gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">{item.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Dashboard preview + image */}
        <section className="border-b py-20">
          <div className="container mx-auto px-4">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div className="order-2 lg:order-1">
                <h2 className="mb-4 text-2xl font-bold tracking-tight md:text-3xl">
                  Your partner dashboard
                </h2>
                <p className="mb-6 text-muted-foreground">
                  One place for orders, capacity, earnings, and profile. See today’s
                  metrics, respond to reviews, and handle disputes when needed.
                </p>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Real-time order feed and status updates
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Capacity and earnings at a glance
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Reviews, disputes, and payouts
                  </li>
                </ul>
                <Link href="/signup" className="mt-6 inline-block">
                  <Button className="rounded-xl">
                    Get access
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <div className="relative order-1 aspect-video overflow-hidden rounded-2xl bg-muted lg:order-2">
                <Image
                  src={DASHBOARD_IMAGE}
                  alt="Team using dashboard"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Testimonial / trust */}
        <section className="border-b py-20">
          <div className="container mx-auto px-4">
            <div className="relative overflow-hidden rounded-2xl bg-muted">
              <div className="absolute inset-0">
                <Image
                  src={HAPPY_OWNER_IMAGE}
                  alt=""
                  fill
                  className="object-cover opacity-30"
                  sizes="100vw"
                />
                <div className="absolute inset-0 bg-navy-900/50" />
              </div>
              <div className="relative z-10 flex flex-col items-center px-6 py-16 text-center md:flex-row md:gap-12 md:px-12 md:py-20">
                <div className="flex items-center gap-2 text-primary md:mb-0">
                  <Star className="h-8 w-8 fill-current" />
                  <Star className="h-8 w-8 fill-current" />
                  <Star className="h-8 w-8 fill-current" />
                  <Star className="h-8 w-8 fill-current" />
                  <Star className="h-8 w-8 fill-current" />
                </div>
                <div>
                  <p className="mb-4 text-lg font-medium text-white md:text-xl">
                    &ldquo;We doubled our volume in the first three months. The dashboard
                    makes it easy to stay on top of orders and earnings.&rdquo;
                  </p>
                  <p className="text-sm text-white/80">— Laundry partner</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <Card className="overflow-hidden rounded-2xl border-2 border-primary/20">
              <CardHeader className="text-center md:py-12">
                <CardTitle className="text-2xl md:text-3xl">
                  Ready to Get Started?
                </CardTitle>
                <CardDescription className="text-base">
                  Join laundry partners already growing their business on our marketplace.
                </CardDescription>
                <CardContent className="flex flex-col justify-center gap-4 pt-6 sm:flex-row">
                  <Link href="/signup">
                    <Button size="lg" className="w-full rounded-xl sm:w-auto">
                      Apply Now
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/sign-in">
                    <Button size="lg" variant="outline" className="w-full rounded-xl sm:w-auto">
                      Sign In
                    </Button>
                  </Link>
                </CardContent>
              </CardHeader>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Laundry Marketplace. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
