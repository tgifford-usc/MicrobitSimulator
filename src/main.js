import { MakeCodeFrameDriver, createMakeCodeURL } from "@microbit/makecode-embed/vanilla";

const host = document.getElementById("frameHost");
const logEl = document.getElementById("log");
const clearBtn = document.getElementById("clearBtn");
const sendBtn = document.getElementById("sendBtn");
const outgoing = document.getElementById("outgoing");

// 1) Create the iframe with a *known-good* MakeCode URL (avoids the “Windows icon” issue)
const iframe = document.createElement("iframe");
iframe.allow = "usb; autoplay; camera; microphone;";
iframe.id = "makecode-iframe";
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
    controllerId: "microbit-sim-with-serial",
    // onEditorContentLoaded: () => {
    //   waitForSimAndInstallTap._timer = setInterval(waitForSimAndInstallTap, 200);
    //   appendLog("✅ MakeCode editor loaded in iframe");
    // },
  },
  () => iframe
);

driver.initialize();

clearBtn.onclick = () => (logEl.textContent = "");


function findSimWindow(win) {
  try {
    if (win?.pxsim?.serial?.inject) return win;
  } catch (e) {
    // ignore cross-origin (shouldn't happen now)
  }

  for (let i = 0; i < (win?.frames?.length || 0); i++) {
    const found = findSimWindow(win.frames[i]);
    if (found) return found;
  }
  return null;
}


// 4) Sending data TO the simulator:
export function sendToSimulatorSerial(text) {
  const editorIframe = document.getElementById("makecode-iframe");
  const editorWin = editorIframe?.contentWindow;
  if (!editorWin) {
    console.warn("Editor iframe not ready");
    return false;
  }

  const simWin = findSimWindow(editorWin);
  if (!simWin) {
    console.warn("Simulator not ready (pxsim.serial.inject not found yet)");
    return false;
  }

  // Important: newline triggers onDataReceived(NewLine) patterns
  const payload = text.endsWith("\n") ? text : text + "\n";
  simWin.pxsim.serial.inject(payload);

  return true;
}

sendBtn.onclick = () => {
  const ok = sendToSimulatorSerial(outgoing.value);
  appendLog(`→ ${outgoing.value}${ok ? "" : " (sim not ready)"}`);
};


function appendLog(line) {
  logEl.textContent += (logEl.textContent ? "\n" : "") + line;
}

function safeJson(x) {
  try { return JSON.stringify(x); }
  catch { return String(x); }
}


function installSimSerialTap(simWin) {
  if (simWin.__serialTapInstalled) return;
  simWin.__serialTapInstalled = true;

  const pxsim = simWin.pxsim;
  if (!pxsim?.serial) {
    appendLog("⚠️ No pxsim.serial on sim window");
    return;
  }

  // Tap outgoing serial at the API boundary
  const ser = pxsim.serial;
  if (typeof ser.writeString !== "function") {
    appendLog("⚠️ pxsim.serial.writeString not found");
    return;
  }

  if (!ser.__writeStringTapped) {
    ser.__writeStringTapped = true;

    const origWriteString = ser.writeString.bind(ser);

    // Buffer to emit nice "lines" instead of chunks
    let buf = "";

    ser.writeString = (s) => {
      const str = String(s ?? "");
      buf += str;

      // Flush whenever newline appears (CRLF or LF)
      if (/\n/.test(buf)) {
        // Split but keep last partial
        const parts = buf.split(/\r?\n/);
        buf = parts.pop() ?? "";
        for (const line of parts) {
          if (line.length) appendLog(`← ${line}`);
        }
      }

      return origWriteString(s);
    };

    //appendLog("🧷 Installed serial-out tap at pxsim.serial.writeString");
  }
}


// install the simulator serial tap
setInterval(() => {
  const editorWin = iframe.contentWindow;
  if (!editorWin) return;

  const simWin = findSimWindow(editorWin);
  if (!simWin) return;

  installSimSerialTap(simWin);
}, 500);


// Disable send button until simulator is ready
let simReady = false;

setInterval(() => {
  if (simReady) return;
  const simWin = findSimWindow(iframe.contentWindow);
  if (simWin) {
    simReady = true;
    sendBtn.disabled = false;
    //appendLog("🟢 Simulator ready");
  }
}, 200);

sendBtn.disabled = true;