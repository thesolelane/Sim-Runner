import { Link, useLocation } from "wouter";
import { Activity, LayoutDashboard, Plus, Settings } from "lucide-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/simulations/new", label: "New Simulation", icon: Plus },
  ];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col hidden md:flex">
        <div className="p-4 border-b h-14 flex items-center">
          <Activity className="h-5 w-5 text-primary mr-2" />
          <span className="font-semibold tracking-tight text-sm">Cooperanth Sim Runner</span>
        </div>
        <div className="flex-1 py-4 flex flex-col gap-1 px-2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        <header className="h-14 border-b bg-card flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center md:hidden">
            <Activity className="h-5 w-5 text-primary mr-2" />
            <span className="font-semibold text-sm">Sim Runner</span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <button className="text-muted-foreground hover:text-foreground p-1">
              <Settings className="h-4 w-4" />
            </button>
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
              JD
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
