"use client";

import { useCallback, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectionCard } from "@/components/home/ConnectionCard";
import { mapErrorCode } from "@/lib/api";
import { fadeInUp } from "@/lib/motion";
import { useHostGuestWatch } from "@/hooks/use-host-guest-watch";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useConfigStore } from "@/lib/stores/config-store";
import { useRoomStore } from "@/lib/stores/room-store";

export function AuthPanel() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const config = useConfigStore((s) => s.config);
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const createRoom = useRoomStore((s) => s.createRoom);
  const roomId = useRoomStore((s) => s.roomId);
  const code = useRoomStore((s) => s.code);
  const url = useRoomStore((s) => s.url);
  const expiresAt = useRoomStore((s) => s.expiresAt);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showConnection, setShowConnection] = useState(false);
  const [starting, setStarting] = useState(false);

  const disableAuth = config?.disableAuth ?? false;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
      toast.success(t("auth.login"));
    } catch (err) {
      const code =
        err instanceof Error && "code" in err
          ? String((err as Error & { code: string }).code)
          : "invalid_credentials";
      toast.error(t(mapErrorCode(code)));
    }
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      await createRoom(locale);
      setShowConnection(true);
    } catch (err) {
      const code =
        err instanceof Error && "code" in err
          ? String((err as Error & { code: string }).code)
          : "generic";
      toast.error(t(mapErrorCode(code)));
    } finally {
      setStarting(false);
    }
  };

  const goToSession = useCallback(() => {
    if (roomId) router.push(`/session/${roomId}`);
  }, [roomId, router]);

  useHostGuestWatch(roomId, showConnection, () => {
    setShowConnection(false);
    goToSession();
  });

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center justify-center border-border p-8 md:border-r md:p-12"
    >
      <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary shadow-[0_0_24px_var(--glow)]">
        <ArrowUpRight className="h-7 w-7" />
      </span>
      <h2 className="font-mono text-2xl font-bold tracking-tight">{t("home.send")}</h2>
      <p className="mt-3 max-w-sm text-center text-sm text-muted-foreground">
        {t("home.sendDescription")}
      </p>

      <Card className="mt-8 w-full max-w-sm border-border/80 bg-card/80">
        <CardHeader>
          <CardTitle className="text-base">
            {disableAuth ? t("auth.startConnection") : t("auth.login")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {disableAuth ? (
            <Button
              className="w-full font-mono"
              onClick={handleStart}
              disabled={starting}
            >
              {t("auth.startConnection")}
            </Button>
          ) : isAuthenticated() ? (
            <Button
              className="w-full font-mono"
              onClick={handleStart}
              disabled={starting}
            >
              {t("auth.startConnection")}
            </Button>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">{t("auth.username")}</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button type="submit" className="w-full font-mono" disabled={loading}>
                {t("auth.login")}
              </Button>
              {config?.oidcEnabled && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full font-mono"
                  onClick={() => {
                    window.location.href = "/api/auth/oidc/start";
                  }}
                >
                  {t("auth.loginWithOidc")}
                </Button>
              )}
            </form>
          )}
        </CardContent>
      </Card>

      {roomId && (disableAuth || isAuthenticated()) && (
        <Button variant="outline" className="mt-4 font-mono" onClick={goToSession}>
          {t("connection.sessionReady")}
        </Button>
      )}

      <ConnectionCard
        open={showConnection}
        onOpenChange={setShowConnection}
        code={code ?? ""}
        url={url ?? ""}
        expiresAt={expiresAt}
        onContinue={goToSession}
      />
    </motion.div>
  );
}
