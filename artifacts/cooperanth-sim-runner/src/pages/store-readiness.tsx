import { useState } from "react";
import { useRunStoreReadinessScan } from "@workspace/api-client-react";
import type { StoreReadinessReport, StoreReadinessCategory, StoreReadinessCheck } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Store, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronRight, Apple, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function severityColor(severity: string) {
  switch (severity) {
    case "critical": return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400";
    case "high": return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400";
    case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "low": return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400";
    default: return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400";
  }
}

function statusIcon(status: string) {
  if (status === "pass") return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
  if (status === "fail") return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
  if (status === "warning") return <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />;
  return <div className="h-4 w-4 rounded-full border border-gray-300 shrink-0" />;
}

function ScoreRing({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;
  const color = pct >= 80 ? "#22c55e" : pct >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="112" height="112" className="-rotate-90">
        <circle cx="56" cy="56" r={radius} stroke="currentColor" strokeWidth="8" fill="none" className="text-muted/30" />
        <circle cx="56" cy="56" r={radius} stroke={color} strokeWidth="8" fill="none" strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`} style={{ transition: "stroke-dasharray 0.6s ease" }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold" style={{ color }}>{pct}%</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Score</span>
      </div>
    </div>
  );
}

function CheckRow({ check }: { check: StoreReadinessCheck }) {
  const [open, setOpen] = useState(false);
  const isBad = check.status === "fail" || check.status === "warning";
  return (
    <div className={cn("rounded-lg border px-3 py-2.5 transition-colors", isBad ? "bg-background" : "bg-muted/20")}>
      <button className="flex items-start gap-2.5 w-full text-left" onClick={() => isBad && setOpen(o => !o)}>
        {statusIcon(check.status)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{check.name}</span>
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4", severityColor(check.severity))}>
              {check.severity}
            </Badge>
          </div>
          {!open && isBad && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{check.detail}</p>
          )}
        </div>
        {isBad && (
          open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        )}
      </button>
      {open && (
        <div className="mt-2.5 ml-6.5 space-y-1.5 border-t pt-2.5">
          <p className="text-sm text-foreground">{check.detail}</p>
          {check.recommendation && (
            <div className="flex gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground shrink-0 mt-0.5">Fix:</span>
              <p className="text-xs text-muted-foreground">{check.recommendation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CategoryCard({ cat }: { cat: StoreReadinessCategory }) {
  const pct = Math.round(cat.score * 100);
  const [open, setOpen] = useState(true);
  const failures = cat.checks.filter(c => c.status === "fail").length;
  const warnings = cat.checks.filter(c => c.status === "warning").length;
  const platformIcon = cat.platform === "ios"
    ? <Apple className="h-3.5 w-3.5 text-muted-foreground" />
    : cat.platform === "android"
    ? <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
    : null;

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-2 text-left" onClick={() => setOpen(o => !o)}>
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              {platformIcon}
              {cat.name}
            </CardTitle>
          </button>
          <div className="flex items-center gap-2">
            {failures > 0 && <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">{failures} fail{failures > 1 ? "s" : ""}</Badge>}
            {warnings > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-yellow-400 text-yellow-700">{warnings} warn{warnings > 1 ? "s" : ""}</Badge>}
            <span className={cn("text-xs font-bold tabular-nums", pct >= 80 ? "text-green-600" : pct >= 60 ? "text-yellow-600" : "text-red-600")}>{pct}%</span>
          </div>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="px-4 pb-4 space-y-2">
          {cat.checks.map(check => <CheckRow key={check.id} check={check} />)}
        </CardContent>
      )}
    </Card>
  );
}

export default function StoreReadinessPage() {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [appName, setAppName] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["ios", "android"]);
  const [report, setReport] = useState<StoreReadinessReport | null>(null);

  const scanMutation = useRunStoreReadinessScan({
    mutation: {
      onSuccess: (data) => { setReport(data); },
      onError: () => { toast({ title: "Scan Failed", description: "Could not reach the URL or scan failed.", variant: "destructive" }); },
    }
  });

  const togglePlatform = (p: string) => {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const handleScan = () => {
    if (!url.trim()) { toast({ title: "URL Required", description: "Please enter a URL to scan.", variant: "destructive" }); return; }
    if (platforms.length === 0) { toast({ title: "Select Platform", description: "Select at least one platform.", variant: "destructive" }); return; }
    setReport(null);
    scanMutation.mutate({ data: { url: url.trim(), platforms: platforms as ("ios" | "android")[], appName: appName.trim() || undefined } });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Store className="h-6 w-6 text-primary" />
          Store Readiness Scanner
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Check your app's live URL against Apple App Store and Google Play submission requirements.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Scan Configuration</CardTitle>
          <CardDescription>Enter your app's live URL and select the target platforms.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="scan-url">App URL <span className="text-red-500">*</span></Label>
            <Input
              id="scan-url"
              placeholder="https://yourapp.com"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleScan()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="app-name">App Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="app-name"
              placeholder="My App"
              value={appName}
              onChange={e => setAppName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Target Platforms <span className="text-red-500">*</span></Label>
            <div className="flex gap-3">
              {(["ios", "android"] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors",
                    platforms.includes(p)
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-background border-border text-muted-foreground hover:border-primary/50"
                  )}
                >
                  {p === "ios" ? <Apple className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                  {p === "ios" ? "Apple iOS" : "Android"}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={handleScan} disabled={scanMutation.isPending || platforms.length === 0} className="w-full">
            {scanMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Scanning…</>
            ) : (
              <><Store className="mr-2 h-4 w-4" />Run Store Readiness Scan</>
            )}
          </Button>
        </CardContent>
      </Card>

      {report && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <ScoreRing score={report.overallScore} />
                <div className="flex-1 space-y-3 text-center sm:text-left">
                  <div>
                    <h2 className="text-lg font-bold">{report.readyForSubmission ? "Ready for Submission" : "Needs Attention Before Submission"}</h2>
                    <p className="text-sm text-muted-foreground">{report.url}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    <Badge variant={report.readyForSubmission ? "default" : "destructive"} className="text-sm px-3 py-1">
                      {report.readyForSubmission ? "✓ Ready" : "✗ Not Ready"}
                    </Badge>
                    {report.platforms.map(p => (
                      <Badge key={p} variant="outline" className="text-xs">
                        {p === "ios" ? "Apple iOS" : "Android"}
                      </Badge>
                    ))}
                    {report.criticalIssues > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {report.criticalIssues} critical issue{report.criticalIssues > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Scanned {new Date(report.scannedAt).toLocaleString()}
                  </p>
                </div>
              </div>
              {report.error && (
                <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
                  <strong>Scan error:</strong> {report.error}
                </div>
              )}
            </CardContent>
          </Card>

          {report.categories.map(cat => (
            <CategoryCard key={`${cat.name}-${cat.platform ?? "shared"}`} cat={cat} />
          ))}
        </div>
      )}
    </div>
  );
}
