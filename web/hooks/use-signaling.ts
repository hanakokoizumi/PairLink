"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { SignalingClient, type WsConfigPayload } from "@/lib/webrtc/signaling";
import { PeerConnection, isWebRtcSupported } from "@/lib/webrtc/peer";
import { DataChannelClient } from "@/lib/webrtc/datachannel";
import { IceFallbackMonitor } from "@/lib/webrtc/ice-fallback";
import { RelayClient } from "@/lib/relay/relay-client";
import {
  deriveSessionKey,
  generateKeyPair,
  serializePublicKey,
  type KeyExchangePair,
  type SessionKey,
} from "@/lib/crypto/session";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useConfigStore } from "@/lib/stores/config-store";
import { useRoomStore } from "@/lib/stores/room-store";
import { useTransferStore } from "@/lib/stores/transfer-store";

export type SignalingState = {
  connected: boolean;
  peerOnline: boolean;
  dataChannel: DataChannelClient | null;
  relay: RelayClient | null;
  role: "host" | "guest" | null;
  peerId: string | null;
  remotePeerId: string | null;
  sessionKey: SessionKey | null;
};

export function useSignaling(roomId: string, role: "host" | "guest", code?: string) {
  const t = useTranslations();
  const config = useConfigStore((s) => s.config);
  const token = useAuthStore((s) => s.token);
  const setWsConnected = useRoomStore((s) => s.setWsConnected);
  const setPeerOnline = useRoomStore((s) => s.setPeerOnline);
  const setPeerId = useRoomStore((s) => s.setPeerId);
  const setConnectionMode = useTransferStore((s) => s.setConnectionMode);
  const addActivity = useTransferStore((s) => s.addActivity);

  const [state, setState] = useState<SignalingState>({
    connected: false,
    peerOnline: false,
    dataChannel: null,
    relay: null,
    role: null,
    peerId: null,
    remotePeerId: null,
    sessionKey: null,
  });

  const signalingRef = useRef<SignalingClient | null>(null);
  const peerRef = useRef<PeerConnection | null>(null);
  const iceMonitorRef = useRef<IceFallbackMonitor | null>(null);
  const keyPairRef = useRef<KeyExchangePair | null>(null);
  const sessionKeyRef = useRef<SessionKey | null>(null);
  const relayRef = useRef<RelayClient | null>(null);
  const remotePeerIdRef = useRef<string | null>(null);
  const handshakeSentRef = useRef(false);

  const switchToRelay = useCallback(() => {
    if (!config?.wsFallback || !signalingRef.current) return;
    if (!remotePeerIdRef.current) return;
    setConnectionMode("relay");
    addActivity("Switching to relay mode", "warn");
    peerRef.current?.close();
    peerRef.current = null;
    setState((s) => ({ ...s, dataChannel: null }));
    relayRef.current?.dispose();
    relayRef.current = new RelayClient(
      signalingRef.current,
      sessionKeyRef.current,
      remotePeerIdRef.current ?? "",
    );
    setState((s) => ({ ...s, relay: relayRef.current }));
  }, [addActivity, config?.wsFallback, setConnectionMode]);

  useEffect(() => {
    if (!config || !isWebRtcSupported()) return;

    let disposed = false;
    const signaling = new SignalingClient(token ?? undefined);
    signalingRef.current = signaling;

    const setupPeer = (rtcConfig: RTCConfiguration) => {
      const peer = new PeerConnection(rtcConfig, {
        onIceCandidate: (candidate) => {
          if (!remotePeerIdRef.current) return;
          signaling.signal({
            to: remotePeerIdRef.current,
            candidate,
          });
        },
        onIceConnectionStateChange: (iceState) => {
          iceMonitorRef.current?.handleState(iceState);
          if (iceState === "connected" || iceState === "completed") {
            setConnectionMode("webrtc");
          }
        },
        onDataChannel: (channel) => {
          const dc = new DataChannelClient(channel);
          setState((s) => ({ ...s, dataChannel: dc }));
        },
      });
      peerRef.current = peer;

      iceMonitorRef.current = new IceFallbackMonitor({
        timeoutMs: (config.settings.iceTimeoutSec ?? 15) * 1000,
        onFailed: switchToRelay,
        onDisconnected: switchToRelay,
      });

      return peer;
    };

    const negotiate = async (peer: PeerConnection, isHost: boolean) => {
      if (isHost) {
        const channel = peer.createHostChannel();
        const dc = new DataChannelClient(channel);
        setState((s) => ({ ...s, dataChannel: dc }));
        const offer = await peer.createOffer();
        if (remotePeerIdRef.current) {
          signaling.signal({ to: remotePeerIdRef.current, sdp: offer });
        }
      }
    };

  void (async () => {
      try {
        await signaling.connect();
        if (disposed) return;
        setWsConnected(true);
        setState((s) => ({ ...s, connected: true }));

        keyPairRef.current = await generateKeyPair();

        signaling.on("ws-config", (payload) => {
          const wsConfig = payload as WsConfigPayload;
          setPeerId(wsConfig.peerId);
          setState((s) => ({
            ...s,
            peerId: wsConfig.peerId,
            role: wsConfig.role,
          }));

          if (!peerRef.current) {
            setupPeer(config.rtcConfig);
          }
        });

        signaling.on("error", (payload) => {
          const code =
            payload && typeof payload === "object" && "code" in payload
              ? String((payload as { code: string }).code)
              : "join_failed";
          if (code === "rate_limited") {
            toast.error(t("errors.rateLimited"));
          }
          addActivity(`Connection error: ${code}`, "error");
        });

        signaling.on("ws-close", () => {
          setWsConnected(false);
          setState((s) => ({ ...s, connected: false }));
        });

        signaling.on("ws-open", () => {
          setWsConnected(true);
          setState((s) => ({ ...s, connected: true }));
        });

        signaling.on("peer-joined", (payload) => {
          const { peerId: remoteId } = payload as { peerId: string };
          remotePeerIdRef.current = remoteId;
          setPeerOnline(true);
          setState((s) => ({ ...s, peerOnline: true, remotePeerId: remoteId }));
          addActivity("Peer joined");

          if (!peerRef.current) {
            setupPeer(config.rtcConfig);
          }
          if (peerRef.current && role === "host") {
            void negotiate(peerRef.current, true);
          }
          if (keyPairRef.current && !handshakeSentRef.current) {
            signaling.e2eHandshake(
              remoteId,
              serializePublicKey(keyPairRef.current),
            );
            handshakeSentRef.current = true;
          }
        });

        signaling.on("peer-left", () => {
          iceMonitorRef.current?.dispose();
          iceMonitorRef.current = null;
          setPeerOnline(false);
          peerRef.current?.close();
          peerRef.current = null;
          relayRef.current?.dispose();
          relayRef.current = null;
          remotePeerIdRef.current = null;
          sessionKeyRef.current = null;
          handshakeSentRef.current = false;
          setState((s) => ({
            ...s,
            peerOnline: false,
            dataChannel: null,
            relay: null,
            remotePeerId: null,
            sessionKey: null,
          }));
          addActivity("Peer disconnected", "warn");
          for (const item of useTransferStore.getState().items) {
            if (item.kind === "file" && item.status === "transferring") {
              useTransferStore.getState().updateItem(item.id, {
                status: "interrupted",
              });
            }
          }
        });

        signaling.on("signal", async (payload) => {
          try {
            const sig = payload as {
              from?: string;
              sdp?: RTCSessionDescriptionInit;
              candidate?: RTCIceCandidateInit;
            };
            if (sig.from) remotePeerIdRef.current = sig.from;
            const peer = peerRef.current;
            if (!peer) return;
            if (sig.sdp) {
              if (sig.sdp.type === "offer") {
                const answer = await peer.handleOffer(sig.sdp);
                signaling.signal({ to: sig.from, sdp: answer });
              } else {
                await peer.handleAnswer(sig.sdp);
              }
            }
            if (sig.candidate) {
              await peer.addIceCandidate(sig.candidate);
            }
          } catch {
            addActivity("Signaling error", "error");
          }
        });

        signaling.on("e2e-handshake", async (payload) => {
          try {
            const { publicKey, from } = payload as { publicKey: string; from?: string };
            if (from) remotePeerIdRef.current = from;
            if (!keyPairRef.current || !publicKey) return;
            sessionKeyRef.current = await deriveSessionKey(
              keyPairRef.current,
              publicKey,
            );
            relayRef.current?.setSessionKey(sessionKeyRef.current);
            setState((s) => ({ ...s, sessionKey: sessionKeyRef.current }));
            if (remotePeerIdRef.current) {
              relayRef.current?.setPeerId(remotePeerIdRef.current);
            }
            if (from && keyPairRef.current && !handshakeSentRef.current) {
              signaling.e2eHandshake(
                from,
                serializePublicKey(keyPairRef.current),
              );
              handshakeSentRef.current = true;
            }
          } catch {
            addActivity("Encryption handshake failed", "error");
          }
        });

        if (role === "host") {
          signaling.hostJoin(roomId, token ?? undefined);
        } else {
          signaling.joinRoom({ roomId, code });
        }
      } catch {
        addActivity("Connection failed", "error");
      }
    })();

    return () => {
      disposed = true;
      iceMonitorRef.current?.dispose();
      peerRef.current?.close();
      peerRef.current = null;
      relayRef.current?.dispose();
      relayRef.current = null;
      handshakeSentRef.current = false;
      signaling.disconnect();
      setWsConnected(false);
    };
  }, [
    addActivity,
    code,
    config,
    role,
    roomId,
    setConnectionMode,
    setPeerId,
    setPeerOnline,
    setWsConnected,
    switchToRelay,
    token,
    t,
  ]);

  return state;
}
