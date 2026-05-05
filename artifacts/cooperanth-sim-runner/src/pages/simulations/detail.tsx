import { useParams, Link } from "wouter";
import { 
  useGetSimulation, 
  useListRuns, 
  useCreateRun,
  getGetSimulationQueryKey,
  getListRunsQueryKey,
  getGetSimulationStatsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Activity, Clock, ArrowLeft, History } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

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

  const createRunMutation = useCreateRun();

  const handleRun = () => {
    createRunMutation.mutate(
      { id: simId },
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

  if (simLoading) {
    return <div className="p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></div>;
  }

  if (!simulation) {
    return <div className="p-8 text-center text-muted-foreground">Simulation not found.</div>;
  }

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
          <p className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
            <span>Target: <a href={simulation.appUrl} target="_blank" rel="noreferrer" className="underline hover:text-foreground">{simulation.appUrl}</a></span>
            <span>•</span>
            <Badge variant="outline">{simulation.appType}</Badge>
          </p>
        </div>
        <Button size="lg" onClick={handleRun} disabled={createRunMutation.isPending} className="font-semibold shadow-md hover:shadow-lg transition-all">
          {createRunMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5" />}
          Run Simulation
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
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
    </div>
  );
}
