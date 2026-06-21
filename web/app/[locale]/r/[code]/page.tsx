import { setRequestLocale } from "next-intl/server";
import { CodeRedirect } from "@/components/home/CodeRedirect";

type Props = {
  params: Promise<{ locale: string; code: string }>;
};

export default async function ReceivePage({ params }: Props) {
  const { locale, code } = await params;
  setRequestLocale(locale);

  return <CodeRedirect code={code} />;
}
