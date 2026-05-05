import { useState } from "react";
import { useLocation } from "wouter";
import { 
  useScanUrl, 
  useCreateSimulation, 
  getGetSimulationStatsQueryKey,
  getListSimulationsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, ArrowRight, Save, LayoutTemplate } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { DetectedStep, FlowStep } from "@workspace/api-client-react/src/generated/api.schemas";

export default function NewSimulation() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState(1);
  
  // Form State
  const [url, setUrl] = useState("");
  const [appName, setAppName] = useState("");
  const [simName, setSimName] = useState("");
  
  // Scan State
  const scanUrlMutation = useScanUrl();
  const [detectedSteps, setDetectedSteps] = useState<DetectedStep[]>([]);
  const [confidence, setConfidence] = useState("");

  const createSimMutation = useCreateSimulation();

  const handleScan = () => {
    if (!url || !appName) {
      toast({ title: "Missing fields", description: "Please provide both app name and URL.", variant: "destructive" });
      return;
    }
    
    scanUrlMutation.mutate(
      { data: { url, appName } },
      {
        onSuccess: (data) => {
          setDetectedSteps(data.detectedSteps || []);
          setConfidence(data.confidence);
          if (!simName) setSimName(`${appName} Onboarding`);
          setStep(2);
        },
        onError: () => {
          toast({ title: "Scan Failed", description: "Could not scan the provided URL.", variant: "destructive" });
        }
      }
    );
  };

  const handleSave = () => {
    if (!simName) {
      toast({ title: "Missing fields", description: "Simulation name is required.", variant: "destructive" });
      return;
    }

    const payloadSteps: FlowStep[] = detectedSteps.map(s => ({
      order: s.order,
      name: s.name,
      description: s.description,
      fields: s.fields,
      stepType: s.stepType
    }));

    createSimMutation.mutate(
      {
        data: {
          name: simName,
          appName,
          appUrl: url,
          appType: "web",
          steps: payloadSteps
        }
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
        }
      }
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Create Simulation</h1>
        <p className="text-muted-foreground mt-1">Scan a target app and build a simulation flow.</p>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${step >= 1 ? 'border-primary bg-primary text-primary-foreground' : 'border-muted text-muted-foreground'}`}>1</div>
        <div className={`h-1 flex-1 ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
        <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${step >= 2 ? 'border-primary bg-primary text-primary-foreground' : 'border-muted text-muted-foreground'}`}>2</div>
        <div className={`h-1 flex-1 ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
        <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${step >= 3 ? 'border-primary bg-primary text-primary-foreground' : 'border-muted text-muted-foreground'}`}>3</div>
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
              {scanUrlMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Scan Application
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 2 && (
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader>
            <CardTitle>Detected Flow</CardTitle>
            <CardDescription>We found {detectedSteps.length} steps with {confidence} confidence.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4 border-l-2 border-primary/20 ml-3 pl-6 relative">
              {detectedSteps.map((s, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-[35px] top-1 h-4 w-4 rounded-full bg-primary ring-4 ring-background" />
                  <Card>
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0 border-b bg-muted/10">
                      <div className="font-semibold text-sm">Step {s.order}: {s.name}</div>
                      <Badge variant="outline">{s.stepType}</Badge>
                    </CardHeader>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground mb-3">{s.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {s.fields.map(f => (
                          <Badge key={f} variant="secondary" className="text-xs font-mono">{f}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="justify-between border-t p-4 bg-muted/20">
            <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)}>
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
                <li>Targeting: {appName} ({url})</li>
                <li>Steps to simulate: {detectedSteps.length}</li>
              </ul>
            </div>
          </CardContent>
          <CardFooter className="justify-between border-t p-4 bg-muted/20">
            <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={handleSave} disabled={createSimMutation.isPending}>
              {createSimMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Simulation
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
