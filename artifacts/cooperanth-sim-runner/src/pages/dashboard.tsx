import { Link } from "wouter";
import { format } from "date-fns";
import cronstrue from "cronstrue";
import { 
  useGetSimulationStats, 
  useListSimulations 
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Activity, CheckCircle2, XCircle, Clock, AlertTriangle, Radio, Wifi } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

function getHealthColor(lastRunStatus: string | null, alertThreshold: number | null, recentPassRate: number | null) {
  if (!lastRunStatus || recentPassRate === null) return "gray";
  const threshold = (alertThreshold ?? 80) / 100;
  if (recentPassRate >= threshold) return "green";
  if (recentPassRate >= threshold * 0.8) return "amber";
  return "red";
}

function HealthDot({ color }: { color: string }) {
  const colorMap: Record<string, string> = {
    green: "bg-green-500",
    amber: "bg-amber-400",
    red: "bg-red-500",
    gray: "bg-muted-foreground/30",
  };
  return (
    <span className={`inline-block h-2.5 w-2.5 rounded-full ${colorMap[color] ?? colorMap.gray}`} />
  );
}

function cronLabel(expr: string) {
  try {
    return cronstrue.toString(expr, { verbose: false });
  } catch {
    return expr;
  }
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetSimulationStats();
  const { data: simulations, isLoading: simsLoading } = useListSimulations();

  const monitoredSims = simulations?.filter(s => s.schedule) ?? [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Simulations Overview</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and run your onboarding simulations.
          </p>
        </div>
        <Link href="/simulations/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Simulation
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalRuns || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Global Pass Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{((stats?.passRate || 0) * 100).toFixed(1)}%</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {stats?.avgDurationMs ? (stats.avgDurationMs / 1000).toFixed(2) + "s" : "-"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5" />
              Monitoring
            </CardTitle>
            <CardDescription>Scheduled simulations and their health status.</CardDescription>
          </CardHeader>
          <CardContent>
            {simsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : monitoredSims.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No simulations have a schedule yet. Open a simulation's Settings tab to configure one.
              </p>
            ) : (
              <div className="rounded-md border">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Simulation</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Schedule</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Health</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Last Alert</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Alert Threshold</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {monitoredSims.map((sim) => {
                      const color = getHealthColor(sim.lastRunStatus, sim.alertThreshold, sim.recentPassRate);
                      return (
                        <tr key={sim.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Link href={`/simulations/${sim.id}`} className="font-medium hover:underline">
                              {sim.name}
                            </Link>
                            <div className="text-xs text-muted-foreground">{sim.appName}</div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-2">
                              <Wifi className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span>{cronLabel(sim.schedule!)}</span>
                            </div>
                            {sim.nextRunAt && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Next: {format(new Date(sim.nextRunAt), "MMM d, HH:mm")}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <HealthDot color={color} />
                              <span className="text-sm capitalize">
                                {sim.lastRunStatus ?? "Never run"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                            {sim.lastAlertedAt
                              ? format(new Date(sim.lastAlertedAt), "MMM d, HH:mm")
                              : <span className="text-muted-foreground/50">—</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {sim.alertThreshold !== null && sim.alertThreshold !== undefined ? (
                              <Badge variant="outline" className="text-xs">
                                <AlertTriangle className="mr-1 h-3 w-3" />
                                &lt;{sim.alertThreshold}%
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground/50">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>All Simulations</CardTitle>
            <CardDescription>Your registered simulation flows.</CardDescription>
          </CardHeader>
          <CardContent>
            {simsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : !simulations?.length ? (
              <div className="text-center py-12 border border-dashed rounded-lg bg-muted/20">
                <p className="text-sm text-muted-foreground">No simulations created yet.</p>
                <Link href="/simulations/new">
                  <Button variant="outline" className="mt-4">Create your first</Button>
                </Link>
              </div>
            ) : (
              <div className="rounded-md border">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Target App</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Steps</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Last Run</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {simulations.map((sim) => (
                      <tr key={sim.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Link href={`/simulations/${sim.id}`} className="font-medium hover:underline">
                            {sim.name}
                          </Link>
                          {sim.schedule && (
                            <Badge variant="secondary" className="ml-2 text-xs">scheduled</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                          {sim.appName}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {sim.steps.length}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {sim.lastRunStatus ? (
                            <Badge variant={sim.lastRunStatus === "passed" ? "default" : sim.lastRunStatus === "failed" ? "destructive" : "secondary"} className={sim.lastRunStatus === "passed" ? "bg-green-500/10 text-green-700 hover:bg-green-500/20" : ""}>
                              {sim.lastRunStatus}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">Never</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <Link href={`/simulations/${sim.id}`}>
                            <Button variant="ghost" size="sm">View</Button>
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
    </div>
  );
}
