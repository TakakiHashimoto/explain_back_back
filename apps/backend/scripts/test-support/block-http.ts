// Preload only in the scheduler CLI integration test. Even a regression must
// never reach OneSignal, and catching the thrown error must not hide a send.
let httpCalls = 0;
const blockHttp = () => {
  httpCalls++;
  throw new Error("HTTP is forbidden in the scheduler dry-run test");
};
globalThis.fetch = Object.assign(async () => blockHttp(), { preconnect: blockHttp });
process.on("exit", () => {
  console.log("Test HTTP calls", httpCalls);
  if (httpCalls > 0) process.exitCode = 1;
});
