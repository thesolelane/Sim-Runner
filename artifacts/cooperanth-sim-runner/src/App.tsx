import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Layout from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import SimulationsPage from "@/pages/simulations/index";
import NewSimulation from "@/pages/simulations/new";
import SimulationDetail from "@/pages/simulations/detail";
import RunDetail from "@/pages/runs/detail";
import ReportsPage from "@/pages/reports";
import ScannerPage from "@/pages/scanner";
import QuantumScannerPage from "@/pages/quantum-scanner";
import StoreReadinessPage from "@/pages/store-readiness";
import SettingsPage from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/simulations" component={SimulationsPage} />
        <Route path="/simulations/new" component={NewSimulation} />
        <Route path="/simulations/:id" component={SimulationDetail} />
        <Route path="/simulations/:id/runs/:runId" component={RunDetail} />
        <Route path="/reports" component={ReportsPage} />
        <Route path="/scanner" component={ScannerPage} />
        <Route path="/quantum-scanner" component={QuantumScannerPage} />
        <Route path="/store-readiness" component={StoreReadinessPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
