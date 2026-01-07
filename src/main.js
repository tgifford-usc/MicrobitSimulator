import { MakeCodeFrameDriver, createMakeCodeURL } from "@microbit/makecode-embed/vanilla";

const host = document.getElementById("frameHost");
const logEl = document.getElementById("log");
const clearBtn = document.getElementById("clearBtn");
const sendBtn = document.getElementById("sendBtn");
const outgoing = document.getElementById("outgoing");

// 1) Create the iframe with a *known-good* MakeCode URL (avoids the “Windows icon” issue)
const iframe = document.createElement("iframe");
iframe.allow = "usb; autoplay; camera; microphone;";
iframe.src = createMakeCodeURL(
  "https://makecode.offig.com/editor/",
  undefined, // version
  undefined, // language
  2,         // controller=2
  undefined  // extra query params
);
host.appendChild(iframe);


// 2) Initialize the frame driver (handshake / controller wiring)
const driver = new MakeCodeFrameDriver(
  {
    controllerId: "microbit-souped-up",
    onEditorContentLoaded: () => {
      appendLog("✅ MakeCode editor loaded in iframe");
    },
  },
  () => iframe
);

driver.initialize();

clearBtn.onclick = () => (logEl.textContent = "");

// 3) Listen to postMessage traffic from the iframe.
// For now, log EVERYTHING so we can see the exact schema MakeCode sends for serial.


window.addEventListener("message", (ev) => {
  // IMPORTANT: only accept messages from MakeCode
  //if (ev.origin !== "https://makecode.microbit.org") return;

  // Log raw messages so we can identify serial packets
  appendLog("← " + safeJson(ev.data));

  // TODO (after you run once):
  // Find the message that corresponds to serial output (e.g. “hello” from serial.writeLine)
  // then extract that text and call your existing handler.
  //
  // Example pattern (you’ll adjust once you see the real shape):
  // if (ev.data?.type === "serial" && typeof ev.data?.data === "string") {
  //   onSerialLine(ev.data.data);
  // }
});


// Put this somewhere that runs early (before/around driverRef.initialize()).
/*
window.addEventListener("message", (ev) => {
  // Helpful: see *everything* coming in
  console.log("[postMessage]", {
    origin: ev.origin,
    fromIframe: ev.source === document.querySelector("iframe")?.contentWindow,
    data: ev.data,
  });
});
*/

// 4) Sending data TO the simulator:
// This depends on the exact command schema that MakeCode expects.
// We’ll use the same “inspect first” approach: once you’ve seen inbound serial messages,
// we can mirror the format for outbound messages.

function sendToSimulator(text) {
  if (!iframe?.contentWindow) return;

  iframe.contentWindow.postMessage({
    type: "serial",
    data: text + "\n",   // add newline if your microbit code uses readLine/onDataReceived
    id: "bridge",        // can be anything; sim ignores mostly
    sim: false
  }, "https://makecode.offig.com"); // or "*" while same-origin testing
}


sendBtn.onclick = () => {
  const text = outgoing.value;
  if (!text) return;

  // Placeholder: we will replace this with the correct message format once identified.
  // For now, just show what you *intend* to send:
  appendLog("→ (should be sending) " + text);

  sendToSimulator(text);

  // Likely form will be something like:
  // iframe.contentWindow.postMessage({ type: "...", ... }, "https://makecode.microbit.org");

  outgoing.value = "";
};




function appendLog(line) {
  logEl.textContent += (logEl.textContent ? "\n" : "") + line;
}

function safeJson(x) {
  try { return JSON.stringify(x); }
  catch { return String(x); }
}
