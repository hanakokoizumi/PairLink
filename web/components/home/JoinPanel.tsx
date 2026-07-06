"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { LogIn } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { mapErrorCode } from "@/lib/api";
import { fadeInUp } from "@/lib/motion";
import { useConfigStore } from "@/lib/stores/config-store";
import { useRoomStore } from "@/lib/stores/room-store";

export function JoinPanel() {
  const t = useTranslations();
  const router = useRouter();
  const codeLength = useConfigStore((s) => s.config?.settings.roomCodeLength ?? 5);
  const joinByCode = useRoomStore((s) => s.joinByCode);
  const [chars, setChars] = useState<string[]>(Array(codeLength).fill(""));
  const [loading, setLoading] = useState(false);

  const code = useMemo(() => chars.join(""), [chars]);

  const handleChange = (index: number, value: string) => {
    const char = value
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(-1)
      .toUpperCase();
    const next = [...chars];
    next[index] = char;
    setChars(next);
    if (char && index < codeLength - 1) {
      const el = document.getElementById(`otp-${index + 1}`);
      el?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !chars[index] && index > 0) {
      const el = document.getElementById(`otp-${index - 1}`);
      el?.focus();
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== codeLength) {
      toast.error(t("errors.invalidCode", { length: codeLength }));
      return;
    }
    setLoading(true);
    try {
      const roomId = await joinByCode(code);
      router.push(`/session/${roomId}?code=${code}`);
    } catch (err) {
      const errCode =
        err instanceof Error && "code" in err
          ? String((err as Error & { code: string }).code)
          : "room_not_found";
      toast.error(t(mapErrorCode(errCode)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      custom={1}
      className="flex flex-col items-center justify-center px-6 py-10 md:px-10 md:py-16"
    >
      <span className="mb-8 flex h-16 w-16 items-center justify-center rounded-xl border border-accent/20 bg-accent/5 text-accent">
        <LogIn className="h-7 w-7" />
      </span>
      <h2 className="text-2xl font-semibold tracking-tight">{t("home.receive")}</h2>

      <Card className="mt-10 w-full max-w-sm">
        <CardContent className="pt-5">
          <form onSubmit={handleJoin} className="space-y-4">
            <Label>{t("session.roomCode")}</Label>
            <div className="flex justify-center gap-2">
              {chars.map((char, index) => (
                <Input
                  key={index}
                  id={`otp-${index}`}
                  inputMode="text"
                  maxLength={1}
                  value={char}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="h-12 w-10 text-center font-mono text-lg tracking-widest uppercase"
                  aria-label={`Character ${index + 1}`}
                />
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {t("home.noLoginRequired")}
            </p>
            <Button
              type="submit"
              className="w-full"
              disabled={loading || code.length !== codeLength}
            >
              {t("home.joinConnection")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
