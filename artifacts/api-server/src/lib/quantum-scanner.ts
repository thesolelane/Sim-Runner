import * as tls from "tls";
import { logger } from "./logger";

export type QuantumSeverity = "info" | "warning" | "critical";

export interface QuantumFinding {
  field: string;
  detectedValue: string;
  severity: QuantumSeverity;
  explanation: string;
}

export interface QuantumScanResult {
  quantumSafe: boolean;
  tlsVersion: string | null;
  keyExchange: string | null;
  cipherSuite: string | null;
  certSignatureAlgorithm: string | null;
  findings: QuantumFinding[];
  scannedAt: string;
  error: string | null;
}

const POST_QUANTUM_KEY_EXCHANGES = [
  "x25519kyber768",
  "x25519mlkem768",
  "mlkem",
  "kyber",
  "frodo",
  "bike",
  "hqc",
  "ntru",
];

const POST_QUANTUM_SIG_ALGS = [
  "ml-dsa",
  "mldsa",
  "falcon",
  "sphincs",
  "dilithium",
  "slh-dsa",
  "slhdsa",
  "lms",
  "xmss",
];

function isPostQuantumKeyExchange(kex: string): boolean {
  const lower = kex.toLowerCase().replace(/[-_\s]/g, "");
  return POST_QUANTUM_KEY_EXCHANGES.some((pq) => lower.includes(pq.replace(/-/g, "")));
}

function isPostQuantumSigAlg(sigAlg: string): boolean {
  const lower = sigAlg.toLowerCase().replace(/[-_\s]/g, "");
  return POST_QUANTUM_SIG_ALGS.some((pq) => lower.includes(pq.replace(/-/g, "")));
}

function isTls13CipherSuite(name: string): boolean {
  return name.startsWith("TLS_AES_") || name.startsWith("TLS_CHACHA20_") || name.startsWith("TLS_AES128_");
}

function extractKeyExchangeFromCipher(cipher: tls.CipherNameAndProtocol, tlsVersion: string | null): string {
  const name = cipher.name ?? "";
  if (isTls13CipherSuite(name) || tlsVersion === "TLSv1.3") {
    return "ECDHE (TLS 1.3)";
  }
  if (name.includes("ECDHE")) return "ECDHE";
  if (name.includes("DHE") || name.includes("EDH")) return "DHE";
  if (name.includes("RSA")) return "RSA";
  if (name.includes("ECDH")) return "ECDH";
  if (name.includes("DH")) return "DH";
  return "Unknown";
}

function keyExchangeFromEphemeralKey(
  ephemeralKey: { type: string; name?: string; size?: number } | null,
): string | null {
  if (!ephemeralKey) return null;
  const { type, name } = ephemeralKey;
  if (type === "ECDH" && name) {
    const lower = name.toLowerCase().replace(/[-_]/g, "");
    if (lower.includes("x25519kyber") || lower.includes("kyber") || lower.includes("mlkem")) {
      return name;
    }
    return `ECDHE-${name}`;
  }
  if (type === "DH") return "DHE";
  if (type === "RSA") return "RSA";
  return name ?? type ?? null;
}

