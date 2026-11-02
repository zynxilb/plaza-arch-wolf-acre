import { createFileRoute } from "@tanstack/react-router";
import { ChessGame } from "@/components/chess/game";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <ChessGame />;
}
