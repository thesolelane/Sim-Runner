import { useState } from "react";
import { useLocation } from "wouter";
import { useScanUrl, useCreateSimulation, getListSimulationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ScanLine, Loader2, CheckCircle2, Plus, Trash2, GripVertical, Save } from "lucide-react";

type Step = {
  order: number;
  name: string;
  description: string;
  fields: string[];
  stepType: string;
};

export default function ScannerPage() {
  const [url, setUrl] = useState("");
  const [appName, setAppName] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [scanned, setScanned] = useState(false);
  const [simName, setSimName] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const scanMutation = useScanUrl();
  const createSimulation = useCreateSimulation();

  const handleScan = () => {
    if (!url.trim() || !appName.trim()) {
      toast({ title: "Required", description: "Please enter both an app name and URL.", variant: "destructive" });
      return;
    }
    scanMutation.mutate(
      { data: { url: url.trim(), appName: appName.trim() } },
      {
        onSuccess: (result) => {
          setSteps(result.detectedSteps as Step[]);
          setSimName(`${result.appName} Onboarding Sim`);
          setScanned(true);
          toast({
            title: "Scan Complete",
            description: `Detected ${result.detectedSteps.length} steps with ${result.confidence} confidence.`,
          });
        },
        onError: () => {
          toast({ title: "Scan Failed", description: "Could not reach the URL. Check it and try again.", variant: "destructive" });
        },
      }
    );
  };

  const updateStep = (idx: number, field: keyof Step, value: string) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
  };

  const removeStep = (idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })));
  };

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        order: prev.length + 1,
        name: "New Step",
        description: "Describe what happens in this step",
        fields: [],
        stepType: "form",
      },
    ]);
  };

  const handleSave = () => {
    if (!simName.trim()) {
      toast({ title: "Required", description: "Please give this simulation a name.", variant: "destructive" });
      return;
    }
    createSimulation.mutate(
      {
        data: {
          name: simName.trim(),
          appName: appName.trim(),
          appUrl: url.trim(),
          appType: "Web App",
          steps,
        },
      },
      {
        onSuccess: (sim) => {
          queryClient.invalidateQueries({ queryKey: getListSimulationsQueryKey() });
          toast({ title: "Simulation Saved", description: `"${sim.name}" is ready to run.` });
          setLocation(`/simulations/${sim.id}`);
        },
        onError: () => {
          toast({ title: "Save Failed", description: "Could not create the simulation.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">URL Scanner</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Paste any app or website URL to auto-detect its onboarding flow, then edit and save as a simulation.
        </p>
      </div>

      {/* Step 1: Scan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScanLine className="h-4 w-4 text-primary" />
            Step 1 — Scan a URL
          </CardTitle>
          <CardDescription>The scanner will fetch the page and detect onboarding patterns.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="app-name">App / Website Name</Label>
              <Input
                id="app-name"
                placeholder="e.g. Slack"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                data-testid="input-app-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scan-url">URL</Label>
              <Input
                id="scan-url"
                placeholder="https://example.com/signup"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                data-testid="input-scan-url"
              />
            </div>
          </div>
          <Button
            onClick={handleScan}
            disabled={scanMutation.isPending}
            data-testid="button-scan"
          >
            {scanMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ScanLine className="mr-2 h-4 w-4" />
            )}
            {scanMutation.isPending ? "Scanning..." : "Scan URL"}
          </Button>
        </CardContent>
      </Card>

      {/* Step 2: Confirm flow */}
      {scanned && steps.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Step 2 — Confirm the Flow
                </CardTitle>
                <CardDescription className="mt-1">
                  Edit, reorder, or remove any steps before saving.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                {steps.length} steps detected
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30 group"
                data-testid={`step-card-${idx}`}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground mt-2.5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">{step.order}.</span>
                    <Input
                      value={step.name}
                      onChange={(e) => updateStep(idx, "name", e.target.value)}
                      className="h-7 text-sm font-medium"
                      data-testid={`input-step-name-${idx}`}
                    />
                    <Badge variant="secondary" className="text-xs shrink-0">{step.stepType}</Badge>
                  </div>
                  <Input
                    value={step.description}
                    onChange={(e) => updateStep(idx, "description", e.target.value)}
                    className="h-7 text-xs text-muted-foreground"
                    data-testid={`input-step-desc-${idx}`}
                  />
                  {step.fields.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {step.fields.map((f) => (
                        <span key={f} className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive shrink-0"
                  onClick={() => removeStep(idx)}
                  data-testid={`button-remove-step-${idx}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addStep} className="w-full" data-testid="button-add-step">
              <Plus className="mr-2 h-3.5 w-3.5" />
              Add Step
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Save */}
      {scanned && steps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Save className="h-4 w-4 text-primary" />
              Step 3 — Save as Simulation
            </CardTitle>
            <CardDescription>Give this simulation a name and save it to run at any time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Separator />
            <div className="space-y-1.5">
              <Label htmlFor="sim-name">Simulation Name</Label>
              <Input
                id="sim-name"
                value={simName}
                onChange={(e) => setSimName(e.target.value)}
                placeholder="e.g. Slack Workspace Onboarding"
                data-testid="input-sim-name"
              />
            </div>
            <Button
              onClick={handleSave}
              disabled={createSimulation.isPending}
              className="w-full"
              data-testid="button-save-simulation"
            >
              {createSimulation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {createSimulation.isPending ? "Saving..." : "Save Simulation"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
