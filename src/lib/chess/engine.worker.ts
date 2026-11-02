import { findBestMove, type SearchRequest } from "./engine";

type Request = SearchRequest & { id: number };

const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage: (data: unknown) => void;
};

ctx.onmessage = (event) => {
  const { id, ...req } = event.data;
  try {
    const move = findBestMove(req);
    ctx.postMessage({ id, move });
  } catch (err) {
    ctx.postMessage({
      id,
      move: null,
      error: err instanceof Error ? err.message : "engine",
    });
  }
};
