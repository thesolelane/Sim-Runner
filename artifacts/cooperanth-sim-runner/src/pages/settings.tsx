import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Info, Shield, Zap, Globe } from "lucide-react";

const sections = [
  {
    icon: Globe,
    title: "Scanner",
    description: "Configure how the URL scanner detects onboarding steps.",
    status: "Available",
    items: [
      { label: "Scan timeout", value: "8 seconds" },
      { label: "User agent", value: "Cooperanth-Sim-Runner/1.0" },
      { label: "Scan mode", value: "Keyword analysis" },
    ],
  },
  {
    icon: Zap,
    title: "Simulation Engine",
    description: "Settings for how simulations are executed and timed.",
    status: "Available",
    items: [
      { label: "Step delay range", value: "200ms – 800ms" },
      { label: "Max steps per run", value: "Unlimited" },
      { label: "Failure rate (simulated)", value: "~15% per step" },
    ],
  },
  {
    icon: Shield,
    title: "Security",
    description: "SSRF protection and access controls for scanning.",
    status: "Active",
    items: [
      { label: "Private IP blocking", value: "Enabled" },
      { label: "Localhost blocking", value: "Enabled" },
      { label: "Link-local blocking", value: "Enabled" },
    ],
  },
  {
    icon: Info,
    title: "Platform",
    description: "Scheduling, alerting, and webhook integrations.",
    status: "Coming Soon",
    items: [
      { label: "Scheduled runs", value: "Coming Soon" },
      { label: "Failure alerts", value: "Coming Soon" },
      { label: "Webhook notifications", value: "Coming Soon" },
    ],
  },
];

export default function SettingsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Platform configuration and feature status.</p>
      </div>

      <div className="space-y-4">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <section.icon className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">{section.title}</CardTitle>
                </div>
                <Badge
                  variant={section.status === "Coming Soon" ? "secondary" : "outline"}
                  className={`text-xs ${section.status === "Active" ? "border-green-500 text-green-700" : ""}`}
                >
                  {section.status}
                </Badge>
              </div>
              <CardDescription className="text-sm">{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Separator className="mb-4" />
              <div className="space-y-2">
                {section.items.map((item) => (
                  <div key={item.label} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium font-mono text-xs bg-muted px-2 py-0.5 rounded">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
