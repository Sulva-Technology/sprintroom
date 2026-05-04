import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
