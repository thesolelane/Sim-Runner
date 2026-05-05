import { APPS } from './config.js';
import { OwnerSimulator } from './engine.js';

const appName = process.argv[2] || 'traydbook';
const userType = process.argv[3] || 'contractor';
const headless = process.argv.includes('--headed') ? false : true;

const app = APPS[appName];
if (!app) {
  console.error(`❌ Unknown app: ${appName}`);
  console.log(`Available apps: ${Object.keys(APPS).join(', ')}`);
  process.exit(1);
}

const sim = new OwnerSimulator(app, { headless });
const result = await sim.run(userType);

process.exit(result.success ? 0 : 1);
