import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetRun,
  useGetSimulation,
  getGetRunQueryKey,
  getGetSimulationQueryKey,
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
} from "lucide-react";
import { format } from "date-fns";

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
    </div>
  );
}
