import { useParams, Link } from "wouter";
import { 
  useGetRun,
  useGetSimulation,
  getGetRunQueryKey,
  getGetSimulationQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";

export default function RunDetail() {
  const { id, runId } = useParams<{ id: string, runId: string }>();
  const simId = parseInt(id || "0", 10);
  const rId = parseInt(runId || "0", 10);

  const { data: simulation } = useGetSimulation(simId, {
    query: { enabled: !!simId, queryKey: getGetSimulationQueryKey(simId) }
  });

  const { data: run, isLoading } = useGetRun(simId, rId, {
    query: { enabled: !!simId && !!rId, queryKey: getGetRunQueryKey(simId, rId) }
  });

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!run) {
    return <div className="p-8 text-center text-muted-foreground">Run details not found.</div>;
  }

  const isPassed = run.status === 'passed';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Link href={`/simulations/${simId}`} className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm transition-colors">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Simulation
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            Run Report
            <Badge 
              variant={isPassed ? 'default' : 'destructive'} 
              className={isPassed ? 'bg-green-500/10 text-green-700 border-green-200' : ''}
            >
              {run.status.toUpperCase()}
            </Badge>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Simulation: <span className="font-medium text-foreground">{simulation?.name || `Sim #${simId}`}</span>
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
              {run.durationMs ? `${(run.durationMs / 1000).toFixed(2)}s` : '-'}
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Step Breakdown</CardTitle>
          <CardDescription>
            {run.passedSteps} of {run.totalSteps} steps completed successfully.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {run.stepResults.map((step) => {
            const stepPassed = step.status === 'passed';
            return (
              <div 
                key={step.stepOrder} 
                className={`border rounded-lg p-4 transition-colors ${stepPassed ? 'bg-card' : 'bg-red-500/5 border-red-200'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {stepPassed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    )}
                    <div>
                      <h4 className="font-medium flex items-center gap-2">
                        {step.stepOrder}. {step.stepName}
                        <Badge variant="outline" className="text-[10px] h-4 font-mono font-normal">
                          {(step.durationMs / 1000).toFixed(2)}s
                        </Badge>
                      </h4>
                      
                      {step.errorMessage && (
                        <div className="mt-2 bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                          <span className="font-mono text-xs">{step.errorMessage}</span>
                        </div>
                      )}
                      
                      {step.generatedData && Object.keys(step.generatedData).length > 0 && (
                        <div className="mt-3">
                          <div className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Generated Test Data</div>
                          <div className="bg-muted/50 rounded-md p-3 text-xs font-mono overflow-x-auto">
                            <pre>{JSON.stringify(step.generatedData, null, 2)}</pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