function getRsaKeyBits(sigAlg: string): number | null {
  const m = sigAlg.match(/rsa[^a-z]*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

function classifySigAlg(sigAlg: string): { label: string; quantum: boolean; shortKey: boolean } {
  const lower = sigAlg.toLowerCase();
  if (isPostQuantumSigAlg(sigAlg)) {
    return { label: sigAlg, quantum: true, shortKey: false };
  }
  const bits = getRsaKeyBits(lower);
  if (lower.includes("rsa")) {
    return {
      label: sigAlg,
      quantum: false,
      shortKey: bits !== null && bits < 2048,
    };
  }
  if (lower.includes("ecdsa") || lower.includes("ec")) {
    return { label: sigAlg, quantum: false, shortKey: false };
  }
  return { label: sigAlg, quantum: false, shortKey: false };
}

export async function scanQuantumSecurity(targetUrl: string): Promise<QuantumScanResult> {
  const scannedAt = new Date().toISOString();

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return {
      quantumSafe: false,
      tlsVersion: null,
      keyExchange: null,
      cipherSuite: null,
      certSignatureAlgorithm: null,
      findings: [
        {
          field: "URL",
          detectedValue: targetUrl,
          severity: "critical",
          explanation: "Could not parse the target URL.",
        },
      ],
      scannedAt,
      error: "Invalid URL",
    };
  }

  if (parsed.protocol === "http:") {
    return {
      quantumSafe: false,
      tlsVersion: null,
      keyExchange: null,
      cipherSuite: null,
      certSignatureAlgorithm: null,
      findings: [
        {
          field: "TLS",
          detectedValue: "None (HTTP)",
          severity: "critical",
          explanation:
            "No TLS — all traffic is unencrypted. A quantum computer (or any attacker) can read all data in transit. Migrate to HTTPS immediately.",
        },
      ],
      scannedAt,
      error: null,
    };
  }

  if (parsed.protocol !== "https:") {
    return {
      quantumSafe: false,
      tlsVersion: null,
      keyExchange: null,
      cipherSuite: null,
      certSignatureAlgorithm: null,
      findings: [
        {
          field: "Protocol",
          detectedValue: parsed.protocol,
          severity: "critical",
          explanation: "Non-HTTP(S) URL — quantum scan only applies to HTTPS targets.",
        },
      ],
      scannedAt,
      error: "Non-HTTPS URL",
    };
  }

  const hostname = parsed.hostname;
  const port = parseInt(parsed.port || "443", 10);

  return new Promise((resolve) => {
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      socket.destroy();
      resolve({
        quantumSafe: false,
        tlsVersion: null,
        keyExchange: null,
        cipherSuite: null,
        certSignatureAlgorithm: null,
        findings: [],
        scannedAt,
        error: "Connection timeout",
      });
    }, 5000);

    const socket = tls.connect(
      {
        host: hostname,
        port,
        servername: hostname,
        rejectUnauthorized: false,
      },
      () => {
        clearTimeout(timeout);

        try {
          const tlsVersion = socket.getProtocol() ?? null;
          const cipher = socket.getCipher();
          const cipherSuite = cipher?.name ?? null;
          const cert = socket.getPeerCertificate();

          const detailedCert = socket.getPeerCertificate(true) as unknown as Record<string, unknown>;
          const certSigAlgRaw = detailedCert?.sigalg as string | undefined ?? null;
          const certSigAlg = typeof certSigAlgRaw === "string" ? certSigAlgRaw : null;
          const certBits = typeof detailedCert?.bits === "number" ? detailedCert.bits as number : null;
          const certPubkeyAlgo = typeof (detailedCert?.asn1Curve ?? detailedCert?.nid) === "string"
            ? "EC"
            : null;

          const ephemeralKeyRaw = socket.getEphemeralKeyInfo() as
            | { type: string; name?: string; size?: number }
            | null
            | Record<string, never>;
          const ephemeralKey =
            ephemeralKeyRaw && typeof ephemeralKeyRaw === "object" && "type" in ephemeralKeyRaw
              ? (ephemeralKeyRaw as { type: string; name?: string; size?: number })
              : null;

          const keyExchange =
            keyExchangeFromEphemeralKey(ephemeralKey) ?? extractKeyExchangeFromCipher(cipher, tlsVersion);

          socket.destroy();

          const findings: QuantumFinding[] = [];

          if (tlsVersion && tlsVersion === "TLSv1.2") {
            findings.push({
              field: "TLS Version",
              detectedValue: tlsVersion,
              severity: "info",
              explanation:
                "TLS 1.2 is still secure today but TLS 1.3 is preferred — it has a shorter handshake, forward secrecy by default, and better support for post-quantum hybrid extensions.",
            });
          }

          const pqKex = isPostQuantumKeyExchange(keyExchange);
          if (!pqKex) {
            if (keyExchange.toUpperCase().startsWith("RSA")) {
              findings.push({
                field: "Key Exchange",
                detectedValue: keyExchange,
                severity: "critical",
                explanation:
                  "RSA key exchange is broken by a sufficiently large quantum computer (Shor's algorithm). Past traffic recorded today can be decrypted later ('harvest now, decrypt later'). Migrate to ECDHE or a post-quantum hybrid like X25519Kyber768.",
              });
            } else {
              findings.push({
                field: "Key Exchange",
                detectedValue: keyExchange,
                severity: "warning",
                explanation:
                  "Classical ECDHE is not broken by today's quantum computers but provides no post-quantum protection. Consider a PQC hybrid like X25519Kyber768 (Chrome/Edge already negotiate it if the server supports it).",
              });
            }
          }

          if (certSigAlg) {
            const { quantum: pqSig } = classifySigAlg(certSigAlg);
            if (!pqSig) {
              const isEcc = certSigAlg.toLowerCase().includes("ecdsa") || certPubkeyAlgo === "EC";
              const shortRsaKey = !isEcc && certBits !== null && certBits < 2048;
              const shortEccKey = isEcc && certBits !== null && certBits < 224;

              if (shortRsaKey) {
                const label = certBits !== null ? `${certSigAlg} (${certBits}-bit key)` : certSigAlg;
                findings.push({
                  field: "Certificate Signature",
                  detectedValue: label,
                  severity: "critical",
                  explanation:
                    `Short RSA-${certBits ?? "?"} key on the certificate — breakable by a large quantum computer faster than RSA-2048+. Reissue with at least RSA-3072 or migrate to ECDSA P-256.`,
                });
              } else if (shortEccKey) {
                const label = certBits !== null ? `${certSigAlg} (${certBits}-bit key)` : certSigAlg;
                findings.push({
                  field: "Certificate Signature",
                  detectedValue: label,
                  severity: "critical",
                  explanation:
                    `Short ECC key (${certBits ?? "?"}-bit) on the certificate — below the recommended 256-bit minimum for elliptic curves. Reissue with P-256 or stronger.`,
                });
              }
            }
          }

          const hasCritical = findings.some((f) => f.severity === "critical");
          const quantumSafe = !hasCritical && pqKex;

          resolve({
            quantumSafe,
            tlsVersion,
            keyExchange,
            cipherSuite,
            certSignatureAlgorithm: certSigAlg,
            findings,
            scannedAt,
            error: null,
          });
        } catch (err) {
          socket.destroy();
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn({ err, hostname }, "Quantum scanner: error reading TLS session data");
          resolve({
            quantumSafe: false,
            tlsVersion: null,
            keyExchange: null,
            cipherSuite: null,
            certSignatureAlgorithm: null,
            findings: [],
            scannedAt,
            error: `TLS session read error: ${msg}`,
          });
        }
      },
    );

    socket.on("error", (err) => {
      if (timedOut) return;
      clearTimeout(timeout);
      socket.destroy();
      logger.warn({ err, hostname }, "Quantum scanner: TLS connection error");
      resolve({
        quantumSafe: false,
        tlsVersion: null,
        keyExchange: null,
        cipherSuite: null,
        certSignatureAlgorithm: null,
        findings: [],
        scannedAt,
        error: err.message,
      });
    });
  });
}
