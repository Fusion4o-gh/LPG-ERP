const EmbeddedPostgresModule = require("embedded-postgres");

const EmbeddedPostgres = EmbeddedPostgresModule.default || EmbeddedPostgresModule;

const pg = new EmbeddedPostgres({
  databaseDir: "./.local-postgres",
  user: "lpg",
  password: "lpg_dev_password",
  port: 5432,
  persistent: true,
  onLog: (message) => console.log(String(message).trimEnd()),
  onError: (message) => console.error(String(message).trimEnd()),
});

async function start() {
  await pg.initialise();
  await pg.start();

  try {
    await pg.createDatabase("lpg_management_system");
  } catch (error) {
    console.log(`createDatabase: ${error.message}`);
  }

  console.log("embedded postgres ready on 5432");
}

async function stop() {
  try {
    await pg.stop();
  } finally {
    process.exit(0);
  }
}

process.on("SIGTERM", stop);
process.on("SIGINT", stop);

start().catch((error) => {
  console.error(error);
  process.exit(1);
});

setInterval(() => {}, 2147483647);
