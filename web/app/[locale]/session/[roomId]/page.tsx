import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TransferRoom } from "@/components/session/TransferRoom";

type Props = {
  params: Promise<{ locale: string; roomId: string }>;
};

export default async function SessionPage({ params }: Props) {
  const { locale, roomId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "common" });

  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          {t("loading")}
        </div>
      }
    >
      <TransferRoom roomId={roomId} />
    </Suspense>
  );
}
