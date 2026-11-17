/// <reference lib="webworker" />
import type { RunRequestMessage } from './protocol';
import { handleRunMessage } from './run-handler';

self.onmessage = (event: MessageEvent<RunRequestMessage>) => {
  const started_ms = performance.now();
  const { response, transfer } = handleRunMessage(event.data);
  const finished_ms = performance.now();
  // Timing is diagnostic only (ML-TASK-026 measurement harness); the UI ignores it. The post
  // time is wall-clock (performance.timeOrigin + now) so the main thread can subtract its own.
  self.postMessage(
    {
      ...response,
      timing: {
        engine_ms: finished_ms - started_ms,
        workerPostedAt_ms: performance.timeOrigin + performance.now(),
      },
    },
    transfer,
  );
};
