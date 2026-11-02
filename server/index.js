import { createApp } from "./app.js";
import { config } from "./config.js";

createApp().listen(config.port, () => {
  console.log(`Dashboard berjalan di http://localhost:${config.port}  (mode data: ${config.mode})`);
});
