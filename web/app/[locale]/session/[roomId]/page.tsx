import { getTranslations } from "next-intl/server";
import { setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string; roomId: string }>;
};

export default async function SessionPage({ params }: Props) {
  const { locale, roomId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("session");
  const connection = await getTranslations("connection");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center justify-between border-b border-border pb-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {t("title")}
          </p>
          <h1 className="mt-1 font-mono text-xl font-bold text-foreground">
            {roomId}
          </h1>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs text-primary">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          {connection("connecting")}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
        <p className="font-mono text-sm text-muted-foreground">{t("waiting")}</p>
      </div>
    </div>
  );
}
