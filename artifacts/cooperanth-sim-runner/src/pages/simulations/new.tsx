import { useState } from "react";
import { useLocation } from "wouter";
import {
  useScanUrl,
  useCreateSimulation,
  getGetSimulationStatsQueryKey,
  getListSimulationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Search,
  ArrowRight,
  Save,
  LayoutTemplate,
  GripVertical,
  Trash2,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldAlert,
  Link2,
  Wallet,
  Globe,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import type {
  DetectedStep,
  FlowStep,
  BlockchainAccountInfo,
} from "@workspace/api-client-react";

const ACTION_TYPES = ["fill", "click", "navigate", "waitForText", "selectOption", "consent", "confirmation"];

const SUPPORTED_CHAINS = [
  { id: "solana", name: "Solana" },
  { id: "ethereum", name: "Ethereum" },
  { id: "base", name: "Base" },
  { id: "arbitrum", name: "Arbitrum One" },
  { id: "monad", name: "Monad Testnet" },
];

interface EditableStep {
  order: number;
  name: string;
  description: string;
  fields: string[];
  stepType: string;
  selector: string;
  actionType: string;
  confidence: string;
  candidateSelectors: string[];
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  if (confidence === "high") {
    return (
      <Badge variant="outline" className="gap-1 border-green-200 bg-green-50 text-green-700 text-xs">
        <CheckCircle2 className="h-3 w-3" /> High
      </Badge>
    );
  }
  if (confidence === "medium") {
    return (
      <Badge variant="outline" className="gap-1 border-yellow-200 bg-yellow-50 text-yellow-700 text-xs">
        <Info className="h-3 w-3" /> Medium
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-red-200 bg-red-50 text-red-700 text-xs">
      <AlertTriangle className="h-3 w-3" /> Low
    </Badge>
  );
}

function BlockchainAccountCard({ info }: { info: BlockchainAccountInfo }) {
  const accountTypeLabel =
    info.accountType === "contract"
      ? "Smart Contract"
      : info.accountType === "wallet"
      ? "Wallet"
      : "Unknown";

  return (
    <div className="space-y-4">
      {info.error && (
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Could not reach RPC endpoint: {info.error}. Account info may be incomplete.</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="space-y-1 col-span-2">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Address</div>
          <div className="font-mono text-xs break-all bg-muted px-2 py-1.5 rounded">{info.address}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Chain</div>
          <div className="font-medium">{info.chainName}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Account Type</div>
          <Badge
            variant="outline"
            className={
              info.accountType === "contract"
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : info.accountType === "wallet"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-muted"
            }
          >
            {accountTypeLabel}
          </Badge>
        </div>
        {info.balance && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Balance</div>
            <div className="font-mono text-sm">{info.balance}</div>
          </div>
        )}
        {info.dataSize !== null && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Bytecode Size</div>
            <div className="font-mono text-sm">{info.dataSize.toLocaleString()} bytes</div>
          </div>
        )}
        {info.owner && (
          <div className="space-y-1 col-span-2">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Owner Program</div>
            <div className="font-mono text-xs break-all bg-muted px-2 py-1 rounded">{info.owner}</div>
          </div>
        )}
      </div>

      <div className="rounded-md border p-3 bg-muted/30">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
          Quantum Readiness — {info.quantumRoadmap.status}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{info.quantumRoadmap.details}</p>
        {info.quantumRoadmap.reference && (
          <a
            href={info.quantumRoadmap.reference}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1.5"
          >
            Learn more <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <a
        href={info.explorerUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        View on block explorer
      </a>
    </div>
  );
}

export default function NewSimulation() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);

  const [scanType, setScanType] = useState<"web" | "blockchain">("web");

  const [url, setUrl] = useState("");
  const [appName, setAppName] = useState("");
  const [simName, setSimName] = useState("");
  const [pqcEnabled, setPqcEnabled] = useState(false);

  const [chainId, setChainId] = useState("ethereum");
  const [address, setAddress] = useState("");
  const [blockchainResult, setBlockchainResult] = useState<BlockchainAccountInfo | null>(null);

  const scanUrlMutation = useScanUrl();
  const [editableSteps, setEditableSteps] = useState<EditableStep[]>([]);
  const [overallConfidence, setOverallConfidence] = useState("");

  const createSimMutation = useCreateSimulation();

  const fromDetected = (s: DetectedStep): EditableStep => ({
    order: s.order,
    name: s.name,
    description: s.description,
    fields: s.fields,
    stepType: s.stepType,
    selector: s.selector,
    actionType: s.actionType,
    confidence: s.confidence,
    candidateSelectors: s.candidateSelectors,
  });

  const handleScan = () => {
    if (scanType === "blockchain") {
      if (!appName || !address) {
        toast({
          title: "Missing fields",
          description: "Please provide an app name and wallet/contract address.",
          variant: "destructive",
        });
        return;
      }
      scanUrlMutation.mutate(
        { data: { appName, scanType: "blockchain", chainId, address } as Parameters<typeof scanUrlMutation.mutate>[0]["data"] },
        {
          onSuccess: (data) => {
            setBlockchainResult((data.blockchainResult as BlockchainAccountInfo) ?? null);
            if (!simName) setSimName(`${appName} — ${SUPPORTED_CHAINS.find(c => c.id === chainId)?.name ?? chainId}`);
            setStep(2);
          },
          onError: () => {
            toast({
              title: "Lookup Failed",
              description: "Could not look up the address on-chain.",
              variant: "destructive",
            });
          },
        },
      );
      return;
    }

    if (!url || !appName) {
      toast({
        title: "Missing fields",
        description: "Please provide both app name and URL.",
        variant: "destructive",
      });
      return;
    }

    scanUrlMutation.mutate(
      { data: { url, appName } },
      {
        onSuccess: (data) => {
          setEditableSteps((data.detectedSteps || []).map(fromDetected));
          setOverallConfidence(data.confidence);
          if (!simName) setSimName(`${appName} Onboarding`);
          setStep(2);
        },
        onError: () => {
          toast({
            title: "Scan Failed",
            description: "Could not scan the provided URL.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setEditableSteps((prev) => {
      const arr = [...prev];
      const [dragged] = arr.splice(dragIndex, 1);
      arr.splice(index, 0, dragged);
      setDragIndex(index);
      return arr.map((s, i) => ({ ...s, order: i + 1 }));
    });
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  const removeStep = (index: number) => {
    setEditableSteps((prev) =>
      prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 })),
    );
  };

  const addStep = () => {
    setEditableSteps((prev) => [
      ...prev,
      {
        order: prev.length + 1,
        name: "New Step",
        description: "Describe what this step does",
        fields: [],
        stepType: "form",
        selector: "",
        actionType: "fill",
        confidence: "medium",
        candidateSelectors: [],
      },
    ]);
  };

  const updateStep = (index: number, patch: Partial<EditableStep>) => {
    setEditableSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const handleSave = () => {
    if (!simName) {
      toast({
        title: "Missing fields",
        description: "Simulation name is required.",
        variant: "destructive",
      });
      return;
    }

    if (scanType === "blockchain") {
      if (!blockchainResult) {
        toast({ title: "Error", description: "Blockchain scan result missing.", variant: "destructive" });
        return;
      }
      createSimMutation.mutate(
        {
          data: {
            name: simName,
            appName,
            appUrl: address,
            appType: "blockchain",
            steps: [],
            scanType: "blockchain",
            chainId,
            targetAddress: address,
          } as Parameters<typeof createSimMutation.mutate>[0]["data"],
        },
        {
          onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: getListSimulationsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetSimulationStatsQueryKey() });
            toast({ title: "Simulation Created", description: "Blockchain simulation saved." });
            setLocation(`/simulations/${data.id}`);
          },
          onError: () => {
            toast({ title: "Error", description: "Failed to create simulation.", variant: "destructive" });
          },
        },
      );
      return;
    }

    const payloadSteps: FlowStep[] = editableSteps.map((s) => ({
      order: s.order,
      name: s.name,
      description: s.description,
      fields: s.fields,
      stepType: s.stepType,
      selector: s.selector || undefined,
      actionType: s.actionType || undefined,
      confidence: s.confidence || undefined,
      candidateSelectors: s.candidateSelectors.length > 0 ? s.candidateSelectors : undefined,
    }));

    createSimMutation.mutate(
      {
        data: {
          name: simName,
          appName,
          appUrl: url,
          appType: "web",
          steps: payloadSteps,
          pqcEnabled,
        },
      },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getListSimulationsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetSimulationStatsQueryKey() });
          toast({ title: "Simulation Created", description: "Successfully saved the simulation flow." });
          setLocation(`/simulations/${data.id}`);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to create simulation.", variant: "destructive" });
        },
      },
    );
  };

  const lowConfidenceCount = editableSteps.filter((s) => s.confidence === "low").length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Create Simulation</h1>
        <p className="text-muted-foreground mt-1">Scan a target app or blockchain address and build a simulation.</p>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${step >= 1 ? "border-primary bg-primary text-primary-foreground" : "border-muted text-muted-foreground"}`}
        >
          1
        </div>
        <div className={`h-1 flex-1 ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${step >= 2 ? "border-primary bg-primary text-primary-foreground" : "border-muted text-muted-foreground"}`}
        >
          2
        </div>
        <div className={`h-1 flex-1 ${step >= 3 ? "bg-primary" : "bg-muted"}`} />
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${step >= 3 ? "border-primary bg-primary text-primary-foreground" : "border-muted text-muted-foreground"}`}
        >
          3
        </div>
      </div>

      {step === 1 && (
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader>
            <CardTitle>Target Configuration</CardTitle>
            <CardDescription>Choose your scan type and configure the target.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setScanType("web")}
                className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-all ${
                  scanType === "web"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30"
                }`}
              >
                <Globe className={`h-5 w-5 ${scanType === "web" ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <div className="font-semibold text-sm">Web App</div>
                  <div className="text-xs text-muted-foreground">Playwright onboarding flow scan</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setScanType("blockchain")}
                className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-all ${
                  scanType === "blockchain"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30"
                }`}
              >
                <Wallet className={`h-5 w-5 ${scanType === "blockchain" ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <div className="font-semibold text-sm">Wallet / Smart Contract</div>
                  <div className="text-xs text-muted-foreground">On-chain account monitor</div>
                </div>
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="appName">App Name</Label>
              <Input
                id="appName"
                placeholder={scanType === "blockchain" ? "e.g. Uniswap V3 Pool" : "e.g. Acme Corp"}
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
              />
            </div>

            {scanType === "web" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="url">Start URL</Label>
                  <Input
                    id="url"
                    placeholder="https://app.example.com/signup"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
                <div className="flex items-start justify-between rounded-lg border p-3 bg-muted/30">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="h-4 w-4 mt-0.5 text-purple-600 shrink-0" />
                    <div>
                      <Label htmlFor="pqc-toggle" className="text-sm font-medium cursor-pointer">
                        Post-Quantum Check
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Inspect the target URL's TLS handshake for quantum-vulnerable algorithms on each run.
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="pqc-toggle"
                    checked={pqcEnabled}
                    onCheckedChange={setPqcEnabled}
                  />
                </div>
              </>
            )}

            {scanType === "blockchain" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="chain">Chain</Label>
                  <Select value={chainId} onValueChange={setChainId}>
                    <SelectTrigger id="chain">
                      <SelectValue placeholder="Select chain…" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_CHAINS.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Wallet / Contract Address</Label>
                  <Input
                    id="address"
                    placeholder={chainId === "solana" ? "e.g. 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM" : "e.g. 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="rounded-md bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700 flex items-start gap-2">
                  <Link2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    Uses public RPC endpoints only. Balance, bytecode presence, and quantum roadmap data are fetched without authentication or paid APIs.
                  </span>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="justify-end border-t p-4 bg-muted/20">
            <Button onClick={handleScan} disabled={scanUrlMutation.isPending}>
              {scanUrlMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : scanType === "blockchain" ? (
                <Wallet className="mr-2 h-4 w-4" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              {scanUrlMutation.isPending
                ? scanType === "blockchain" ? "Looking up address…" : "Scanning with Playwright…"
                : scanType === "blockchain" ? "Look Up Address" : "Scan Application"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 2 && scanType === "blockchain" && blockchainResult && (
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              On-Chain Account Info
            </CardTitle>
            <CardDescription>
              Review the account details. Each run will re-query this address to detect changes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BlockchainAccountCard info={blockchainResult} />
          </CardContent>
          <CardFooter className="justify-between border-t p-4 bg-muted/20">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={() => setStep(3)}>
              Continue to Save
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 2 && scanType === "web" && (
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Review & Edit Steps</CardTitle>
                <CardDescription>
                  {editableSteps.length} steps detected with{" "}
                  <span
                    className={
                      overallConfidence === "high"
                        ? "text-green-600 font-medium"
                        : overallConfidence === "medium"
                          ? "text-yellow-600 font-medium"
                          : "text-red-600 font-medium"
                    }
                  >
                    {overallConfidence}
                  </span>{" "}
                  overall confidence.
                </CardDescription>
              </div>
              {lowConfidenceCount > 0 && (
                <div className="flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 rounded-md px-3 py-1.5 text-xs shrink-0">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {lowConfidenceCount} step{lowConfidenceCount > 1 ? "s" : ""} need review
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {editableSteps.map((s, i) => (
              <div
                key={i}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDragEnd={handleDragEnd}
                className={`border rounded-lg overflow-hidden transition-colors ${
                  s.confidence === "low" ? "border-red-200 bg-red-500/5" : "bg-card"
                } ${dragIndex === i ? "opacity-50 ring-2 ring-primary/40" : ""}`}
              >
                <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing shrink-0" />
                    <span className="text-xs text-muted-foreground font-mono w-5 text-center">
                      {s.order}
                    </span>
                    <Input
                      value={s.name}
                      onChange={(e) => updateStep(i, { name: e.target.value })}
                      className="h-7 text-sm font-semibold border-0 bg-transparent p-0 focus-visible:ring-0 w-48"
                    />
                    <ConfidenceBadge confidence={s.confidence} />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => removeStep(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Action Type
                    </Label>
                    <Select
                      value={s.actionType}
                      onValueChange={(v) => updateStep(i, { actionType: v })}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTION_TYPES.map((at) => (
                          <SelectItem key={at} value={at}>
                            {at}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Selector
                    </Label>
                    {s.candidateSelectors.length > 1 ? (
                      <Select
                        value={s.selector}
                        onValueChange={(v) => updateStep(i, { selector: v })}
                      >
                        <SelectTrigger className="h-8 text-sm font-mono">
                          <SelectValue placeholder="Select element…" />
                        </SelectTrigger>
                        <SelectContent>
                          {s.candidateSelectors.map((cs, ci) => (
                            <SelectItem key={ci} value={cs} className="font-mono text-xs">
                              {cs.length > 50 ? cs.slice(0, 50) + "…" : cs}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={s.selector}
                        onChange={(e) => updateStep(i, { selector: e.target.value })}
                        className="h-8 text-xs font-mono"
                        placeholder="CSS selector or text…"
                      />
                    )}
                  </div>

                  {s.fields.length > 0 && (
                    <div className="md:col-span-2 space-y-1.5">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                        Fields
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {s.fields.map((f, fi) => (
                          <div key={fi} className="flex items-center gap-1 bg-muted rounded px-2 py-0.5">
                            <span className="text-xs font-mono">{f}</span>
                            <button
                              onClick={() =>
                                updateStep(i, { fields: s.fields.filter((_, fii) => fii !== fi) })
                              }
                              className="text-muted-foreground hover:text-destructive ml-1"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const newField = window.prompt("Field name:");
                            if (newField?.trim()) {
                              updateStep(i, { fields: [...s.fields, newField.trim()] });
                            }
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground border border-dashed rounded px-2 py-0.5"
                        >
                          + Add field
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={addStep}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Step
            </Button>
          </CardContent>
          <CardFooter className="justify-between border-t p-4 bg-muted/20">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={() => setStep(3)} disabled={editableSteps.length === 0}>
              Continue to Save
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 3 && (
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader>
            <CardTitle>Finalize</CardTitle>
            <CardDescription>Name your simulation and save it to your dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="simName">Simulation Name</Label>
              <Input
                id="simName"
                value={simName}
                onChange={(e) => setSimName(e.target.value)}
              />
            </div>

            <div className="rounded-md bg-muted p-4 mt-6">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <LayoutTemplate className="h-4 w-4" />
                Summary
              </h4>
              {scanType === "blockchain" ? (
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside ml-4">
                  <li>Type: Blockchain ({SUPPORTED_CHAINS.find(c => c.id === chainId)?.name ?? chainId})</li>
                  <li className="font-mono text-xs break-all">Address: {address}</li>
                  {blockchainResult?.accountType && (
                    <li>Account type: {blockchainResult.accountType}</li>
                  )}
                </ul>
              ) : (
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside ml-4">
                  <li>
                    Targeting: {appName} ({url})
                  </li>
                  <li>Steps to simulate: {editableSteps.length}</li>
                  {lowConfidenceCount > 0 && (
                    <li className="text-yellow-600">
                      {lowConfidenceCount} low-confidence step{lowConfidenceCount > 1 ? "s" : ""} — review
                      recommended
                    </li>
                  )}
                </ul>
              )}
            </div>
          </CardContent>
          <CardFooter className="justify-between border-t p-4 bg-muted/20">
            <Button variant="ghost" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button onClick={handleSave} disabled={createSimMutation.isPending}>
              {createSimMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Simulation
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
