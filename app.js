import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "https://unpkg.com/@mediapipe/tasks-vision@0.10.0?module";

const demosSection = document.getElementById("demos");

let poseLandmarker = undefined;
let runningMode = "IMAGE";
let enableWebcamButton;
let webcamRunning = false;
let rafId = null;
const videoHeight = "360px";
const videoWidth = "480px";

const createPoseLandmarker = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm",
  );
  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
      delegate: "GPU",
    },
    runningMode: runningMode,
    numPoses: 2,
  });
  demosSection.classList.remove("invisible");
};
createPoseLandmarker();

/********************************************************************
// Demo 1: Grab a bunch of images from the page and detection them
// upon click.
********************************************************************/

// In this demo, we have put all our clickable images in divs with the
// CSS class 'detectionOnClick'. Lets get all the elements that have
// this class.
const imageContainers = document.getElementsByClassName("detectOnClick");

// Now let's go through all of these and add a click event listener.
for (let i = 0; i < imageContainers.length; i++) {
  // Add event listener to the child element whichis the img element.
  imageContainers[i].children[0].addEventListener("click", handleClick);
}

// When an image is clicked, let's detect it and display results!
async function handleClick(event) {
  if (!poseLandmarker) {
    console.log("Wait for poseLandmarker to load before clicking!");
    return;
  }

  if (runningMode === "VIDEO") {
    runningMode = "IMAGE";
    await poseLandmarker.setOptions({ runningMode: "IMAGE" });
  }
  // Remove all landmarks drawed before
  const allCanvas = event.target.parentNode.getElementsByClassName("canvas");
  for (var i = allCanvas.length - 1; i >= 0; i--) {
    const n = allCanvas[i];
    n.parentNode.removeChild(n);
  }

  // We can call poseLandmarker.detect as many times as we like with
  // different image data each time. The result is returned in a callback.
  poseLandmarker.detect(event.target, (result) => {
    console.log("image detect result:", {
      poses: result.landmarks ? result.landmarks.length : 0,
      sample:
        result.landmarks && result.landmarks[0]
          ? result.landmarks[0].slice(0, 5)
          : null,
    });
    const canvas = document.createElement("canvas");
    canvas.setAttribute("class", "canvas");
    canvas.setAttribute("width", event.target.naturalWidth + "px");
    canvas.setAttribute("height", event.target.naturalHeight + "px");
    canvas.style =
      "left: 0px;" +
      "top: 0px;" +
      "width: " +
      event.target.width +
      "px;" +
      "height: " +
      event.target.height +
      "px;";

    event.target.parentNode.appendChild(canvas);
    const canvasCtx = canvas.getContext("2d");
    const drawingUtils = new DrawingUtils(canvasCtx);
    for (const landmark of result.landmarks) {
      drawingUtils.drawLandmarks(landmark, {
        radius: (data) => {
          const z = data.from && data.from.z ? data.from.z : 0;
          return DrawingUtils.lerp(z, -0.15, 0.1, 5, 1);
        },
      });
      drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS);
    }
  });
}

/********************************************************************
// Demo 2: Continuously grab image from webcam stream and detect it.
********************************************************************/

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const drawingUtils = new DrawingUtils(canvasCtx);

// Check if webcam access is supported.
const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;

// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
  enableWebcamButton = document.getElementById("webcamButton");
  enableWebcamButton.addEventListener("click", enableCam);
} else {
  console.warn("getUserMedia() is not supported by your browser");
}

