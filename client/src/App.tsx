import { useEffect, useState } from "react";

type HealthState = "checking" | "ok" | "unreachable";

export function App() {
  const [health, setHealth] = useState<HealthState>("checking");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => setHealth(res.ok ? "ok" : "unreachable"))
      .catch(() => setHealth("unreachable"));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>mazeforge</h1>
      <p>Schema-driven low-code platform. Placeholder page.</p>
      <p>
        API status: <strong>{health}</strong>
      </p>
    </main>
  );
}
