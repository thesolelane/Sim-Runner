import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { 
  useGetSimulation, 
  useListRuns, 
  useCreateRun,
  useUpdateSimulation,
  useTestAlert,
  getGetSimulationQueryKey,
  getListRunsQueryKey,
  getGetSimulationStatsQueryKey,
  getListSimulationsQueryKey,
  type SimulationRun,
  type QuantumScanResult,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Play, Activity, Clock, ArrowLeft, History, Monitor, Settings, Bell, Webhook, Copy, Check, Send, XCircle, ShieldAlert, ShieldCheck, ShieldX, TrendingUp, TrendingDown, Minus, Wallet, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const SCHEDULE_PRESETS = [
  { label: "Disabled (no schedule)", value: "none" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every day at midnight", value: "0 0 * * *" },
  { label: "Every day at 9am", value: "0 9 * * *" },
  { label: "Every week (Mon 9am)", value: "0 9 * * 1" },
  { label: "Custom cron expression", value: "custom" },
];

type QuantumFieldChange = {
  field: string;
  prev: string | null;
  curr: string | null;
  direction: "improved" | "degraded" | "changed";
};

type QuantumHistoryEntry = {
  run: SimulationRun;
  result: QuantumScanResult;
  changes: QuantumFieldChange[];
  isFirst: boolean;
};

function computeQuantumChanges(
  curr: QuantumScanResult,
  prev: QuantumScanResult,
): QuantumFieldChange[] {
  const changes: QuantumFieldChange[] = [];

  if (curr.quantumSafe !== prev.quantumSafe) {
    changes.push({
      field: "Quantum posture",
      prev: prev.quantumSafe ? "Safe" : "At Risk",
      curr: curr.quantumSafe ? "Safe" : "At Risk",
      direction: curr.quantumSafe ? "improved" : "degraded",
    });
  }

  if (curr.tlsVersion !== prev.tlsVersion && (curr.tlsVersion || prev.tlsVersion)) {
    const parseTlsVersion = (v: string | null | undefined): number => {
      const match = (v ?? "").match(/(\d+(?:\.\d+)?)/);
      return match ? parseFloat(match[1]) : 0;
    };
    const currV = parseTlsVersion(curr.tlsVersion);
    const prevV = parseTlsVersion(prev.tlsVersion);
    changes.push({
      field: "TLS Version",
      prev: prev.tlsVersion ?? null,
      curr: curr.tlsVersion ?? null,
      direction: currV > prevV ? "improved" : currV < prevV ? "degraded" : "changed",
    });
  }

  if (curr.httpVersion !== prev.httpVersion && (curr.httpVersion || prev.httpVersion)) {
    const parseHttpVersion = (v: string | null | undefined): number => {
      const match = (v ?? "").match(/(\d+(?:\.\d+)?)/);
      return match ? parseFloat(match[1]) : 0;
    };
    const currV = parseHttpVersion(curr.httpVersion);
    const prevV = parseHttpVersion(prev.httpVersion);
    changes.push({
      field: "HTTP Version",
      prev: prev.httpVersion ?? null,
      curr: curr.httpVersion ?? null,
      direction: currV > prevV ? "improved" : currV < prevV ? "degraded" : "changed",
    });
  }

  if (curr.keyExchange !== prev.keyExchange && (curr.keyExchange || prev.keyExchange)) {
    const pqKeywords = ["Kyber", "ML-KEM", "X25519Kyber", "hybrid"];
    const currIsPq = pqKeywords.some((kw) => (curr.keyExchange ?? "").includes(kw));
    const prevIsPq = pqKeywords.some((kw) => (prev.keyExchange ?? "").includes(kw));
    changes.push({
      field: "Key Exchange",
      prev: prev.keyExchange ?? null,
      curr: curr.keyExchange ?? null,
      direction: currIsPq && !prevIsPq ? "improved" : !currIsPq && prevIsPq ? "degraded" : "changed",
    });
  }

  if (
    curr.certSignatureAlgorithm !== prev.certSignatureAlgorithm &&
    (curr.certSignatureAlgorithm || prev.certSignatureAlgorithm)
  ) {
    changes.push({
      field: "Cert Signature",
      prev: prev.certSignatureAlgorithm ?? null,
      curr: curr.certSignatureAlgorithm ?? null,
      direction: "changed",
    });
  }

  return changes;
}

function QuantumChangeChip({ change }: { change: QuantumFieldChange }) {
  if (change.direction === "improved") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
        <TrendingUp className="h-2.5 w-2.5" />
        {change.field} upgraded
      </span>
    );
  }
  if (change.direction === "degraded") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
        <TrendingDown className="h-2.5 w-2.5" />
        {change.field} downgraded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
      <Minus className="h-2.5 w-2.5" />
      {change.field} changed
    </span>
  );
}

