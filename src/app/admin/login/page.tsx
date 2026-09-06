import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect: redirectPath } = await searchParams;

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-xl font-semibold text-zinc-900">Sign in</h1>
      <p className="mb-6 text-sm text-zinc-500">360° feedback admin console.</p>
      <LoginForm redirectPath={redirectPath ?? "/admin"} />
    </div>
  );
}
