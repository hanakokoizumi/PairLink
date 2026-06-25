import { create } from "zustand";

export type FileStatus =
  | "pending"
  | "awaiting_accept"
  | "transferring"
  | "interrupted"
  | "resuming"
  | "done"
  | "rejected"
  | "error";

export type TransferItem =
  | {
      kind: "file";
      id: string;
      direction: "send" | "recv";
      name: string;
      size: number;
      mime: string;
      status: FileStatus;
      progress: number;
      receivedBytes: number;
      blob?: Blob;
      file?: File;
    }
  | {
      kind: "message";
      id: string;
      direction: "send" | "recv";
      text: string;
      at: number;
      format?: "markdown";
      masked?: boolean;
      revealed?: boolean;
    };

export type ConnectionMode = "connecting" | "webrtc" | "relay";

export type ActivityEntry = {
  id: string;
  at: number;
  message: string;
  level?: "info" | "warn" | "error";
};

type TransferState = {
  items: TransferItem[];
  connectionMode: ConnectionMode;
  activity: ActivityEntry[];
  addItem: (item: TransferItem) => void;
  updateItem: (id: string, patch: Partial<TransferItem>) => void;
  updateProgress: (id: string, receivedBytes: number, total: number) => void;
  acceptFile: (id: string) => void;
  rejectFile: (id: string) => void;
  revealMessage: (id: string) => void;
  setConnectionMode: (mode: ConnectionMode) => void;
  addActivity: (message: string, level?: ActivityEntry["level"]) => void;
  clear: () => void;
};

let activityCounter = 0;

export const useTransferStore = create<TransferState>((set, get) => ({
  items: [],
  connectionMode: "connecting",
  activity: [],
  addItem: (item) => set({ items: [...get().items, item] }),
  updateItem: (id, patch) =>
    set({
      items: get().items.map((item) =>
        item.id === id ? ({ ...item, ...patch } as TransferItem) : item,
      ),
    }),
  updateProgress: (id, receivedBytes, total) => {
    const item = get().items.find((i) => i.id === id);
    if (!item || item.kind !== "file") return;
    if (item.status === "awaiting_accept" || item.status === "rejected") return;
    const progress = total > 0 ? Math.min(100, (receivedBytes / total) * 100) : 0;
    get().updateItem(id, {
      receivedBytes,
      progress,
      status: progress >= 100 ? "done" : "transferring",
    } as Partial<TransferItem>);
  },
  acceptFile: (id) =>
    get().updateItem(id, { status: "transferring" } as Partial<TransferItem>),
  rejectFile: (id) =>
    get().updateItem(id, { status: "rejected" } as Partial<TransferItem>),
  revealMessage: (id) =>
    get().updateItem(id, { revealed: true } as Partial<TransferItem>),
  setConnectionMode: (connectionMode) => set({ connectionMode }),
  addActivity: (message, level = "info") =>
    set({
      activity: [
        ...get().activity,
        { id: `act-${++activityCounter}`, at: Date.now(), message, level },
      ],
    }),
  clear: () => set({ items: [], activity: [], connectionMode: "connecting" }),
}));
