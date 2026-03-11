const video = document.getElementById("webcam");
const status = document.getElementById("status");
const startBtn = document.getElementById("startBtn");

startBtn.onclick = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });

  video.srcObject = stream;

  status.innerText = "Camera started";
};
