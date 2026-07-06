"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import { PairLinkLogo } from "@/components/brand/PairLinkLogo";
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
  const router = useRouter();
  const config = useConfigStore((s) => s.config);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const loading = useAuthStore((s) => s.loading);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const authenticated = Boolean(user ?? token);
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
  const displayName = user?.username || user?.sub || username;

  const handleLogout = () => {
    logout();
    setUsername("");
    setPassword("");
    toast.success(t("auth.logoutSuccess"));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
      toast.success(t("auth.loginSuccess"));
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
      await createRoom();
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
      className="flex flex-col items-center justify-center border-border/30 px-6 py-10 md:border-r md:px-10 md:py-16"
    >
      <PairLinkLogo size={64} className="mb-8" />
      <h2 className="text-2xl font-semibold tracking-tight">{t("home.send")}</h2>

      <Card className="mt-10 w-full max-w-sm">
        {!disableAuth && authenticated && (
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              {t("auth.loggedInAs", { username: displayName })}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className={authenticated && !disableAuth ? "pt-0" : "pt-5"}>
          {disableAuth ? (
            <Button
              className="w-full"
              onClick={handleStart}
              disabled={starting}
            >
              {t("auth.startConnection")}
            </Button>
          ) : authenticated ? (
            <div className="space-y-3">
              <Button
                className="w-full"
                onClick={handleStart}
                disabled={starting}
              >
                {t("auth.startConnection")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleLogout}
              >
                {t("auth.logout")}
              </Button>
            </div>
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
              <Button type="submit" className="w-full" disabled={loading}>
                {t("auth.login")}
              </Button>
              {config?.oidcEnabled && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
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

      {roomId && (disableAuth || authenticated) && (
        <Button variant="outline" className="mt-4" onClick={goToSession}>
          {t("connection.enterSession")}
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
