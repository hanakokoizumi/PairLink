import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { TransferRoom } from "@/components/session/TransferRoom";

type Props = {
  params: Promise<{ locale: string; roomId: string }>;
};

export default async function SessionPage({ params }: Props) {
  const { locale, roomId } = await params;
  setRequestLocale(locale);

  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">
          Loading…
        </div>
      }
    >
      <TransferRoom roomId={roomId} />
    </Suspense>
  );
}
