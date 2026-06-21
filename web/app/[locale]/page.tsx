import { getTranslations } from "next-intl/server";
import { setRequestLocale } from "next-intl/server";
import { HomeSplit } from "@/components/home/HomeSplit";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const common = await getTranslations("common");

  return (
    <div className="flex flex-1 flex-col">
      <section className="border-b border-border/60 px-4 py-12 text-center sm:px-6 sm:py-16">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
          {common("appName")}
        </p>
        <h1 className="mt-4 font-mono text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
          {t("subtitle")}
        </p>
      </section>
      <HomeSplit />
    </div>
  );
}
