import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";
import type { QuantumScanResult } from "@workspace/api-client-react";

type QuantumSeverity = "info" | "warning" | "critical";

function severityConfig(severity: QuantumSeverity) {
  if (severity === "critical") {
    return { chip: "bg-red-100 text-red-700 border-red-200", label: "Critical" };
  }
  if (severity === "warning") {
    return { chip: "bg-yellow-100 text-yellow-700 border-yellow-200", label: "Warning" };
  }
  return { chip: "bg-blue-100 text-blue-700 border-blue-200", label: "Info" };
}

export function QuantumSecurityCard({
  result,
  pqcEnabled,
  adHoc = false,
}: {
  result: QuantumScanResult | null | undefined;
  pqcEnabled?: boolean;
  adHoc?: boolean;
}) {
  const [explainerOpen, setExplainerOpen] = useState(false);

  if (result === undefined || result === null) {
    let message: string;
    if (adHoc) {
      message = "No quantum scan result returned. The server may not have been reachable.";
    } else if (pqcEnabled === false) {
      message = "Post-quantum scanning is not enabled for this simulation. Turn it on in the simulation's Settings tab.";
    } else {
      message = "Scan unavailable — this run was completed before quantum security scanning was introduced.";
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-muted-foreground" />
            Quantum Security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    );
  }

  if (result.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-muted-foreground" />
            Quantum Security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {adHoc
              ? `Could not reach the host — ${result.error}`
              : `Scan unavailable — the scanner could not reach the target host (${result.error}).`}
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasNoTls = result.findings.some(
    (f) => f.field === "TLS" && f.detectedValue.includes("None"),
  );

  let overallBadge: React.ReactNode;
  if (result.quantumSafe) {
    overallBadge = (
      <Badge className="bg-green-100 text-green-700 border-green-200 gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5" />
        Quantum-Safe
      </Badge>
    );
  } else if (hasNoTls) {
    overallBadge = (
      <Badge className="bg-red-100 text-red-700 border-red-200 gap-1.5">
        <ShieldX className="h-3.5 w-3.5" />
        No TLS
      </Badge>
    );
  } else {
    overallBadge = (
      <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 gap-1.5">
        <ShieldAlert className="h-3.5 w-3.5" />
        At Risk
      </Badge>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-purple-600" />
            Quantum Security
          </CardTitle>
          <CardDescription className="mt-1 text-xs">
            Passive TLS handshake inspection — no traffic intercepted.
            {result.scannedAt && (
              <span className="ml-1 text-muted-foreground">
                Scanned {format(new Date(result.scannedAt), "MMM d, HH:mm:ss")}
              </span>
            )}
          </CardDescription>
        </div>
        <div className="shrink-0">{overallBadge}</div>
      </CardHeader>

      <CardContent className="space-y-4">
        {result.error && result.findings.length === 0 && (
          <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 font-mono">
            Scan error: {result.error}
          </div>
        )}

        {(result.tlsVersion ||
          result.httpVersion ||
          result.keyExchange ||
          result.cipherSuite ||
          result.certSignatureAlgorithm ||
          result.serverSigAlgs) && (
          <div className="grid grid-cols-2 gap-3 text-xs">
            {result.tlsVersion && (
              <div className="space-y-0.5">
                <div className="text-muted-foreground uppercase tracking-wider font-medium">
                  TLS Version
                </div>
                <div className="font-mono font-medium">{result.tlsVersion}</div>
              </div>
            )}
            {result.httpVersion && (
              <div className="space-y-0.5">
                <div className="text-muted-foreground uppercase tracking-wider font-medium">
                  HTTP Version
                </div>
                <div className="font-mono font-medium">{result.httpVersion}</div>
              </div>
            )}
            {result.keyExchange && (
              <div className="space-y-0.5">
                <div className="text-muted-foreground uppercase tracking-wider font-medium">
                  Key Exchange
                </div>
                <div className="font-mono font-medium">{result.keyExchange}</div>
              </div>
            )}
            {result.cipherSuite && (
              <div className="space-y-0.5 col-span-2">
                <div className="text-muted-foreground uppercase tracking-wider font-medium">
                  Cipher Suite
                </div>
                <div className="font-mono font-medium break-all">{result.cipherSuite}</div>
              </div>
            )}
            {result.certSignatureAlgorithm && (
              <div className="space-y-0.5 col-span-2">
                <div className="text-muted-foreground uppercase tracking-wider font-medium">
                  Certificate Signature
                </div>
                <div className="font-mono font-medium">{result.certSignatureAlgorithm}</div>
              </div>
            )}
            {result.serverSigAlgs && (
              <div className="space-y-0.5 col-span-2">
                <div className="text-muted-foreground uppercase tracking-wider font-medium">
                  Server Signature Algorithms
                </div>
                <div className="font-mono text-[10px] leading-relaxed text-muted-foreground break-all">
                  {result.serverSigAlgs}
                </div>
              </div>
            )}
          </div>
        )}

        {result.findings.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Findings
            </div>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-xs">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Field</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                      Detected Value
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                      Severity
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.findings.map((finding, i) => {
                    const { chip, label } = severityConfig(finding.severity);
                    return (
                      <tr key={i} className="border-t hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2.5 font-medium text-xs whitespace-nowrap">
                          {finding.field}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs">{finding.detectedValue}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant="outline" className={`text-[10px] h-5 ${chip}`}>
                            {label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-2">
              {result.findings.map((finding, i) => (
                <div
                  key={i}
                  className="text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2 leading-relaxed"
                >
                  <span className="font-medium text-foreground">{finding.field}: </span>
                  {finding.explanation}
                </div>
              ))}
            </div>
          </div>
        )}

        {result.findings.length === 0 && !result.error && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-md px-3 py-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            No quantum-vulnerable configurations detected.
          </div>
        )}

        <div className="border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setExplainerOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors text-left"
          >
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              What does this mean?
            </span>
            {explainerOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {explainerOpen && (
            <div className="px-4 pb-4 pt-1 text-xs text-muted-foreground space-y-3 border-t bg-muted/10 leading-relaxed">
              <div>
                <p className="font-semibold text-foreground mb-1">Harvest now, decrypt later</p>
                <p>
                  Nation-state adversaries can capture your encrypted traffic today and store it.
                  Once a cryptographically-relevant quantum computer exists, they can retroactively
                  decrypt it using Shor's algorithm — breaking RSA and ECC key exchange. Sensitive
                  data exchanged now (authentication tokens, personal data, API keys) could be
                  exposed years from now.
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">ML-KEM and post-quantum hybrids</p>
                <p>
                  NIST has standardized ML-KEM (formerly Kyber, FIPS 203) as the post-quantum key
                  encapsulation mechanism. Major browsers negotiate{" "}
                  <span className="font-mono bg-muted px-1 rounded">X25519Kyber768</span> (a hybrid
                  of classical X25519 and Kyber768) when the server supports it — providing
                  protection against both classical and quantum attackers simultaneously.
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">
                  ML-DSA for certificate signatures
                </p>
                <p>
                  NIST also standardized ML-DSA (FIPS 204) to replace RSA/ECDSA for digital
                  signatures. CA ecosystem migration is in progress — most certificates today still
                  use classical algorithms.
                </p>
              </div>
              <div>
                <a
                  href="https://csrc.nist.gov/projects/post-quantum-cryptography"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline font-medium"
                >
                  NIST Post-Quantum Cryptography standards →
                </a>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
