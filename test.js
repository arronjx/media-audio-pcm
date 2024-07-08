let audioContext;
let mediaStreamSource;
let scriptProcessor;
let audioData = [];
let isCanSendData = true; // 模拟 isCanSendData 的状态
let audioURL;

const audioWorkletCode = `
class MyProcessor extends AudioWorkletProcessor {
constructor(options) {
super(options);
this.audioData = [];
this.nextUpdateFrame = 40;
}

get intervalInFrames() {
return 40 / 1000 * sampleRate;
}

process(inputs) {
// 去处理音频数据
// eslint-disable-next-line no-undef
const output = ${to16kHz}(inputs[0][0], sampleRate);
const audioData = ${to16BitPCM}(output);
const data = [...new Int8Array(audioData.buffer)];
this.audioData = this.audioData.concat(data);
this.nextUpdateFrame -= inputs[0][0].length;
if (this.nextUpdateFrame < 0) {
this.nextUpdateFrame += this.intervalInFrames;
this.port.postMessage({
  audioData: new Int8Array(this.audioData)
});
this.audioData = [];
}
return true;
}
}

registerProcessor('my-processor', MyProcessor);
`;
const audioWorkletBlobURL = window.URL.createObjectURL(new Blob([audioWorkletCode], { type: 'text/javascript' }));


document.getElementById('startButton').addEventListener('click', startRecording);
document.getElementById('stopButton').addEventListener('click', stopRecording);
document.getElementById('downloadButton').addEventListener('click', downloadRecording);

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    mediaStreamSource = audioContext.createMediaStreamSource(stream);

    scriptProcessor = audioContext.createScriptProcessor(0, 1, 1);
    scriptProcessor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const output = to16kHz(inputData, audioContext.sampleRate);
      const audioDataBuffer = to16BitPCM(output);
      audioData.push(...new Int8Array(audioDataBuffer.buffer));
    };
    mediaStreamSource.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);

    // audioContext.audioWorklet
    // .addModule(audioWorkletBlobURL)
    // .then(() => {
    //   const myNode = new AudioWorkletNode(audioContext, 'my-processor', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
    //   myNode.port.onmessage = (event) => {
    //       audioData.push(event.data.audioData)
    //       console.log(audioData)
    //   };
    //   mediaStreamSource.connect(myNode).connect(audioContext.destination);
    // })
    // .catch(console.error);

    document.getElementById('startButton').disabled = true;
    document.getElementById('stopButton').disabled = false;
    console.log('Recording started');
  } catch (error) {
    console.error('Error accessing media devices.', error);
  }
}

function stopRecording() {
  scriptProcessor.disconnect();
  mediaStreamSource.disconnect();
  audioContext.close();

  const pcmInt16 = new Int8Array(audioData);
  const blob = new Blob([pcmInt16], { type: 'audio/pcm' });
  audioURL = window.URL.createObjectURL(blob);

  // 将音频文件添加到音频播放器中
  const audioPlayer = document.getElementById('audioPlayer');
  audioPlayer.src = audioURL;

  document.getElementById('startButton').disabled = false;
  document.getElementById('stopButton').disabled = true;
  document.getElementById('downloadButton').disabled = false;
  console.log('Recording stopped');
}

function downloadRecording() {
  if (audioURL) {
    // 创建下载链接并手动触发下载
    const downloadLink = document.createElement('a');
    downloadLink.href = audioURL;
    downloadLink.download = 'recording.pcm';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }
}

function to16kHz(inputData, sampleRate) {
  const sampleRateRatio = sampleRate / 16000;
  const newLength = Math.round(inputData.length / sampleRateRatio);
  const outputData = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    outputData[i] = inputData[Math.round(i * sampleRateRatio)];
  }
  return outputData;
}

function to16BitPCM(inputData) {
  const outputData = new Int16Array(inputData.length);
  for (let i = 0; i < inputData.length; i++) {
    const s = Math.max(-1, Math.min(1, inputData[i]));
    outputData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return outputData;
}
