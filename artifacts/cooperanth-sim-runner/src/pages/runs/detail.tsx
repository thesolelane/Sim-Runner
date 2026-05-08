import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetRun,
  useGetSimulation,
  useListRuns,
  getGetRunQueryKey,
  getGetSimulationQueryKey,
  getListRunsQueryKey,
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
  Wallet,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { QuantumSecurityCard } from "@/components/quantum-security-card";

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
