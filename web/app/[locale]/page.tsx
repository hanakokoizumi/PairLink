import { setRequestLocale } from "next-intl/server";
import { HomeSplit } from "@/components/home/HomeSplit";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex flex-1 flex-col">
      <HomeSplit />
    </div>
  );
}
