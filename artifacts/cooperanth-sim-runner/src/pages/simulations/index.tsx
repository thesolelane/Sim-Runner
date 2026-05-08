import { Link } from "wouter";
import { format } from "date-fns";
import { useListSimulations, useDeleteSimulation, getListSimulationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Play, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SimulationsPage() {
  const { data: simulations, isLoading } = useListSimulations();
  const deleteSimulation = useDeleteSimulation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    deleteSimulation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Deleted", description: `"${name}" has been removed.` });
          queryClient.invalidateQueries({ queryKey: getListSimulationsQueryKey() });
        },
        onError: () => {
          toast({ title: "Error", description: "Could not delete simulation.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Simulations</h1>
          <p className="text-muted-foreground text-sm mt-1">All registered onboarding flow simulations.</p>
        </div>
        <Link href="/simulations/new">
          <Button data-testid="button-new-simulation">
            <Plus className="mr-2 h-4 w-4" />
            New Simulation
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Simulations</CardTitle>
          <CardDescription>Click a simulation to view its steps and run history.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : !simulations?.length ? (
            <div className="text-center py-16 border border-dashed rounded-lg bg-muted/20">
              <p className="text-sm text-muted-foreground mb-4">No simulations yet. Create your first to get started.</p>
              <Link href="/simulations/new">
                <Button variant="outline">Create Simulation</Button>
              </Link>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Target</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Steps</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Runs</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Run</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Created</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {simulations.map((sim) => (
                    <tr key={sim.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-simulation-${sim.id}`}>
                      <td className="px-4 py-3">
                        <Link href={`/simulations/${sim.id}`} className="font-medium hover:underline text-sm">
                          {sim.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {sim.scanType === "blockchain" ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-muted-foreground">{sim.chainId}</span>
                            <span className="font-mono text-xs text-foreground max-w-[180px] truncate">{sim.targetAddress}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-muted-foreground">{sim.appName}</span>
                            <a href={sim.appUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{sim.steps.length}</td>
                      <td className="px-4 py-3 text-sm">{sim.totalRuns}</td>
                      <td className="px-4 py-3">
                        {sim.lastRunStatus ? (
                          <Badge
                            variant={sim.lastRunStatus === "passed" ? "default" : sim.lastRunStatus === "failed" ? "destructive" : "secondary"}
                            className={`text-xs ${sim.lastRunStatus === "passed" ? "bg-green-500/10 text-green-700 hover:bg-green-500/20" : ""}`}
                          >
                            {sim.lastRunStatus}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Never run</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {format(new Date(sim.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/simulations/${sim.id}`}>
                            <Button variant="ghost" size="sm" data-testid={`button-run-${sim.id}`}>
                              <Play className="h-3.5 w-3.5 mr-1" />
                              Open
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(sim.id, sim.name)}
                            disabled={deleteSimulation.isPending}
                            data-testid={`button-delete-${sim.id}`}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
