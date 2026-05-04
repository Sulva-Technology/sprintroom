import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Create your SprintRoom Account",
  description: "Create a SprintRoom account and start managing team tasks with focus sessions and progress proof.",
  path: "/signup",
  noIndex: true,
});

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
