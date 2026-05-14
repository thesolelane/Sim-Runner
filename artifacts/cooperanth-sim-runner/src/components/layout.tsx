import { Link, useLocation } from "wouter";
import {
  Activity,
  LayoutDashboard,
  FlaskConical,
  FileBarChart2,
  Plus,
  Settings,
  ScanLine,
  ShieldAlert,
  Store,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

const navSections = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/reports", label: "Reports", icon: FileBarChart2 },
    ],
  },
  {
    label: "Simulations",
    items: [
      { href: "/simulations", label: "All Simulations", icon: FlaskConical },
      { href: "/simulations/new", label: "New Simulation", icon: Plus },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/scanner", label: "URL Scanner", icon: ScanLine },
      { href: "/quantum-scanner", label: "Quantum Scanner", icon: ShieldAlert },
      { href: "/store-readiness", label: "Store Readiness", icon: Store },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 border-r bg-card flex-col hidden md:flex shrink-0">
        <div className="px-4 border-b h-14 flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary shrink-0" />
          <span className="font-semibold tracking-tight text-sm truncate">Cooperanth Sim</span>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {navSections.map((section, sectionIdx) => (
            <div key={section.label}>
              {sectionIdx > 0 && <Separator className="my-2 mx-3" />}
              <div className="px-3 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  {section.label}
                </span>
              </div>
              <div className="space-y-0.5 px-2">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                        active
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <item.icon className="h-3.5 w-3.5 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t px-4 py-3">
          <p className="text-[10px] text-muted-foreground/50 font-mono">v1.0.0</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        <header className="h-14 border-b bg-card flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center md:hidden gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Cooperanth Sim</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/simulations/new">
              <span className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                <Plus className="h-3.5 w-3.5" />
                New Simulation
              </span>
            </Link>
            <Separator orientation="vertical" className="h-5 hidden md:block" />
            <div
              className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-[10px] cursor-pointer hover:bg-primary/25 transition-colors"
              data-testid="avatar-user"
            >
              CS
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6 bg-muted/30">
          {children}
        </div>
      </main>
    </div>
  );
}
