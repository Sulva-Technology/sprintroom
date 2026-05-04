import { Metadata } from "next";

export const siteConfig = {
  name: "SprintRoom",
  description: "SprintRoom helps teams plan tasks, run Pomodoro focus sessions, track blockers, submit proof of progress, and see what moved today.",
  url: getSiteUrl(),
  ogImage: `${getSiteUrl()}/opengraph-image`,
  links: {
    twitter: "https://twitter.com/sprintroom",
    github: "https://github.com/sprintroom",
  },
};

export function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  return "http://localhost:3000";
}

export function absoluteUrl(path: string) {
  return `${getSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export const defaultMetadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "SprintRoom | Focus-Powered Task Management for Teams",
    template: "%s | SprintRoom",
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: getSiteUrl(),
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
    creator: "@sprintroom",
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  manifest: absoluteUrl("/manifest.json"),
};

interface BuildPageMetadataOptions {
  title?: string;
  description?: string;
  path: string;
  image?: string;
  noIndex?: boolean;
}

export function buildPageMetadata({
  title,
  description,
  path,
  image,
  noIndex = false,
}: BuildPageMetadataOptions): Metadata {
  const url = absoluteUrl(path);
  const metadata: Metadata = {
    ...defaultMetadata,
    title: title || defaultMetadata.title,
    description: description || defaultMetadata.description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      ...defaultMetadata.openGraph,
      url,
      title: title ? `${title} | ${siteConfig.name}` : defaultMetadata.openGraph?.title,
      description: description || defaultMetadata.openGraph?.description,
    },
    twitter: {
      ...defaultMetadata.twitter,
      title: title ? `${title} | ${siteConfig.name}` : defaultMetadata.twitter?.title,
      description: description || defaultMetadata.twitter?.description,
    },
  };

  if (image) {
    const imageUrl = image.startsWith("http") ? image : absoluteUrl(image);
    if (metadata.openGraph?.images && Array.isArray(metadata.openGraph.images)) {
        (metadata.openGraph.images[0] as any).url = imageUrl;
    }
    if (metadata.twitter) {
        metadata.twitter.images = [imageUrl];
    }
  }

  if (noIndex) {
    metadata.robots = {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    };
  }

  return metadata;
}

export const noIndexMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};
