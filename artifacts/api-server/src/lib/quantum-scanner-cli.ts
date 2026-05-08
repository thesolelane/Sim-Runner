/**
 * Thin CLI wrapper for scanQuantumSecurity — used by the test-quantum-scanner
 * validation script in @workspace/scripts.
 *
 * Usage:
 *   tsx src/lib/quantum-scanner-cli.ts <url>
 *
 * Outputs a single JSON line with the QuantumScanResult, then exits 0.
 * Exits 1 if no URL is provided.
 */

import { scanQuantumSecurity } from "./quantum-scanner.js";

const url = process.argv[2];

if (!url) {
  process.stderr.write("Usage: quantum-scanner-cli <url>\n");
  process.exit(1);
}

const result = await scanQuantumSecurity(url);
process.stdout.write(JSON.stringify(result) + "\n");
