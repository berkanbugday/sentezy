import { env } from "./env";
import { buildServer } from "./server";

const app = buildServer();

app
  .listen({ port: env.PORT, host: "0.0.0.0" })
  .then((addr) => app.log.info(`Sentezy API listening on ${addr}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
