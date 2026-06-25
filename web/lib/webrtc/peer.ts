export type PeerEvents = {
  onIceCandidate?: (candidate: RTCIceCandidateInit) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onIceConnectionStateChange?: (state: RTCIceConnectionState) => void;
  onDataChannel?: (channel: RTCDataChannel) => void;
};

export class PeerConnection {
  private pc: RTCPeerConnection;
  private events: PeerEvents;
  private dataChannel: RTCDataChannel | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  constructor(rtcConfig: RTCConfiguration, events: PeerEvents = {}) {
    this.events = events;
    this.pc = new RTCPeerConnection(rtcConfig);

    this.pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.events.onIceCandidate?.(ev.candidate.toJSON());
      }
    };

    this.pc.onconnectionstatechange = () => {
      this.events.onConnectionStateChange?.(this.pc.connectionState);
    };

    this.pc.oniceconnectionstatechange = () => {
      this.events.onIceConnectionStateChange?.(this.pc.iceConnectionState);
    };

    this.pc.ondatachannel = (ev) => {
      this.dataChannel = ev.channel;
      this.events.onDataChannel?.(ev.channel);
    };
  }

  createHostChannel(label = "pairlink"): RTCDataChannel {
    this.dataChannel = this.pc.createDataChannel(label, { ordered: true });
    return this.dataChannel;
  }

  get channel(): RTCDataChannel | null {
    return this.dataChannel;
  }

  get connection(): RTCPeerConnection {
    return this.pc;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  async handleOffer(sdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    await this.pc.setRemoteDescription(sdp);
    await this.flushPendingCandidates();
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(sdp: RTCSessionDescriptionInit) {
    await this.pc.setRemoteDescription(sdp);
    await this.flushPendingCandidates();
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!candidate.candidate) return;
    if (!this.pc.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(candidate);
    } catch {
      this.pendingCandidates.push(candidate);
    }
  }

  private async flushPendingCandidates() {
    const pending = [...this.pendingCandidates];
    this.pendingCandidates = [];
    for (const candidate of pending) {
      try {
        await this.pc.addIceCandidate(candidate);
      } catch {
        // ignore stale candidates
      }
    }
  }

  close() {
    this.dataChannel?.close();
    this.pc.close();
  }
}

export function isWebRtcSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof RTCPeerConnection !== "undefined" &&
    typeof RTCDataChannel !== "undefined"
  );
}
