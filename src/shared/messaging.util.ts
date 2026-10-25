import { ext } from "./browser";

export type MessageHandler = (message: unknown) => Promise<unknown> | undefined;

type PolyfillListener = Parameters<typeof ext.runtime.onMessage.addListener>[0];

export function addMessageListener(handler: MessageHandler): void {
  const listener = ((message: unknown) => handler(message)) as unknown as PolyfillListener;
  ext.runtime.onMessage.addListener(listener);
}
