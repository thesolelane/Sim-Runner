import { Link } from "wouter";
import { format } from "date-fns";
import { useGetSimulationStats, useListSimulations, getListRunsQueryKey } from "@workspace/api-client-react";
import { useQueries } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";

function statusIcon(status: string) {
  if (status === "passed") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-destructive" />;
  return <AlertCircle className="h-4 w-4 text-yellow-500" />;
}

export default function ReportsPage() {
  const { data: stats, isLoading: statsLoading } = useGetSimulationStats();
  const { data: simulations, isLoading: simsLoading } = useListSimulations();

  const runQueries = useQueries({
    queries: (simulations ?? []).map((sim) => ({
      queryKey: getListRunsQueryKey(sim.id),
      queryFn: async () => {
        const res = await fetch(`/api/simulations/${sim.id}/runs`);
        if (!res.ok) throw new Error("Failed to fetch runs");
        const data = await res.json();
        return { simId: sim.id, simName: sim.name, runs: data };
      },
      enabled: !!simulations?.length,
    })),
  });

  const allRuns = runQueries
    .flatMap((q) => {
      if (!q.data || !Array.isArray(q.data.runs)) return [];
      return (q.data.runs as Array<{
        id: number;
        status: string;
        totalSteps: number;
        passedSteps: number;
        failedSteps: number;
        durationMs: number | null;
        startedAt: string;
        completedAt: string | null;
      }>).map((run) => ({
        ...run,
        simId: q.data!.simId,
        simName: q.data!.simName,
      }));
    })
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  const isLoading = statsLoading || simsLoading || runQueries.some((q) => q.isLoading);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">Complete run history across all simulations.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          {
            label: "Total Runs",
            value: stats?.totalRuns ?? 0,
            icon: <Clock className="h-4 w-4 text-muted-foreground" />,
          },
          {
            label: "Pass Rate",
            value: `${(((stats?.passRate ?? 0)) * 100).toFixed(1)}%`,
            icon: <CheckCircle2 className="h-4 w-4 text-muted-foreground" />,
          },
          {
            label: "Avg Duration",
            value: stats?.avgDurationMs ? `${(stats.avgDurationMs / 1000).toFixed(2)}s` : "-",
            icon: <Clock className="h-4 w-4 text-muted-foreground" />,
          },
          {
            label: "Simulations",
            value: stats?.totalSimulations ?? 0,
            icon: <AlertCircle className="h-4 w-4 text-muted-foreground" />,
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              {stat.icon}
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stat.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run History</CardTitle>
          <CardDescription>All simulation runs, most recent first.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !allRuns.length ? (
            <div className="text-center py-16 border border-dashed rounded-lg bg-muted/20">
              <p className="text-sm text-muted-foreground">No runs yet. Run a simulation to see reports here.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Simulation</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Steps</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Duration</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Started</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {allRuns.map((run) => (
                    <tr key={`${run.simId}-${run.id}`} className="hover:bg-muted/30 transition-colors" data-testid={`row-run-${run.id}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {statusIcon(run.status)}
                          <Badge
                            variant={run.status === "passed" ? "default" : run.status === "failed" ? "destructive" : "secondary"}
                            className={`text-xs ${run.status === "passed" ? "bg-green-500/10 text-green-700 hover:bg-green-500/20" : ""}`}
                          >
                            {run.status}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/simulations/${run.simId}`} className="text-sm font-medium hover:underline">
                          {run.simName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono">
                        {run.passedSteps}/{run.totalSteps}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {format(new Date(run.startedAt), "MMM d, yyyy HH:mm")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/simulations/${run.simId}/runs/${run.id}`}>
                          <span className="text-sm text-primary hover:underline cursor-pointer">View</span>
                        </Link>
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
