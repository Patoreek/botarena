import type { FastifyInstance } from "fastify";
import { verifyAccessToken } from "../lib/auth.js";

export async function wsRoutes(fastify: FastifyInstance) {
  fastify.get("/ws", { websocket: true }, (socket, request) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token =
      url.searchParams.get("token") ?? (request.cookies as { accessToken?: string })?.accessToken;

    if (!token) {
      socket.close(4401, "Unauthorized");
      return;
    }

    verifyAccessToken(token)
      .then((payload) => {
        if (!payload) {
          socket.close(4401, "Invalid token");
          return;
        }

        socket.send(
          JSON.stringify({
            type: "server:hello",
            payload: { message: "Hello" },
          })
        );

        const interval = setInterval(() => {
          if (socket.readyState === 1) {
            socket.send(
              JSON.stringify({
                type: "server:time",
                payload: { time: new Date().toISOString() },
              })
            );
          } else {
            clearInterval(interval);
          }
        }, 5000);

        socket.on("close", () => clearInterval(interval));
      })
      .catch(() => {
        socket.close(4401, "Invalid token");
      });
  });
}
