import type { PageResponse } from "@/shared/types";
import { createBridge, createPageLog } from "./bridge";
import { createMessageMonitor } from "./message-store";
import { claimPageFlag, createWhatsAppModules } from "./whatsapp/modules";

const EXTENSION_VERSION = "1.4.0";
const MESSAGE_ORIGIN = "*";

function start(): void {
  if (!claimPageFlag()) return;

  const post = (message: PageResponse): void => {
    try {
      window.postMessage(message, MESSAGE_ORIGIN);
    } catch {
      return;
    }
  };

  const log = createPageLog(post);
  const modules = createWhatsAppModules(log);
  const monitor = createMessageMonitor({ modules, log, post });
  const bridge = createBridge({ version: EXTENSION_VERSION, post, log, modules, monitor });

  monitor.start();
  bridge.attach();
  bridge.announceReady();
}

start();