function QuantumHistorySection({ runs, simId }: { runs: SimulationRun[]; simId: number }) {
  const runsWithQuantum = runs
    .filter((r) => r.quantumScanResult != null && !(r.quantumScanResult as QuantumScanResult).error)
    .sort((a, b) => a.id - b.id);

  if (runsWithQuantum.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-5 w-5 text-purple-600" />
            Quantum Security History
          </CardTitle>
          <CardDescription>TLS posture changes across runs</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No quantum scan results yet. Run the simulation to start collecting data.
          </p>
        </CardContent>
      </Card>
    );
  }

  const entries: QuantumHistoryEntry[] = runsWithQuantum.map((run, idx) => {
    const result = run.quantumScanResult as QuantumScanResult;
    const prev = idx > 0 ? (runsWithQuantum[idx - 1].quantumScanResult as QuantumScanResult) : null;
    return {
      run,
      result,
      changes: prev ? computeQuantumChanges(result, prev) : [],
      isFirst: idx === 0,
    };
  });

  const displayEntries = [...entries].reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-5 w-5 text-purple-600" />
          Quantum Security History
        </CardTitle>
        <CardDescription>
          TLS posture across {runsWithQuantum.length} run{runsWithQuantum.length !== 1 ? "s" : ""} — changes between consecutive scans are highlighted
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative border-l-2 border-muted ml-3 pl-6 space-y-5">
          {displayEntries.map((entry) => {
            const { run, result, changes, isFirst } = entry;
            const safe = result.quantumSafe;

            return (
              <div key={run.id} className="relative">
                <div
                  className={`absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 ${
                    safe
                      ? "bg-green-500 border-green-600"
                      : "bg-yellow-400 border-yellow-500"
                  }`}
                />
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/simulations/${simId}/runs/${run.id}`}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {format(new Date(run.startedAt), "MMM d, HH:mm")}
                    </Link>
                    {safe ? (
                      <Badge className="h-5 text-[10px] gap-1 bg-green-100 text-green-700 border-green-200">
                        <ShieldCheck className="h-3 w-3" />
                        Quantum-Safe
                      </Badge>
                    ) : (
                      <Badge className="h-5 text-[10px] gap-1 bg-yellow-100 text-yellow-700 border-yellow-200">
                        <ShieldAlert className="h-3 w-3" />
                        At Risk
                      </Badge>
                    )}
                    {isFirst && (
                      <span className="text-[10px] text-muted-foreground italic">first scan</span>
                    )}
                  </div>

                  <div className="flex gap-3 flex-wrap text-xs text-muted-foreground font-mono">
                    {result.tlsVersion && (
                      <span>
                        <span className="uppercase tracking-wider text-[10px] font-sans font-medium text-muted-foreground not-italic mr-1">TLS</span>
                        {result.tlsVersion}
                      </span>
                    )}
                    {result.httpVersion && (
                      <span>
                        <span className="uppercase tracking-wider text-[10px] font-sans font-medium text-muted-foreground not-italic mr-1">HTTP</span>
                        {result.httpVersion}
                      </span>
                    )}
                    {result.keyExchange && (
                      <span>
                        <span className="uppercase tracking-wider text-[10px] font-sans font-medium text-muted-foreground not-italic mr-1">KEX</span>
                        {result.keyExchange}
                      </span>
                    )}
                  </div>

                  {changes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-0.5">
                      {changes.map((change, i) => (
                        <QuantumChangeChip key={i} change={change} />
                      ))}
                    </div>
                  )}

                  {!isFirst && changes.length === 0 && (
                    <span className="text-[10px] text-muted-foreground italic">No change from previous scan</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function isSlackUrl(val: string) {
  return val.startsWith("https://hooks.slack.com/");
}

function isEmail(val: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

export default function SimulationDetail() {
  const { id } = useParams<{ id: string }>();
  const simId = parseInt(id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: simulation, isLoading: simLoading } = useGetSimulation(simId, {
    query: { enabled: !!simId, queryKey: getGetSimulationQueryKey(simId) }
  });

  const { data: runs, isLoading: runsLoading } = useListRuns(simId, {
    query: { enabled: !!simId, queryKey: getListRunsQueryKey(simId) }
  });

  const [headedMode, setHeadedMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testAlertStatus, setTestAlertStatus] = useState<"idle" | "success" | "error">("idle");
  const createRunMutation = useCreateRun();
  const updateSimMutation = useUpdateSimulation();
  const testAlertMutation = useTestAlert();

  const [schedulePreset, setSchedulePreset] = useState<string | null>(null);
  const [customCron, setCustomCron] = useState("");
  const [alertThreshold, setAlertThreshold] = useState<number[]>([80]);
  const [alertDestination, setAlertDestination] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [webhookEnabled, setWebhookEnabled] = useState<boolean | null>(null);
  const [pqcEnabled, setPqcEnabled] = useState(false);
  const [quantumAlertEnabled, setQuantumAlertEnabled] = useState<boolean | null>(null);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsInitialized, setSettingsInitialized] = useState(false);

  useEffect(() => {
    if (simulation && !settingsInitialized) {
      setAlertThreshold([simulation.alertThreshold ?? 80]);
      setAlertDestination(simulation.alertDestination ?? "");
      setAlertMessage(simulation.alertMessage ?? "");
      setWebhookEnabled(simulation.webhookEnabled ?? true);
      setPqcEnabled(simulation.pqcEnabled ?? false);
      setQuantumAlertEnabled(simulation.quantumAlertEnabled ?? false);
      setSettingsInitialized(true);
    }
  }, [simulation, settingsInitialized]);

  const effectiveSchedule = schedulePreset === null
    ? (simulation?.schedule ?? "")
    : schedulePreset === "custom"
    ? customCron
    : schedulePreset === "none"
    ? ""
    : schedulePreset;

  const handleRun = () => {
    createRunMutation.mutate(
      { id: simId, data: { headedMode } },
      {
        onSuccess: () => {
          toast({ title: "Simulation Started", description: "A new run has been queued." });
          queryClient.invalidateQueries({ queryKey: getListRunsQueryKey(simId) });
          queryClient.invalidateQueries({ queryKey: getGetSimulationQueryKey(simId) });
          queryClient.invalidateQueries({ queryKey: getGetSimulationStatsQueryKey() });
        },
        onError: () => {
          toast({ title: "Run Failed", description: "Could not start simulation.", variant: "destructive" });
        }
      }
    );
  };

  const handleSaveSettings = () => {
    const threshold = alertThreshold[0];
    const destination = alertDestination.trim() || null;
    const schedule = effectiveSchedule || null;

    const webhookEnabledValue = webhookEnabled !== null ? webhookEnabled : (simulation?.webhookEnabled ?? true);
    const quantumAlertEnabledValue = quantumAlertEnabled !== null ? quantumAlertEnabled : (simulation?.quantumAlertEnabled ?? false);

    updateSimMutation.mutate(
      {
        id: simId,
        data: {
          schedule,
          alertThreshold: threshold,
          alertDestination: destination,
          alertMessage: alertMessage.trim() || null,
          webhookEnabled: webhookEnabledValue,
          pqcEnabled,
          quantumAlertEnabled: quantumAlertEnabledValue,
        } as Parameters<typeof updateSimMutation.mutate>[0]["data"],
      },
      {
        onSuccess: () => {
          toast({ title: "Settings Saved", description: "Monitoring settings updated." });
          setSettingsSaved(true);
          queryClient.invalidateQueries({ queryKey: getGetSimulationQueryKey(simId) });
          queryClient.invalidateQueries({ queryKey: getListSimulationsQueryKey() });
        },
        onError: () => {
          toast({ title: "Save Failed", description: "Could not save settings.", variant: "destructive" });
        }
      }
    );
  };

  const handleSendTestAlert = () => {
    setTestAlertStatus("idle");
    testAlertMutation.mutate(
      { id: simId, data: { destination: alertDestination.trim() } },
      {
        onSuccess: (data) => {
          setTestAlertStatus("success");
          toast({ title: "Test Alert Sent", description: data.message });
          queryClient.invalidateQueries({ queryKey: getGetSimulationQueryKey(simId) });
          setTimeout(() => setTestAlertStatus("idle"), 4000);
        },
        onError: (err) => {
          setTestAlertStatus("error");
          const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Could not send test alert.";
          toast({ title: "Test Alert Failed", description: message, variant: "destructive" });
          setTimeout(() => setTestAlertStatus("idle"), 4000);
        },
      }
    );
  };

  const handleCopyWebhook = () => {
    if (!simulation?.webhookToken) return;
    const url = `${window.location.origin}/api/simulations/webhook/${simulation.webhookToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (simLoading) {
    return <div className="p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></div>;
  }

  if (!simulation) {
    return <div className="p-8 text-center text-muted-foreground">Simulation not found.</div>;
  }

  const webhookUrl = simulation.webhookToken
    ? `${window.location.origin}/api/simulations/webhook/${simulation.webhookToken}`
    : null;

  const currentScheduleDisplay = simulation.schedule
    ? (SCHEDULE_PRESETS.find(p => p.value === simulation.schedule)?.label ?? simulation.schedule)
    : "None";

  const destHint = alertDestination
    ? isSlackUrl(alertDestination)
      ? "Slack webhook"
      : isEmail(alertDestination)
      ? "Email"
      : "Unknown format"
    : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Link href="/" className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm transition-colors">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{simulation.name}</h1>
          <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
            {simulation.scanType === "blockchain" ? (
              <>
                <Wallet className="h-3.5 w-3.5 shrink-0" />
                <span className="capitalize font-medium text-foreground">{simulation.chainId}</span>
                <span>•</span>
                <span className="font-mono text-xs truncate max-w-[260px]">{simulation.targetAddress}</span>
              </>
            ) : (
              <span>Target: <a href={simulation.appUrl} target="_blank" rel="noreferrer" className="underline hover:text-foreground">{simulation.appUrl}</a></span>
            )}
            <span>•</span>
            <Badge variant="outline">{simulation.appType}</Badge>
            {simulation.schedule && (
              <>
                <span>•</span>
                <Badge variant="secondary" className="text-xs">
                  <Clock className="mr-1 h-3 w-3" />
                  {currentScheduleDisplay}
                </Badge>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="headed-mode"
              checked={headedMode}
              onCheckedChange={setHeadedMode}
            />
            <Label htmlFor="headed-mode" className="text-sm flex items-center gap-1.5 cursor-pointer select-none">
              <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
              Record Video
            </Label>
          </div>
          <Button size="lg" onClick={handleRun} disabled={createRunMutation.isPending} className="font-semibold shadow-md hover:shadow-lg transition-all">
            {createRunMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5" />}
            Run Simulation
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="mr-1.5 h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              {simulation.scanType === "blockchain" ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-primary" />
                      Blockchain Target
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Chain</div>
                        <div className="font-semibold capitalize">{simulation.chainId}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">App Type</div>
                        <Badge variant="secondary">{simulation.appType}</Badge>
                      </div>
                      <div className="col-span-2">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Address</div>
                        <div className="font-mono text-xs break-all bg-muted px-3 py-2 rounded">{simulation.targetAddress}</div>
                      </div>
                    </div>
                    <a
                      href={`https://${simulation.chainId === "solana" ? "solscan.io/account" : simulation.chainId === "base" ? "basescan.org/address" : simulation.chainId === "arbitrum" ? "arbiscan.io/address" : simulation.chainId === "monad" ? "testnet.monadexplorer.com/address" : "etherscan.io/address"}/${simulation.targetAddress}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View on block explorer
                    </a>
                    <div className="rounded-md bg-muted/30 border p-3 text-xs text-muted-foreground">
                      Each run queries the address on-chain and records the current balance, bytecode presence, and other state. Run the simulation to start collecting data.
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Simulation Steps
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="relative border-l-2 border-muted ml-3 pl-6 space-y-6">
                      {simulation.steps.map((step) => (
                        <div key={step.order} className="relative">
                          <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-border" />
                          <div>
                            <h4 className="font-semibold text-sm mb-1">{step.order}. {step.name}</h4>
                            <p className="text-sm text-muted-foreground mb-2">{step.description}</p>
                            <div className="flex gap-2 flex-wrap">
                              <Badge variant="secondary" className="text-xs bg-muted/50">{step.stepType}</Badge>
                              {step.fields.map(f => (
                                <span key={f} className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">{f}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {(() => {
                const hasQuantumData = runs?.some((r) => r.quantumScanResult != null);
                const showSection = simulation.pqcEnabled || hasQuantumData;
                if (!showSection) return null;
                if (runsLoading) {
                  return (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <ShieldAlert className="h-5 w-5 text-purple-600" />
                          Quantum Security History
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-full" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                }
                return runs ? <QuantumHistorySection runs={runs} simId={simId} /> : null;
              })()}
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Run History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {runsLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : !runs?.length ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No runs yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {runs.map(run => (
                        <Link key={run.id} href={`/simulations/${simId}/runs/${run.id}`}>
                          <div className="flex flex-col gap-1 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer group">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-medium text-muted-foreground">
                                {format(new Date(run.startedAt), "MMM d, HH:mm")}
                              </span>
                              <Badge 
                                variant={run.status === 'passed' ? 'default' : run.status === 'failed' ? 'destructive' : 'secondary'}
                                className={`text-[10px] uppercase h-5 ${run.status === 'passed' ? 'bg-green-500/10 text-green-700' : ''}`}
                              >
                                {run.status}
                              </Badge>
                            </div>
                            <div className="flex justify-between items-center mt-2 text-sm">
                              <span className="font-mono">{run.passedSteps}/{run.totalSteps} steps</span>
                              {run.durationMs && (
                                <span className="flex items-center text-muted-foreground text-xs">
                                  <Clock className="mr-1 h-3 w-3" />
                                  {(run.durationMs / 1000).toFixed(1)}s
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Schedule
                </CardTitle>
                <CardDescription>Automatically run this simulation on a recurring cadence.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="mb-2 block text-sm">Run frequency</Label>
                  <Select
                    value={schedulePreset ?? (simulation.schedule ? (SCHEDULE_PRESETS.find(p => p.value === simulation.schedule) ? simulation.schedule : "custom") : "none")}
                    onValueChange={(val) => {
                      setSchedulePreset(val);
                      if (val !== "custom") setCustomCron("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a schedule..." />
                    </SelectTrigger>
                    <SelectContent>
                      {SCHEDULE_PRESETS.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(schedulePreset === "custom" || (!schedulePreset && simulation.schedule && !SCHEDULE_PRESETS.find(p => p.value === simulation.schedule))) && (
                  <div>
                    <Label className="mb-2 block text-sm">Custom cron expression</Label>
                    <Input
                      placeholder="e.g. 0 */6 * * *"
                      value={customCron || (schedulePreset === null ? (simulation.schedule ?? "") : "")}
                      onChange={(e) => setCustomCron(e.target.value)}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Standard 5-field cron: minute hour day month weekday</p>
                  </div>
                )}
                {simulation.schedule && (
                  <p className="text-xs text-muted-foreground">
                    Current: <code className="font-mono bg-muted px-1 rounded">{simulation.schedule}</code>
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Alerts
                </CardTitle>
                <CardDescription>Get notified when the pass rate drops below a threshold.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="mb-3 block text-sm">
                    Alert threshold: <span className="font-bold text-foreground">{alertThreshold[0]}%</span>
                  </Label>
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={alertThreshold}
                    onValueChange={setAlertThreshold}
                    className="mb-1"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                  {simulation.alertThreshold !== null && simulation.alertThreshold !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Current: <span className="font-semibold">{simulation.alertThreshold}%</span>
                    </p>
                  )}
                </div>
                <div>
                  <Label className="mb-2 block text-sm">Alert destination</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Slack webhook URL or email address"
                      value={alertDestination}
                      onChange={(e) => {
                        setAlertDestination(e.target.value);
                        setTestAlertStatus("idle");
                      }}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSendTestAlert}
                      disabled={!alertDestination.trim() || testAlertMutation.isPending}
                      className={
                        testAlertStatus === "success"
                          ? "border-green-500 text-green-700 hover:bg-green-50"
                          : testAlertStatus === "error"
                          ? "border-red-500 text-red-700 hover:bg-red-50"
                          : ""
                      }
                    >
                      {testAlertMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : testAlertStatus === "success" ? (
                        <Check className="h-4 w-4" />
                      ) : testAlertStatus === "error" ? (
                        <XCircle className="h-4 w-4" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      <span className="ml-1.5 hidden sm:inline">
                        {testAlertStatus === "success" ? "Sent!" : testAlertStatus === "error" ? "Failed" : "Test"}
                      </span>
                    </Button>
                  </div>
                  {destHint && (
                    <p className="text-xs text-muted-foreground mt-1">Detected: {destHint}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {simulation.lastTestAlertAt
                      ? <>Last tested: <span className="font-medium text-foreground">{format(new Date(simulation.lastTestAlertAt), "MMM d, yyyy 'at' h:mm a")}</span></>
                      : <span className="italic">Never tested</span>
                    }
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Quantum security alerts</p>
                    <p className="text-xs text-muted-foreground">
                      {(quantumAlertEnabled !== null ? quantumAlertEnabled : (simulation.quantumAlertEnabled ?? false))
                        ? "Alert when quantum posture drops from Safe to Unsafe"
                        : "Disabled — no alert sent on quantum regression"}
                    </p>
                  </div>
                  <Switch
                    checked={quantumAlertEnabled !== null ? quantumAlertEnabled : (simulation.quantumAlertEnabled ?? false)}
                    onCheckedChange={setQuantumAlertEnabled}
                  />
                </div>
                <div>
                  <Label className="mb-2 block text-sm">Custom message <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Textarea
                    placeholder="Add a link to your dashboard, mention a team channel, or include any context that makes this alert more actionable..."
                    value={alertMessage}
                    onChange={(e) => setAlertMessage(e.target.value)}
                    className="text-sm resize-none"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Appended to both real alerts and test alerts.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-purple-600" />
                  Post-Quantum Check
                </CardTitle>
                <CardDescription>
                  When enabled, each run will inspect the target URL's TLS handshake for quantum-vulnerable algorithms.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start justify-between rounded-lg border p-3 bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Scan on every run</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {pqcEnabled
                        ? "TLS handshake will be inspected after each run — results appear in the run report."
                        : "Quantum security scanning is disabled for this simulation."}
                    </p>
                  </div>
                  <Switch
                    checked={pqcEnabled}
                    onCheckedChange={setPqcEnabled}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="h-5 w-5" />
                  Webhook
                </CardTitle>
                <CardDescription>
                  POST to this URL to trigger a run from CI/CD pipelines (e.g. GitHub Actions, Coolify).
                  No authentication required — the token in the URL acts as the secret.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Webhook access</p>
                    <p className="text-xs text-muted-foreground">
                      {(webhookEnabled !== null ? webhookEnabled : (simulation.webhookEnabled ?? true))
                        ? "Enabled — anyone with the URL can trigger a run"
                        : "Disabled — webhook trigger returns 403"}
                    </p>
                  </div>
                  <Switch
                    checked={webhookEnabled !== null ? webhookEnabled : (simulation.webhookEnabled ?? true)}
                    onCheckedChange={setWebhookEnabled}
                  />
                </div>
                {webhookUrl ? (
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={webhookUrl}
                      className="font-mono text-xs bg-muted"
                    />
                    <Button variant="outline" size="icon" onClick={handleCopyWebhook}>
                      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No webhook token assigned. Save settings to generate one.</p>
                )}
                {webhookUrl && (
                  <p className="text-xs text-muted-foreground">
                    Example: <code className="font-mono bg-muted px-1 rounded">curl -X POST {webhookUrl}</code>
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="md:col-span-2 flex justify-end">
              <Button onClick={handleSaveSettings} disabled={updateSimMutation.isPending}>
                {updateSimMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Settings
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
