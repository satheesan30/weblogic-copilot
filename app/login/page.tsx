import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LoginPageProps {
  searchParams: Promise<{
    error?: string;
    redirect?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectPath = params.redirect || "/dashboard";
  const hasError = params.error === "invalid";
  const isRateLimited = params.error === "rate-limit";

  return (
    <main className="signal-field relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      <div className="relative w-full max-w-md">
        <Link className="mb-8 block text-center" href="/">
          <p className="font-display text-3xl font-semibold tracking-tight text-ink">Agentci AI</p>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">Atlas desk access</p>
        </Link>

        <div className="desk-panel p-6 sm:p-7">
          <h1 className="font-display text-2xl font-semibold text-ink">Local login</h1>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            Sign in to use chat, live logs, uploads, library, and settings on this machine.
          </p>

          <form action="/api/auth/login" className="mt-6 space-y-4" method="post">
            <input name="redirect" type="hidden" value={redirectPath} />
            <div className="space-y-2">
              <label className="mono-label" htmlFor="username">
                Username
              </label>
              <Input autoComplete="username" defaultValue="admin" id="username" name="username" required />
            </div>
            <div className="space-y-2">
              <label className="mono-label" htmlFor="password">
                Password
              </label>
              <Input
                autoComplete="current-password"
                id="password"
                name="password"
                placeholder="••••••••"
                required
                type="password"
              />
            </div>

            {hasError ? (
              <div className="border border-danger/25 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
                Invalid local username or password.
              </div>
            ) : null}
            {isRateLimited ? (
              <div className="border border-danger/25 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
                Too many failed attempts. Try again in a few minutes.
              </div>
            ) : null}

            <Button className="w-full" size="lg" type="submit">
              Sign in
            </Button>
          </form>

          <div className="mt-5 border border-line bg-paper-2/80 px-3 py-3 text-sm leading-6 text-ink-soft">
            Default POC credentials are <strong className="text-ink">admin</strong> /{" "}
            <strong className="text-ink">admin@123</strong>.
          </div>
        </div>
      </div>
    </main>
  );
}
