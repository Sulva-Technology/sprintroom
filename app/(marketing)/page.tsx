import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ArrowRight, CheckCircle2, Clock, ShieldAlert, Target, Zap, LayoutDashboard, Timer, Users, User, Info, ArrowUpRight, Activity } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { buildPageMetadata, siteConfig, getSiteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";

export const metadata = buildPageMetadata({
  title: "Focus-Powered Task Management for Teams",
  description: "Plan tasks, run Pomodoro focus sessions, track blockers, and see your team’s execution pulse in one clean workspace.",
  path: "/",
});

export default function MarketingPage() {
  const siteUrl = getSiteUrl();

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "SprintRoom",
    "url": siteUrl,
    "logo": `${siteUrl}/logo.png`,
    "sameAs": [],
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "SprintRoom",
    "url": siteUrl,
    "description": siteConfig.description,
  };

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "SprintRoom",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "description": siteConfig.description,
    "url": siteUrl,
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/OnlineOnly",
    },
  };

  return (
    <div className="w-full flex-col flex bg-[#F7F8FA]">
      <JsonLd data={organizationSchema} />
      <JsonLd data={websiteSchema} />
      <JsonLd data={softwareSchema} />
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-24 pb-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/50 via-white to-transparent"></div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col items-center text-center">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-[#101828] max-w-4xl leading-[1.1] mb-6">
            Stop chasing updates. <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">Watch work move.</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed font-medium">
            SprintRoom turns tasks into focused execution. Plan work, start Pomodoro sessions, submit progress proof, and see your team&apos;s pulse in real time.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Button size="lg" className="rounded-full h-14 px-8 text-base shadow-lg shadow-primary/20 group" render={<Link href="/login" />}>
                Create your team room
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>

          {/* Hero Visual Mockup */}
          <div className="mt-20 w-full max-w-5xl items-center flex flex-col align-center">
            <div className="relative w-full aspect-[16/9] md:aspect-[16/8.5] rounded-[2rem] border border-border/50 bg-white shadow-2xl shadow-primary/10 overflow-hidden ring-1 ring-black/5">
              <Image
                src="/home-new.png"
                alt="SprintRoom Dashboard"
                fill
                priority
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 1280px"
              />
              {/* Overlay to keep it looking like an app */}
              <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-[2rem]"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-24 bg-white border-y border-border/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
              Most task tools track intentions.<br/> SprintRoom tracks execution.
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass-card shadow-sm border border-border/50 p-6 bg-slate-50/50 rounded-2xl">
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center mb-4 text-slate-500">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-foreground">In progress forever</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">Tasks sit in the &quot;Doing&quot; column for weeks without any proven progress or movement.</p>
            </div>
            
            <div className="glass-card shadow-sm border border-border/50 p-6 bg-red-50/30 rounded-2xl">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-4 text-red-500">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-foreground">Hidden blockers</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">Teammates get stuck, but the team doesn&apos;t know until the end-of-week standup.</p>
            </div>
            
            <div className="glass-card shadow-sm border border-border/50 p-6 bg-amber-50/30 rounded-2xl">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mb-4 text-amber-600">
                <Info className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-foreground">Fake updates</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">Status updates like &quot;working on it&quot; provide zero visibility into actual shipped code or pixels.</p>
            </div>
            
            <div className="glass-card shadow-sm border border-border/50 p-6 bg-blue-50/30 rounded-2xl">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-4 text-blue-500">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-foreground">No focus rhythm</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">Distractions break deep work. There&apos;s no systemic way to protect time for hard tasks.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-24 bg-[#F7F8FA]" id="method">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
              The execution engine.
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl font-medium">
              Three steps to guaranteed velocity.
            </p>
          </div>

          <div className="space-y-8">
            <div className="grid md:grid-cols-2 gap-8 items-center bg-white border border-border/50 rounded-3xl p-8 lg:p-12 shadow-sm glass-card">
              <div>
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm mb-6">A</div>
                <h3 className="text-2xl font-bold mb-4">Plan the work</h3>
                <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                  Build your backlog with clarity. Move tasks to &quot;Today&quot; to set your intentions, and pull them into &quot;Doing&quot; when you&apos;re ready to execute.
                </p>
              </div>
              <div className="bg-[#f8f9fc] border rounded-2xl p-6 shadow-inner relative overflow-hidden">
                <div className="flex gap-4">
                  <div className="w-48 shrink-0 space-y-2">
                    <span className="text-xs font-semibold uppercase text-muted-foreground ml-1">Today · 2</span>
                    <div className="bg-white p-3 rounded-xl border shadow-sm"><div className="h-2 w-1/2 bg-slate-200 rounded mb-2"/><div className="h-2 w-3/4 bg-slate-100 rounded"/></div>
                    <div className="bg-white p-3 rounded-xl border shadow-sm"><div className="h-2 w-2/3 bg-slate-200 rounded mb-2"/><div className="h-2 w-full bg-slate-100 rounded"/></div>
                  </div>
                  <div className="w-48 shrink-0 space-y-2">
                    <span className="text-xs font-semibold uppercase text-muted-foreground ml-1">Doing · 1</span>
                    <div className="bg-white p-3 rounded-xl border shadow-[0_4px_20px_rgb(37,99,235,0.1)] border-primary/20 scale-105 transform transition-transform"><div className="h-2 w-3/4 bg-primary/60 rounded mb-2"/><div className="h-2 w-full bg-primary/20 rounded"/></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 items-center bg-white border border-border/50 rounded-3xl p-8 lg:p-12 shadow-sm glass-card">
              <div className="md:order-2">
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 font-bold text-sm mb-6">B</div>
                <h3 className="text-2xl font-bold mb-4">Focus on one task</h3>
                <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                  Protect your attention. Start a 25-minute Pomodoro session tied directly to a specific task. Your team sees you&apos;re deep in work and knows not to interrupt.
                </p>
              </div>
              <div className="bg-[#f8f9fc] border rounded-2xl p-8 shadow-inner flex items-center justify-center md:order-1">
                <div className="relative group cursor-pointer w-full max-w-[280px]">
                  <div className="absolute inset-0 bg-amber-500/20 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="bg-white border rounded-[2rem] p-8 shadow-lg text-center relative z-10 flex flex-col items-center">
                    <Timer className="w-8 h-8 text-amber-500 mb-4" />
                    <span className="font-mono text-5xl font-bold tabular-nums tracking-tighter text-slate-800">25:00</span>
                    <div className="mt-4 px-3 py-1 bg-muted rounded-full text-xs font-medium border">Focusing on Auth API</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 items-center bg-white border border-border/50 rounded-3xl p-8 lg:p-12 shadow-sm glass-card">
              <div>
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-sm mb-6">C</div>
                <h3 className="text-2xl font-bold mb-4">Prove what moved</h3>
                <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                  When the timer ends, you must record proof of work. This feeds into the Team Pulse dashboard, giving everyone high-fidelity visibility into actual progress.
                </p>
              </div>
              <div className="bg-[#f8f9fc] border rounded-2xl p-6 shadow-inner">
                <div className="bg-white border rounded-xl p-4 shadow-sm flex gap-4">
                   <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 shrink-0" />
                   <div>
                     <div className="flex items-center gap-2 mb-1">
                       <span className="font-semibold text-sm">Alex Chen</span>
                       <span className="text-[10px] text-muted-foreground">Just now</span>
                     </div>
                     <p className="text-xs font-medium text-emerald-600 mb-2 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Completed focus session</p>
                     <div className="bg-muted/50 border rounded-lg p-3 text-sm text-foreground/80 font-medium">
                       &quot;Finished the OAuth endpoints and wrote integration tests. PR is up for review.&quot;
                     </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-24 bg-white border-y border-border/40" id="features">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
           <div className="flex flex-col items-center text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Everything you need. Nothing you don&apos;t.</h2>
           </div>
           
           <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
             {[
               { icon: Timer, title: "Pomodoro-backed Tasks", desc: "Every task execution is measured in 25-minute focused intervals." },
               { icon: Target, title: "Proof of Work", desc: "Submit actual notes and links after sessions. No more empty 'doing' columns." },
               { icon: Activity, title: "Team Pulse", desc: "A real-time feed of completed sessions. See velocity happen live." },
               { icon: ShieldAlert, title: "Blocker Escalation", desc: "Highlight stuck tasks instantly so the team can swarm and unblock." },
               { icon: LayoutDashboard, title: "Workspace Switcher", desc: "Manage multiple teams, projects, or classes from one clean interface." },
               { icon: Zap, title: "Optimistic UI", desc: "Built on Next.js 15. Lightning fast interactions with zero loading spinners." },
             ].map((f, i) => (
               <div key={i} className="flex gap-4">
                 <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center text-primary">
                    <f.icon className="w-5 l-5" />
                 </div>
                 <div>
                   <h3 className="font-semibold text-foreground mb-1">{f.title}</h3>
                   <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                 </div>
               </div>
             ))}
           </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-24 bg-[#F7F8FA]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-12">Built for teams that ship</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {["Student Projects", "Hackathon Teams", "Startup Squads", "Remote Teams", "Design Agencies"].map((role, i) => (
              <Card key={i} className="p-6 text-center shadow-sm border border-border/60 hover:border-primary/30 transition-colors glass-card bg-white">
                 <Users className="w-6 h-6 mx-auto mb-3 text-muted-foreground" />
                 <span className="font-semibold text-sm">{role}</span>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 bg-white border-y border-border/40" id="pricing">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <Badge className="mb-5 rounded-full px-3 py-1 bg-primary/10 text-primary border-primary/20">Free beta</Badge>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
            Start with the full workspace.
          </h2>
          <p className="text-lg text-muted-foreground font-medium mb-8">
            Create projects, run focus sessions, track blockers, and sync offline changes while SprintRoom is in beta.
          </p>
          <Button size="lg" className="rounded-full h-12 px-8 shadow-lg shadow-primary/20" render={<Link href="/login" />}>
            Create your free team room
          </Button>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/[0.02]"></div>
        <div className="mx-auto max-w-3xl px-4 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Build a team that finishes.</h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-xl mx-auto">
            Stop tracking what you plan to do. Start tracking what you&apos;re actually doing.
          </p>
          <Button size="lg" className="rounded-full h-14 px-10 text-lg shadow-lg shadow-primary/20" render={<Link href="/login" />}>
             Start free today
          </Button>
        </div>
      </section>
    </div>
  )
}

function SearchIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}
