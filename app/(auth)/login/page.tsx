import { Suspense } from "react";
import LoginPage from "./login-form";

export default function LoginRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-land text-sm text-land-muted">
          Loading…
        </div>
      }
    >
      <LoginPage />
    </Suspense>
  );
}

