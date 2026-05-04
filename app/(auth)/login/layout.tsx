import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Log in",
  description: "Log in to your SprintRoom workspace.",
  path: "/login",
  noIndex: true,
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
