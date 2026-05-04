import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata;

export default function FocusLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
