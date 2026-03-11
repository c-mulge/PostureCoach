const video = document.getElementById("webcam");
const status = document.getElementById("status");
const startBtn = document.getElementById("startBtn");
const scoreText = document.getElementById("score");
const canvasElement = document.getElementById("output");
const canvasCtx = canvasElement.getContext("2d");
const pointsText = document.getElementById("points");
const streakText = document.getElementById("streak");
const SCAN_INTERVAL = 15000; // 15 seconds
const progressText = document.getElementById("progress");
const feedbackText = document.getElementById("feedback");

let totalPoints = 0;
let currentStreak = 0;
let lastScanTime = 0;
let goodPostureCount = 0;

let camera;

startBtn.onclick = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });

  video.srcObject = stream;

  status.innerText = "AI starting...";

  const pose = new Pose({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
    },
  });

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  pose.onResults((results) => {
    if (!results.poseLandmarks) {
      status.innerText = "No body detected";
      scoreText.innerText = "Posture Score: --";
      return;
    }
    const currentTime = Date.now();

    if (currentTime - lastScanTime < SCAN_INTERVAL) {
      return; // skip scoring until 90 seconds pass
    }

    lastScanTime = currentTime;

    const nose = results.poseLandmarks[0];
    const leftShoulder = results.poseLandmarks[11];
    const rightShoulder = results.poseLandmarks[12];
    const leftHip = results.poseLandmarks[23];
    const rightHip = results.poseLandmarks[24];

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
      color: "#00FF00",
      lineWidth: 4,
    });

    drawLandmarks(canvasCtx, results.poseLandmarks, {
      color: "#FF0000",
      lineWidth: 2,
    });

    canvasCtx.restore();
    let score = 100;

    const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);

    const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const avgHipY = (leftHip.y + rightHip.y) / 2;

    const headForward = nose.y > avgShoulderY;
    const slouch = avgShoulderY > avgHipY - 0.1;

    if (shoulderDiff > 0.05) {
      score -= 30;
    }

    if (headForward) {
      score -= 35;
    }

    if (slouch) {
      score -= 35;
    }

    score = Math.max(score, 0);

    scoreText.innerText = "Posture Score: " + score;
    let pointsEarned = 0;

    if (score >= 80) {
      pointsEarned = 10;

      goodPostureCount += 1;

      if (goodPostureCount >= 120) {
        currentStreak += 1;
        goodPostureCount = 0;
      }
    } else if (score >= 60) {
      pointsEarned = 5;
    } else {
      goodPostureCount = 0;
    }

    totalPoints += pointsEarned;

    pointsText.innerText = "Points: " + totalPoints;
    streakText.innerText = "Streak: " + currentStreak;
    progressText.innerText = "Progress: " + goodPostureCount + "/120";

    if (score > 80) {
      status.innerText = "Good posture";
      feedbackText.innerText = "Great posture! Keep it up.";
    } else if (score > 60) {
      status.innerText = "Acceptable posture";
      generateFeedback("shoulders uneven");
    } else {
      status.innerText = "Bad posture";
      generateFeedback("slouching posture");
    }
  });
  camera = new Camera(video, {
    onFrame: async () => {
      await pose.send({ image: video });
    },
    width: 640,
    height: 480,
  });

  camera.start();
};

async function generateFeedback(issue) {
  const prompt = `
You are an ergonomic posture coach.
Give a short correction for this posture issue:
${issue}
`;

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyANDF-puK_7910nsnVSrNwUmmOc4e5cbAQ",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      },
    );

    const data = await response.json();

    console.log(data);

    if (data.candidates && data.candidates.length > 0) {
      feedbackText.innerText = data.candidates[0].content.parts[0].text;
    } else {
      feedbackText.innerText = "AI feedback unavailable.";
    }
  } catch (error) {
    console.error(error);
    feedbackText.innerText = "AI feedback unavailable.";
  }
}
generateFeedback("leaning forward posture");
