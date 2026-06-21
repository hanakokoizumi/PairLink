import { getTranslations } from "next-intl/server";
import { setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string; code: string }>;
};

export default async function ReceivePage({ params }: Props) {
  const { locale, code } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const session = await getTranslations("session");

  return (
    <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-4 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
        {t("receive")}
      </p>
      <h1 className="mt-4 font-mono text-2xl font-bold text-foreground">
        {session("roomId")}
      </h1>
      <p className="mt-4 rounded-lg border border-border bg-card px-6 py-3 font-mono text-lg tracking-widest text-primary shadow-[0_0_16px_var(--glow)]">
        {code}
      </p>
      <p className="mt-6 text-sm text-muted-foreground">{session("waiting")}</p>
    </div>
  );
}
