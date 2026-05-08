import { useState } from "react";
import { useScanUrl } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Loader2, Link as LinkIcon } from "lucide-react";
import { QuantumSecurityCard } from "@/components/quantum-security-card";
import type { QuantumScanResult } from "@workspace/api-client-react";

export default function QuantumScannerPage() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<QuantumScanResult | null>(null);
  const [scanned, setScanned] = useState(false);
  const { toast } = useToast();

  const scanMutation = useScanUrl();

  const handleScan = () => {
    const trimmed = url.trim();
    if (!trimmed) {
      toast({
        title: "URL required",
        description: "Please enter a URL to scan.",
        variant: "destructive",
      });
      return;
    }

    let normalised = trimmed;
    if (!/^https?:\/\//i.test(normalised)) {
      normalised = `https://${normalised}`;
    }

    setScanned(false);
    setResult(null);

    scanMutation.mutate(
      { data: { url: normalised, appName: "ad-hoc", scanType: "web", pqcEnabled: true } },
      {
        onSuccess: (data) => {
          const qr = data.quantumScanResult ?? null;
          setResult(qr);
          setScanned(true);
          if (qr && !qr.error) {
            toast({
              title: "Scan complete",
              description: qr.quantumSafe
                ? "This host supports post-quantum key exchange."
                : "Quantum vulnerabilities were found — see the results below.",
            });
          } else {
            toast({
              title: "Scan finished",
              description: qr?.error
                ? `Scanner could not reach the host: ${qr.error}`
                : "No quantum scan result returned.",
              variant: qr?.error ? "destructive" : "default",
            });
          }
        },
        onError: () => {
          toast({
            title: "Scan failed",
            description: "Could not reach the server. Check the URL and try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleScan();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-purple-600" />
          Quantum Security Scanner
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Inspect any URL's TLS configuration for post-quantum readiness without creating a
          simulation. Passive handshake inspection — no traffic intercepted.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LinkIcon className="h-4 w-4 text-primary" />
            Scan a URL
          </CardTitle>
          <CardDescription>
            Enter any HTTPS URL. The scanner will connect to the host and inspect its TLS handshake.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="quantum-url">URL</Label>
            <Input
              id="quantum-url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              data-testid="input-quantum-url"
            />
          </div>
          <Button
            onClick={handleScan}
            disabled={scanMutation.isPending}
            data-testid="button-quantum-scan"
          >
            {scanMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldAlert className="mr-2 h-4 w-4" />
            )}
            {scanMutation.isPending ? "Scanning…" : "Scan"}
          </Button>
        </CardContent>
      </Card>

      {scanned && (
        <QuantumSecurityCard result={result} pqcEnabled={true} adHoc={true} />
      )}
    </div>
  );
}
