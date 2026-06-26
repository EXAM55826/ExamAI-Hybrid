import { Switch, Route, Router as WouterRouter } from "wouter";
import Dashboard from "@/pages/Dashboard";
import ExamGenerator from "@/pages/ExamGenerator";
import PlagiarismDetector from "@/pages/PlagiarismDetector";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/exam" component={ExamGenerator} />
      <Route path="/detect" component={PlagiarismDetector} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <div className="dark" style={{ background: "#000", minHeight: "100vh" }}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
    </div>
  );
}

export default App;