// Enable the live webcam view and start detection.
async function enableCam(event) {
  if (!poseLandmarker) {
    console.log("Wait! poseLandmaker not loaded yet.");
    return;
  }

  console.log("enableCam clicked; current webcamRunning =", webcamRunning);

  if (webcamRunning === true) {
    webcamRunning = false;
    enableWebcamButton.innerText = "Enable Webcam";
    // Stop all media tracks and clear the video source
    if (video && video.srcObject) {
      try {
        const tracks = video.srcObject.getTracks();
        tracks.forEach((t) => {
          console.log("Stopping track", t.kind);
          t.stop();
        });
      } catch (err) {
        console.error("Error stopping tracks:", err);
      }
      try {
        video.pause();
      } catch (e) {}
      try {
        video.removeAttribute("src");
      } catch (e) {}
      video.srcObject = null;
      try {
        video.load();
      } catch (e) {}
      // clear the drawing canvas
      clearCanvas();
    }
    video.removeEventListener("loadeddata", predictWebcam);
    // cancel any pending animation frame
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    // switch back to IMAGE mode to stop internal video processing
    try {
      runningMode = "IMAGE";
      await poseLandmarker.setOptions({ runningMode: "IMAGE" });
      console.log("setOptions to IMAGE OK");
    } catch (e) {
      console.warn("Failed to set runningMode to IMAGE:", e);
    }
  } else {
    webcamRunning = true;
    enableWebcamButton.innerText = "Disable Webcam";
  }

  // getUsermedia parameters.
  const constraints = {
    video: true,
  };

  // Only request camera when we just enabled the webcam.
  if (webcamRunning) {
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        console.log(
          "getUserMedia resolved, tracks:",
          stream.getTracks().length,
        );
        video.srcObject = stream;
        // Ensure we don't add duplicate listeners
        video.removeEventListener("loadeddata", predictWebcam);
        video.addEventListener("loadeddata", predictWebcam);
      })
      .catch((err) => {
        console.error("getUserMedia error:", err);
      });
  } else {
    console.log("webcam not started because webcamRunning is false");
  }
}

let lastVideoTime = -1;
async function predictWebcam() {
  try {
    console.log(
      "predictWebcam start; webcamRunning=",
      webcamRunning,
      "video.currentTime=",
      video.currentTime,
    );
  } catch (e) {
    console.log("predictWebcam start logging failed", e);
  }
  canvasElement.style.height = videoHeight;
  video.style.height = videoHeight;
  canvasElement.style.width = videoWidth;
  video.style.width = videoWidth;
  // Now let's start detecting the stream.
  if (runningMode === "IMAGE") {
    runningMode = "VIDEO";
    try {
      await poseLandmarker.setOptions({ runningMode: "VIDEO" });
      console.log("setOptions to VIDEO OK");
    } catch (e) {
      console.error("setOptions error:", e);
    }
  }
  let startTimeMs = performance.now();
  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    try {
      poseLandmarker.detectForVideo(video, startTimeMs, (result) => {
        // debug: log pose detection summary
        try {
          console.log("video detect result:", {
            poses: result.landmarks ? result.landmarks.length : 0,
            sample:
              result.landmarks && result.landmarks[0]
                ? result.landmarks[0].slice(0, 5)
                : null,
          });
        } catch (e) {
          console.warn("Error logging detectForVideo result", e);
        }
        try {
          canvasCtx.save();
          canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
          for (const landmark of result.landmarks) {
            drawingUtils.drawLandmarks(landmark, {
              radius: (data) => {
                const z = data.from && data.from.z ? data.from.z : 0;
                return DrawingUtils.lerp(z, -0.15, 0.1, 5, 1);
              },
            });
            drawingUtils.drawConnectors(
              landmark,
              PoseLandmarker.POSE_CONNECTIONS,
            );
          }
          canvasCtx.restore();
        } catch (err) {
          console.error("Error in detectForVideo callback:", err);
        }
      });
    } catch (e) {
      console.error("detectForVideo error:", e);
    }
  }

  // Call this function again to keep predicting when the browser is ready.
  if (webcamRunning === true) {
    // ensure canvas matches video resolution for crisp drawing
    try {
      const dpr = window.devicePixelRatio || 1;
      const vw = video.videoWidth || canvasElement.width;
      const vh = video.videoHeight || canvasElement.height;
      if (vw && vh) {
        const pixelW = Math.max(1, Math.floor(vw * dpr));
        const pixelH = Math.max(1, Math.floor(vh * dpr));
        if (canvasElement.width !== pixelW || canvasElement.height !== pixelH) {
          canvasElement.width = pixelW;
          canvasElement.height = pixelH;
          canvasElement.style.width = vw + "px";
          canvasElement.style.height = vh + "px";
          canvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
      }
    } catch (e) {
      // ignore
    }
    rafId = window.requestAnimationFrame(predictWebcam);
  } else {
    rafId = null;
  }
}

// Clear canvas when stopping
function clearCanvas() {
  try {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  } catch (e) {
    // ignore
  }
}
