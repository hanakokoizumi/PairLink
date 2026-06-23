"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Download } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mapErrorCode } from "@/lib/api";
import { fadeInUp } from "@/lib/motion";
import { useConfigStore } from "@/lib/stores/config-store";
import { useRoomStore } from "@/lib/stores/room-store";

export function JoinPanel() {
  const t = useTranslations();
  const router = useRouter();
  const codeLength = useConfigStore((s) => s.config?.settings.roomCodeLength ?? 5);
  const joinByCode = useRoomStore((s) => s.joinByCode);
  const [digits, setDigits] = useState<string[]>(Array(codeLength).fill(""));
  const [loading, setLoading] = useState(false);

  const code = useMemo(() => digits.join(""), [digits]);

  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < codeLength - 1) {
      const el = document.getElementById(`otp-${index + 1}`);
      el?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      const el = document.getElementById(`otp-${index - 1}`);
      el?.focus();
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== codeLength) {
      toast.error(t("errors.invalidCode"));
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
      className="flex flex-col items-center justify-center p-8 md:p-12"
    >
      <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-xl border border-accent/40 bg-accent/10 text-accent shadow-[0_0_24px_var(--glow)]">
        <Download className="h-7 w-7" />
      </span>
      <h2 className="font-mono text-2xl font-bold tracking-tight">{t("home.receive")}</h2>
      <p className="mt-3 max-w-sm text-center text-sm text-muted-foreground">
        {t("home.receiveDescription")}
      </p>

      <Card className="mt-8 w-full max-w-sm border-border/80 bg-card/80">
        <CardHeader>
          <CardTitle className="text-base">{t("home.joinConnection")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleJoin} className="space-y-4">
            <Label>{t("session.roomCode")}</Label>
            <div className="flex justify-center gap-2">
              {digits.map((digit, index) => (
                <Input
                  key={index}
                  id={`otp-${index}`}
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="h-12 w-10 text-center font-mono text-lg tracking-widest"
                  aria-label={`Digit ${index + 1}`}
                />
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {t("home.noLoginRequired")}
            </p>
            <Button
              type="submit"
              className="w-full font-mono"
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
