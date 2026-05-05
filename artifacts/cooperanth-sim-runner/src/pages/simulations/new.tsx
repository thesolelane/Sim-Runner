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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type {
  DetectedStep,
  FlowStep,
} from "@workspace/api-client-react";

const ACTION_TYPES = ["fill", "click", "navigate", "waitForText", "selectOption", "consent", "confirmation"];

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

export default function NewSimulation() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);

  const [url, setUrl] = useState("");
  const [appName, setAppName] = useState("");
  const [simName, setSimName] = useState("");

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
        <p className="text-muted-foreground mt-1">Scan a target app and build a simulation flow.</p>
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
            <CardDescription>Enter the details of the app you want to test.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="appName">App Name</Label>
              <Input
                id="appName"
                placeholder="e.g. Acme Corp"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">Start URL</Label>
              <Input
                id="url"
                placeholder="https://app.example.com/signup"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="justify-end border-t p-4 bg-muted/20">
            <Button onClick={handleScan} disabled={scanUrlMutation.isPending}>
              {scanUrlMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              {scanUrlMutation.isPending ? "Scanning with Playwright…" : "Scan Application"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 2 && (
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
