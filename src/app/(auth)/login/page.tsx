import { LoginForm } from "@/components/LoginForm";
import { PageHeader } from "@/components/PageHeader";

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <PageHeader title="Login" description="Use ERP operator credentials. Seed admin exists for local development." />
      <LoginForm />
    </main>
  );
}
