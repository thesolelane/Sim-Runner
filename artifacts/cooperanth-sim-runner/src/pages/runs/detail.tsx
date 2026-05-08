import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetRun,
  useGetSimulation,
  useListRuns,
  getGetRunQueryKey,
  getGetSimulationQueryKey,
  getListRunsQueryKey,
  type QuantumScanResult,
  type BlockchainAccountInfo,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ImageIcon,
  Monitor,
  ChevronDown,
  ChevronUp,
  MousePointer,
  Video,
  Download,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Info,
  Wallet,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";

type QuantumSeverity = "info" | "warning" | "critical";

function severityConfig(severity: QuantumSeverity) {
  if (severity === "critical") {
    return {
      chip: "bg-red-100 text-red-700 border-red-200",
      label: "Critical",
    };
  }
  if (severity === "warning") {
    return {
      chip: "bg-yellow-100 text-yellow-700 border-yellow-200",
      label: "Warning",
    };
  }
  return {
    chip: "bg-blue-100 text-blue-700 border-blue-200",
    label: "Info",
  };
}

function QuantumSecurityCard({
  result,
  pqcEnabled,
}: {
  result: QuantumScanResult | null | undefined;
  pqcEnabled?: boolean;
}) {
  const [explainerOpen, setExplainerOpen] = useState(false);

  if (result === undefined || result === null) {
    const message = pqcEnabled === false
      ? "Post-quantum scanning is not enabled for this simulation. Turn it on in the simulation's Settings tab."
      : "Scan unavailable — this run was completed before quantum security scanning was introduced.";
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-muted-foreground" />
            Quantum Security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    );
  }

  if (result.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-muted-foreground" />
            Quantum Security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Scan unavailable — the scanner could not reach the target host ({result.error}).
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasNoTls = result.findings.some(
    (f) => f.field === "TLS" && f.detectedValue.includes("None"),
  );

  let overallBadge: React.ReactNode;
  if (result.quantumSafe) {
    overallBadge = (
      <Badge className="bg-green-100 text-green-700 border-green-200 gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5" />
        Quantum-Safe
      </Badge>
    );
  } else if (hasNoTls) {
    overallBadge = (
      <Badge className="bg-red-100 text-red-700 border-red-200 gap-1.5">
        <ShieldX className="h-3.5 w-3.5" />
        No TLS
      </Badge>
    );
  } else {
    overallBadge = (
      <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 gap-1.5">
        <ShieldAlert className="h-3.5 w-3.5" />
        At Risk
      </Badge>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-purple-600" />
            Quantum Security
          </CardTitle>
          <CardDescription className="mt-1 text-xs">
            Passive TLS handshake inspection — no traffic intercepted.
            {result.scannedAt && (
              <span className="ml-1 text-muted-foreground">
                Scanned {format(new Date(result.scannedAt), "MMM d, HH:mm:ss")}
              </span>
            )}
          </CardDescription>
        </div>
        <div className="shrink-0">{overallBadge}</div>
      </CardHeader>

      <CardContent className="space-y-4">
        {result.error && result.findings.length === 0 && (
          <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 font-mono">
            Scan error: {result.error}
          </div>
        )}

        {(result.tlsVersion || result.keyExchange || result.cipherSuite || result.certSignatureAlgorithm) && (
          <div className="grid grid-cols-2 gap-3 text-xs">
            {result.tlsVersion && (
              <div className="space-y-0.5">
                <div className="text-muted-foreground uppercase tracking-wider font-medium">TLS Version</div>
                <div className="font-mono font-medium">{result.tlsVersion}</div>
              </div>
            )}
            {result.keyExchange && (
              <div className="space-y-0.5">
                <div className="text-muted-foreground uppercase tracking-wider font-medium">Key Exchange</div>
                <div className="font-mono font-medium">{result.keyExchange}</div>
              </div>
            )}
            {result.cipherSuite && (
              <div className="space-y-0.5 col-span-2">
                <div className="text-muted-foreground uppercase tracking-wider font-medium">Cipher Suite</div>
                <div className="font-mono font-medium break-all">{result.cipherSuite}</div>
              </div>
            )}
            {result.certSignatureAlgorithm && (
              <div className="space-y-0.5 col-span-2">
                <div className="text-muted-foreground uppercase tracking-wider font-medium">Certificate Signature</div>
                <div className="font-mono font-medium">{result.certSignatureAlgorithm}</div>
              </div>
            )}
          </div>
        )}

        {result.findings.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Findings</div>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-xs">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Field</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Detected Value</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {result.findings.map((finding, i) => {
                    const { chip, label } = severityConfig(finding.severity);
                    return (
                      <tr key={i} className="border-t hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2.5 font-medium text-xs whitespace-nowrap">{finding.field}</td>
                        <td className="px-3 py-2.5 font-mono text-xs">{finding.detectedValue}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant="outline" className={`text-[10px] h-5 ${chip}`}>
                            {label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-2">
              {result.findings.map((finding, i) => (
                <div key={i} className="text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2 leading-relaxed">
                  <span className="font-medium text-foreground">{finding.field}: </span>
                  {finding.explanation}
                </div>
              ))}
            </div>
          </div>
        )}

        {result.findings.length === 0 && !result.error && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-md px-3 py-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            No quantum-vulnerable configurations detected.
          </div>
        )}

        <div className="border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setExplainerOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors text-left"
          >
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              What does this mean?
            </span>
            {explainerOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {explainerOpen && (
            <div className="px-4 pb-4 pt-1 text-xs text-muted-foreground space-y-3 border-t bg-muted/10 leading-relaxed">
              <div>
                <p className="font-semibold text-foreground mb-1">Harvest now, decrypt later</p>
                <p>
                  Nation-state adversaries can capture your encrypted traffic today and store it. Once a cryptographically-relevant
                  quantum computer exists, they can retroactively decrypt it using Shor's algorithm — breaking RSA and ECC key
                  exchange. Sensitive data exchanged now (authentication tokens, personal data, API keys) could be exposed years
                  from now.
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">ML-KEM and post-quantum hybrids</p>
                <p>
                  NIST has standardized ML-KEM (formerly Kyber, FIPS 203) as the post-quantum key encapsulation mechanism.
                  Major browsers negotiate <span className="font-mono bg-muted px-1 rounded">X25519Kyber768</span> (a hybrid
                  of classical X25519 and Kyber768) when the server supports it — providing protection against both classical
                  and quantum attackers simultaneously.
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">ML-DSA for certificate signatures</p>
                <p>
                  NIST also standardized ML-DSA (FIPS 204) to replace RSA/ECDSA for digital signatures. CA ecosystem
                  migration is in progress — most certificates today still use classical algorithms.
                </p>
              </div>
              <div>
                <a
                  href="https://csrc.nist.gov/projects/post-quantum-cryptography"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline font-medium"
                >
                  NIST Post-Quantum Cryptography standards →
                </a>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type BlockchainDiff = Partial<Record<keyof BlockchainAccountInfo, boolean>>;

function computeDiff(current: BlockchainAccountInfo, prev: BlockchainAccountInfo): BlockchainDiff {
  const diff: BlockchainDiff = {};
  const fields: (keyof BlockchainAccountInfo)[] = [
    "accountType", "balance", "isActive", "dataSize", "bytecodeHash",
    "executable", "owner", "isPda", "isNativeProgram",
  ];
  for (const field of fields) {
    if (current[field] !== prev[field]) {
      diff[field] = true;
    }
  }
  return diff;
}

function ChangedBadge() {
  return (
    <Badge variant="outline" className="text-[10px] h-4 border-amber-300 bg-amber-50 text-amber-700 ml-1.5">
      changed
    </Badge>
  );
}

function BlockchainInfoCard({
  info,
  prevInfo,
}: {
  info: BlockchainAccountInfo;
  prevInfo?: BlockchainAccountInfo | null;
}) {
  const diff: BlockchainDiff = prevInfo ? computeDiff(info, prevInfo) : {};
  const hasAnyChange = Object.keys(diff).length > 0;
  const bytecodeChanged = diff.bytecodeHash === true;

  const accountTypeLabel =
    info.accountType === "contract"
      ? "Smart Contract"
      : info.accountType === "wallet"
      ? "Wallet"
      : "Unknown";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          On-Chain Account Snapshot
        </CardTitle>
        <CardDescription>
          Live data fetched from {info.chainName} at the time of this run.
          {prevInfo && (
            <span className="ml-1 text-muted-foreground">
              Compared with previous run.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {info.error && (
          <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>RPC error: {info.error}</span>
          </div>
        )}

        {bytecodeChanged && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2.5">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              <strong>Contract bytecode changed</strong> since the previous run. This may indicate a contract upgrade or redeployment.
            </span>
          </div>
        )}

        {prevInfo && hasAnyChange && !bytecodeChanged && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Some account fields changed since the previous run (highlighted below).</span>
          </div>
        )}

        {prevInfo && !hasAnyChange && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>No changes detected since the previous run.</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Chain</div>
            <div className="font-semibold">{info.chainName}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
              Account Type
              {diff.accountType && <ChangedBadge />}
            </div>
            <div className="flex items-center gap-1.5">
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
              {info.isNativeProgram && (
                <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 text-xs">
                  Native
                </Badge>
              )}
              {info.isPda && (
                <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 text-xs">
                  PDA
                </Badge>
              )}
            </div>
          </div>

          <div className="col-span-2">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Address</div>
            <div className="font-mono text-xs break-all bg-muted px-3 py-2 rounded">{info.address}</div>
          </div>

          {info.balance && (
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
                Balance
                {diff.balance && <ChangedBadge />}
              </div>
              <div className={`font-mono text-sm ${diff.balance ? "text-amber-700" : ""}`}>
                {info.balance}
                {diff.balance && prevInfo?.balance && (
                  <span className="text-xs text-muted-foreground ml-1.5 line-through">{prevInfo.balance}</span>
                )}
              </div>
            </div>
          )}

          {info.dataSize !== null && (
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
                Bytecode Size
                {diff.dataSize && <ChangedBadge />}
              </div>
              <div className={`font-mono text-sm ${diff.dataSize ? "text-amber-700" : ""}`}>
                {info.dataSize.toLocaleString()} bytes
              </div>
            </div>
          )}

          {info.bytecodeHash && (
            <div className="col-span-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
                Bytecode Hash (SHA-256)
                {diff.bytecodeHash && <ChangedBadge />}
              </div>
              <div className={`font-mono text-xs break-all bg-muted px-2 py-1 rounded ${diff.bytecodeHash ? "bg-red-50 border border-red-200 text-red-700" : ""}`}>
                {info.bytecodeHash}
              </div>
              {diff.bytecodeHash && prevInfo?.bytecodeHash && (
                <div className="font-mono text-xs break-all bg-muted px-2 py-1 rounded mt-1 line-through text-muted-foreground">
                  {prevInfo.bytecodeHash}
                </div>
              )}
            </div>
          )}

          {info.owner && (
            <div className="col-span-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
                Owner Program
                {diff.owner && <ChangedBadge />}
              </div>
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
      </CardContent>
    </Card>
  );
}

export default function RunDetail() {
  const { id, runId } = useParams<{ id: string; runId: string }>();
  const simId = parseInt(id || "0", 10);
  const rId = parseInt(runId || "0", 10);

  const [expandedScreenshots, setExpandedScreenshots] = useState<Set<number>>(new Set());

  const { data: simulation } = useGetSimulation(simId, {
    query: { enabled: !!simId, queryKey: getGetSimulationQueryKey(simId) },
  });

  const { data: run, isLoading } = useGetRun(simId, rId, {
    query: { enabled: !!simId && !!rId, queryKey: getGetRunQueryKey(simId, rId) },
  });

  const { data: allRuns } = useListRuns(simId, {
    query: { enabled: !!simId, queryKey: getListRunsQueryKey(simId) },
  });

  const previousRun = (() => {
    if (!allRuns || !rId) return null;
    const sorted = [...allRuns].sort((a, b) => a.id - b.id);
    const idx = sorted.findIndex((r) => r.id === rId);
    return idx > 0 ? sorted[idx - 1] : null;
  })();

  const prevBlockchainInfo = previousRun?.blockchainScanResult as BlockchainAccountInfo | null | undefined;

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!run) {
    return <div className="p-8 text-center text-muted-foreground">Run details not found.</div>;
  }

  const isPassed = run.status === "passed";
  const isPartial = run.status === "partial";

  const toggleScreenshot = (stepOrder: number) => {
    setExpandedScreenshots((prev) => {
      const next = new Set(prev);
      if (next.has(stepOrder)) next.delete(stepOrder);
      else next.add(stepOrder);
      return next;
    });
  };

  const quantumScanResult = run.quantumScanResult;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Link
          href={`/simulations/${simId}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm transition-colors"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Simulation
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            Run Report
            <Badge
              variant={isPassed ? "default" : "destructive"}
              className={
                isPassed
                  ? "bg-green-500/10 text-green-700 border-green-200"
                  : isPartial
                    ? "bg-yellow-500/10 text-yellow-700 border-yellow-200"
                    : ""
              }
            >
              {run.status.toUpperCase()}
            </Badge>
            {run.headedMode && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Monitor className="h-3 w-3" /> Headed
              </Badge>
            )}
            {run.videoPath && (
              <Badge variant="outline" className="gap-1 text-xs border-purple-200 bg-purple-50 text-purple-700">
                <Video className="h-3 w-3" /> Video Recorded
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Simulation:{" "}
            <span className="font-medium text-foreground">
              {simulation?.name || `Sim #${simId}`}
            </span>
          </p>
        </div>
        <div className="flex gap-4 text-sm bg-muted/50 p-3 rounded-lg border">
          <div>
            <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Started</div>
            <div className="font-medium">{format(new Date(run.startedAt), "MMM d, HH:mm:ss")}</div>
          </div>
          <div className="w-px bg-border"></div>
          <div>
            <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Duration</div>
            <div className="font-medium flex items-center">
              <Clock className="mr-1 h-3 w-3 text-muted-foreground" />
              {run.durationMs ? `${(run.durationMs / 1000).toFixed(2)}s` : "-"}
            </div>
          </div>
        </div>
      </div>

      {run.videoUrl && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Video className="h-5 w-5 text-purple-600" />
              Session Recording
            </CardTitle>
            <a
              href={(() => { const u = new URL(run.videoUrl, window.location.origin); u.searchParams.set("download", "1"); return u.toString(); })()}
              download={`run-${rId}-recording.webm`}
              data-testid="button-download-video"
            >
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="h-3.5 w-3.5" />
                Download
              </Button>
            </a>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg overflow-hidden border bg-black">
              <video
                controls
                className="w-full max-h-96"
                src={run.videoUrl}
              >
                Your browser does not support the video element.
              </video>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Full browser session recorded in headed mode. Video may no longer be available if the server was restarted.
            </p>
          </CardContent>
        </Card>
      )}

      {run.blockchainScanResult && (
        <BlockchainInfoCard
          info={run.blockchainScanResult as BlockchainAccountInfo}
          prevInfo={prevBlockchainInfo}
        />
      )}

      {!run.blockchainScanResult && (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Step Breakdown</CardTitle>
          <CardDescription>
            {run.passedSteps} of {run.totalSteps} steps completed successfully.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {run.stepResults.map((step) => {
            const stepPassed = step.status === "passed";
            const hasScreenshot = !!(step as { screenshot?: string | null }).screenshot;
            const screenshot = (step as { screenshot?: string | null }).screenshot;
            const selectorUsed = (step as { selectorUsed?: string | null }).selectorUsed;
            const actionTaken = (step as { actionTaken?: string | null }).actionTaken;
            const isExpanded = expandedScreenshots.has(step.stepOrder);

            return (
              <div
                key={step.stepOrder}
                className={`border rounded-lg overflow-hidden transition-colors ${
                  stepPassed ? "bg-card" : "bg-red-500/5 border-red-200"
                }`}
              >
                <div className="flex items-start justify-between p-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {stepPassed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium flex items-center gap-2 flex-wrap">
                        {step.stepOrder}. {step.stepName}
                        <Badge
                          variant="outline"
                          className="text-[10px] h-4 font-mono font-normal"
                        >
                          {(step.durationMs / 1000).toFixed(2)}s
                        </Badge>
                      </h4>

                      {actionTaken && (
                        <div className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                          <MousePointer className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>{actionTaken}</span>
                        </div>
                      )}

                      {selectorUsed && (
                        <div className="mt-1 flex items-center gap-1.5 text-xs">
                          <span className="text-muted-foreground">Selector:</span>
                          <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px] max-w-xs truncate">
                            {selectorUsed}
                          </code>
                        </div>
                      )}

                      {step.errorMessage && (
                        <div className="mt-2 bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                          <span className="font-mono text-xs">{step.errorMessage}</span>
                        </div>
                      )}

                      {step.generatedData && Object.keys(step.generatedData).length > 0 && (
                        <div className="mt-3">
                          <div className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                            Generated Test Data
                          </div>
                          <div className="bg-muted/50 rounded-md p-3 text-xs font-mono overflow-x-auto">
                            <pre>{JSON.stringify(step.generatedData, null, 2)}</pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {hasScreenshot && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 ml-3 h-8 text-xs gap-1.5"
                      onClick={() => toggleScreenshot(step.stepOrder)}
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      Screenshot
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                </div>

                {hasScreenshot && isExpanded && screenshot && (
                  <div className="border-t bg-muted/30 p-4">
                    <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5" />
                      Failure Screenshot
                    </div>
                    <div className="rounded-lg overflow-hidden border bg-black">
                      <img
                        src={`data:image/png;base64,${screenshot}`}
                        alt={`Failure screenshot for step ${step.stepOrder}: ${step.stepName}`}
                        className="w-full h-auto max-h-96 object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
      )}

      <QuantumSecurityCard result={quantumScanResult} pqcEnabled={simulation?.pqcEnabled} />
    </div>
  );
}
