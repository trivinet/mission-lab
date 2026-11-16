/// <reference lib="webworker" />
import type { RunRequestMessage } from './protocol';
import { handleRunMessage } from './run-handler';

self.onmessage = (event: MessageEvent<RunRequestMessage>) => {
  const { response, transfer } = handleRunMessage(event.data);
  self.postMessage(response, transfer);
};
