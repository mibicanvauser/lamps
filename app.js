let isPowerOn = false;
let currentActiveMode= '';
let lastSelectedHex= '#ffffff';
let rememberedBrightness= 127;
let isCloudUpdate= false;
let lastSelectedFeedValue = "#WHITE";


//Declare constants and assign function to buttons- register service worker
if('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('./sw.js')
		.then(reg => console.log('[PWA] Service Worker registered! Scope:', reg.scope))
		.catch(err => console.error('[PWA] Service Worker registration failed:', err));
	});
}

let AIO_USERNAME = localStorage.getItem('LAMP_AIO_USERNAME') || '';
let AIO_KEY = localStorage.getItem('LAMP_AIO_KEY') || '';

const COLOR_FEED = "lamp-color";
const BRIGHTNESS_FEED = "lamp-brightness";
const TIMER_FEED = "lamp-timer";

let mqttClient = null;

const controlsWrapper= document.getElementById('controls-wrapper');
const settingsCard= document.getElementById('settings-card');

//Input from elements
const setupUsernameInput= document.getElementById('setup-username');
const setupKeyInput= document.getElementById('setup-key');
const saveSettingsBtn= document.getElementById('save-settings-btn');
const gearBtn= document.getElementById('gear-btn');

const powerBtn = document.getElementById('power-btn');
const brightnessSlider = document.getElementById('brightness-slider');
const brightnessPct = document.getElementById('brightness-pct');

//build color wheel in html container

const colorPicker = new iro.ColorPicker("#picker-container", {
	width: 240,
	layout: [
		{
		 component: iro.ui.Wheel,
		options: {
		handleRadius: 8
}
}
],
	handleSvg: null
});



//function to do brightness math

function updateBrightnessLabel(rawValue) {
const percentage = Math.round((rawValue/255)*100);
brightnessPct.textContent = `${percentage}%`;
}

function ambientGlow(hexColor){

if(!isPowerOn){
document.documentElement.style.setProperty('--gradient-alpha', '0' );
document.documentElement.style.setProperty('--before-alpha', '0');
return;
}


const currentRawBrightness= parseInt(brightnessSlider.value, 10) || 0;
const baseOpacity = currentRawBrightness / 255;

const dynamicOpacity = isPowerOn ? Math.max(0.30, baseOpacity).toFixed(2) : 0;

if(!hexColor) return;

if(hexColor==='#BREATHE' || hexColor==='BREATHE') {
	const splitGradient = `linear-gradient(to bottom, rgba(219, 39, 119, ${dynamicOpacity}) 0%, rgba(16, 185, 129, ${dynamicOpacity}) 100%)`;

	document.documentElement.style.setProperty('--mode-gradient', splitGradient);
	document.documentElement.style.setProperty('--gradient-alpha', `${dynamicOpacity}`);
	document.documentElement.style.setProperty('--before-alpha', '0');
	return;


}else if(hexColor==='#RAINBOW' || hexColor==='RAINBOW') {
	const rainbowGradient = `linear-gradient(to bottom right,
		rgba(255, 0, 0, ${dynamicOpacity}), 
		rgba(255, 127, 0, ${dynamicOpacity}), 
		rgba(255, 255, 0, ${dynamicOpacity}), 
		rgba(0, 255, 0, ${dynamicOpacity}), 
		rgba(0, 0, 255, ${dynamicOpacity}), 
		rgba(139, 0, 255, ${dynamicOpacity}))`;


	document.documentElement.style.setProperty('--mode-gradient', rainbowGradient);
	document.documentElement.style.setProperty('--gradient-alpha', `${dynamicOpacity}`);
	document.documentElement.style.setProperty('--before-alpha', '0');
	return;

}else if(hexColor && hexColor.startsWith('#')){
let fullHex= hexColor;
if(hexColor.length === 4){
fullHex = "#" + hexColor[1] + hexColor[1] + hexColor[2] + hexColor[2] + hexColor[3] + hexColor[3];
}
const r = parseInt(fullHex.slice(1, 3), 16);
const g = parseInt(fullHex.slice(3, 5), 16);
const b = parseInt(fullHex.slice(5, 7), 16);

document.documentElement.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, ${dynamicOpacity})`);
document.documentElement.style.setProperty('--before-alpha', isPowerOn ? '0.85' : '0');
document.documentElement.style.setProperty('--gradient-alpha', '0');

setTimeout(() => {
	if (currentActiveMode === '') {
		document.documentElement.style.setProperty('--mode-gradient', 'linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0))');
	}
}, 500)


return;
		}
}


//Send messages to lamp


function sendToLamp(feedName, payload) {
const url = `https://io.adafruit.com/api/v2/${AIO_USERNAME}/feeds/${feedName}/data`;

//send data packet
fetch(url, {
	method: "POST",
	headers: {
	"X-AIO-Key": AIO_KEY,
	"Content-Type": "application/json"
	},
	
	body: JSON.stringify({value: payload})
	})

//print results to console if you will

.then(response => {
if (!response.ok){
	console.error('[Error] Failed to send to ${feedName}');
	
	}else{
	console.log('[Success] Sent "${payload}" to ${feedName}');
	}
})

.catch(error => console.error("[Network Error]:", error));
}


//pull current color from cloud server and display on wheel

function syncWithCloud(){

const colorUrl = `https://io.adafruit.com/api/v2/${AIO_USERNAME}/feeds/${COLOR_FEED}/data/last`;
const brightnessUrl = `https://io.adafruit.com/api/v2/${AIO_USERNAME}/feeds/${BRIGHTNESS_FEED}/data/last`;

Promise.all([
//request most recent data
fetch(brightnessUrl, {headers: {"X-AIO-Key": AIO_KEY} }).then(res => res.json()),
fetch(colorUrl, {headers: {"X-AIO-Key": AIO_KEY} }).then(res => res.json())
])


.then(([brightnessData, colorData])=> {
if(brightnessData.value !== undefined){
const currentBrightness = parseInt(brightnessData.value, 10);
console.log(`[Sync] Found last saved brightness: ${currentBrightness}`);

if(currentBrightness > 0){
	rememberedBrightness = currentBrightness;
	brightnessSlider.value = currentBrightness;
	updateBrightnessLabel(currentBrightness);
	isPowerOn = true;
	powerBtn.textContent = "OFF";
	powerBtn.style.backgroundColor = "#ffffff";
	powerBtn.style.color = "#000000";

}else{
brightnessSlider.value = 0
updateBrightnessLabel(0);
isPowerOn = false;
powerBtn.textContent = "ON";
powerBtn.style.backgroundColor = "#000000";
powerBtn.style.color = "#ffffff";
	}
}


if(colorData.value) {
	console.log(`[Sync] Found last color: ${colorData.value}`);
	
	if(colorData.value === '#BREATHE'){
		currentActiveMode='BREATHE';
	if(breatheBtn){
		breatheBtn.style.background= "linear-gradient(to bottom right, #00FF00 0%, #FF007F 100%)";
		breatheBtn.style.color = "#ffffff"
	}

	ambientGlow(colorData.value);

	}else if(colorData.value === '#RAINBOW'){
	currentActiveMode ='RAINBOW';
	if(rainbowBtn){
	rainbowBtn.style.backgroundColor= "#ffffff";
	rainbowBtn.style.color= "#000000";
	}
	ambientGlow(colorData.value);
	

	} else if (colorData.value.startsWith('#')){
	currentActiveMode='';
	lastSelectedHex= colorData.value;
	lastSelectedFeedValue = colorData.value;

	isCloudUpdate = true;
	
	
	if(colorPicker) {

		if(presetColorMap[colorData.value]) {
		const mappedHex = presetColorMap[colorData.value]
		colorPicker.color.hexString = mappedHex;

	document.querySelectorAll('.color-macro').forEach(btn => {
		if(btn.getAttribute('data-hex') === colorData.value) {
		btn.classList.add('active');
	}else{
		btn.classList.remove('active');
	}
	});
	}else{
		const hexRegex = /^#[0-9A-F]{6}$/i;
		if(hexRegex.test(colorData.value)) {
			colorPicker.color.hexString = colorData.value;
	}else{
		console.log(`[Sync Warning] Suppressed invalid color string on wheel: ${colorData.value}`);
		colorPicker.color.hexString = "#FFFFFF";
	}
	document.querySelectorAll('.color-macro').forEach(btn => btn.classList.remove('active'));
	}

	if(colorPicker.color.value < 100){
		colorPicker.color.value = 100;
	}
}
		isCloudUpdate = false;

const displayGlow = presetColorMap[colorData.value] || colorData.value;
ambientGlow(displayGlow);
}

}
})
.catch(error => console.error("[Sync Error]:", error))
}

const activeTimerUrl = `https://io.adafruit.com/api/v2/${AIO_USERNAME}/feeds/${TIMER_FEED}/data/last`;

fetch(activeTimerUrl, {
	method: "GET",
	headers: {"X-AIO-Key": AIO_KEY}
})
.then(response => {
	if(!response.ok) throw new Error("Could not pull active timer");
	return response.json();
})
.then(data => {
	if(data.value && data.value !=="0") {
		const secondsRemainingFromCloud = parseInt(data.value, 10);

	if(secondsRemainingFromCloud > 0 && secondsRemainingFromCloud <= 86400) {
		console.log(`[Sync] Active countdown recovered on reload: ${secondsRemainingFromCloud}s`);

	const localVisualTarget = Math.floor(Date.now() / 1000) + secondsRemainingFromCloud;
	startLocalCountdown(localVisualTarget);

	}else{
		console.log("[Sync] Timer expired while away...");
		sendToLamp(TIMER_FEED, 0);
		clearLocalCountdown();

		}
	}else{
		clearLocalCountdown;	
	}
})		
.catch(error => console.error("[Timer Boot Sync Error]:", error));

		
	
//Event listeners for all buttons
powerBtn.addEventListener('click', () => {
isPowerOn = !isPowerOn

if(sleepTimerInterval) {
	sendToLamp(TIMER_FEED, 0);
	clearLocalCountdown();
}


if(isPowerOn){
powerBtn.textContent = "OFF";
powerBtn.style.backgroundColor= "#ffffff";
powerBtn.style.color= "#000000";

brightnessSlider.value = rememberedBrightness
updateBrightnessLabel(rememberedBrightness);

sendToLamp(BRIGHTNESS_FEED, rememberedBrightness);

if(currentActiveMode != '') {
	ambientGlow(currentActiveMode);

}else{
	ambientGlow(colorPicker.color.hexString);
}

}else{
powerBtn.textContent = "ON";
powerBtn.style.backgroundColor= "#000000";
powerBtn.style.color= "#ffffff";
sendToLamp(BRIGHTNESS_FEED, 0);

if(currentActiveMode != '') {
	ambientGlow(currentActiveMode);
}else{
	ambientGlow(colorPicker.color.hexString);
	}
}

});

//brightness slider
brightnessSlider.addEventListener('input', () => {
const currentVal = parseInt(brightnessSlider.value, 10) || 0;
updateBrightnessLabel(currentVal);

if(currentVal > 0) {

rememberedBrightness= currentVal;
}

if(isPowerOn) {

	if(currentActiveMode !==''){
	ambientGlow(currentActiveMode);
}else{
	ambientGlow(colorPicker.color.hexString);
		}	
	}
});


brightnessSlider.addEventListener('change', () => {

const currentVal = parseInt(brightnessSlider.value, 10) || 0;

if(currentVal > 0) {
	rememberedBrightness = currentVal;
}

if(isPowerOn){
const currentVal= parseInt(brightnessSlider.value, 10);
console.log(`[UI] Brightness slider updated to: ${currentVal}`);

//send it

sendToLamp(BRIGHTNESS_FEED, currentVal);
}else{
console.log(`[UI] Stored ${currentVal} as remembered brightness.`);
	}
}); 

//color.macro buttons and listeners for color wheel
const presetColorMap = {
	'#RED': '#FF0000',
	'#ORANGE': '#FF4800',
	'#YELLOW': '#EEFF00',
	'#GREEN': '#00FF00',
	'#BLUE': '#0033FF',
	'#INDIGO': '#4B0082',
	'#PURPLE': '#800080',
	'#PINK': '#FF007F',
	'#WHITE': '#FFFFFF'
};

document.querySelectorAll('.color-macro').forEach(button => {
	button.addEventListener('click', () => {
	if (isMicActive) stopAudioProcessing();
	const textTrigger = button.getAttribute('data-hex');
//send hex from specific hardcoded button
	console.log(`[UI] Preset triggered: ${textTrigger}`);
	const displayHex = presetColorMap[textTrigger] || '#FFFFFF';

	lastSelectedHex=displayHex
	lastSelectedFeedValue = textTrigger;

	currentActiveMode='PRESET';
	sendToLamp(COLOR_FEED, textTrigger);



	if(colorPicker) { 
	colorPicker.color.hexString = displayHex;
	
	if(colorPicker.color.value < 100) {
		colorPicker.color.value = 100;
	}
}
	document.querySelectorAll('.color-macro').forEach(btn => btn.classList.remove('active'));
	button.classList.add('active');

	resetModes();
	ambientGlow(displayHex);
	});


});

const breatheBtn = document.getElementById('breathe');
const rainbowBtn = document.getElementById('rainbow');

if(breatheBtn) {
breatheBtn.addEventListener('click', () => {

if(isMicActive) stopAudioProcessing();

if(currentActiveMode === 'BREATHE'){
console.log("[UI]: Turning BREATHE off while active");
	currentActiveMode='';
	sendToLamp(COLOR_FEED, lastSelectedFeedValue);
	const cleanHex = presetColorMap[lastSelectedHex] || lastSelectedHex;
	colorPicker.color.hexString = cleanHex;
	resetModes();
	ambientGlow(cleanHex);
}else{
	
console.log("[UI] Mode clicked: PEAK");
currentActiveMode='BREATHE';
sendToLamp(COLOR_FEED, "#BREATHE");
breatheBtn.style.background= "linear-gradient(to bottom right, #00FF00 0%, #FF007F 100%)";
breatheBtn.style.color= "#000000";
ambientGlow("BREATHE");

if(rainbowBtn){
rainbowBtn.style.backgroundColor= "#2c2c2e";
rainbowBtn.style.color= "#ffffff";
}
}
	});
}


if(rainbowBtn) {
rainbowBtn.addEventListener('click', () => {

if(isMicActive) stopAudioProcessing();

if(currentActiveMode === 'RAINBOW'){
console.log("[UI]: Turning RAINBOW off while active");
	currentActiveMode='';
	sendToLamp(COLOR_FEED, lastSelectedFeedValue);
	const cleanHex = presetColorMap[lastSelectedHex] || lastSelectedHex;
	colorPicker.color.hexString = cleanHex;
	resetModes();
	ambientGlow(lastSelectedHex);


}else{

console.log("[UI] Mode clicked: Rainbow Gradient");
currentActiveMode ='RAINBOW';
sendToLamp(COLOR_FEED, "#RAINBOW");
ambientGlow("RAINBOW");

rainbowBtn.style.backgroundColor = "#ffffff";
rainbowBtn.style.color = "#000000";

if(breatheBtn){
breatheBtn.style.backgroundColor = "#2c2c2e";
breatheBtn.style.color = "#ffffff";
}

}
});	
}


function resetModes(){

if(breatheBtn){
breatheBtn.style.background = ""; 
breatheBtn.style.backgroundColor= "#2c2c2e";
breatheBtn.style.color= "#ffffff";
}

if(rainbowBtn){
rainbowBtn.style.backgroundColor = "#2c2c2e";
rainbowBtn.style.color = "#ffffff";
	}
}



//give life to color wheel

colorPicker.on('input:end', (color) => {

	if(isCloudUpdate) return;	
	
	const selectedHex = color.hexString;
	console.log(`[UI] Color sent: ${selectedHex}`);
	lastSelectedHex= selectedHex;
	lastSelectedFeedValue = selectedHex;

	currentActiveMode= '';

document.querySelectorAll('.color-macro').forEach(btn => btn.classList.remove('active'));
	
sendToLamp(COLOR_FEED, selectedHex);
resetModes();
ambientGlow(selectedHex);
});



function checkCredentials(){
if (AIO_USERNAME && AIO_KEY){

	if(settingsCard.style.display !== 'none' && settingsCard.offsetHeight > 0){
	settingsCard.classList.add('fade-out');
	setTimeout(() => {
	settingsCard.style.display= 'none';
	settingsCard.classList.remove('fade-out');
	
controlsWrapper.style.display='flex';
controlsWrapper.classList.add('fade-init');
void controlsWrapper.offsetWidth;
controlsWrapper.classList.remove('fade-init');

syncWithCloud();
initMQTT();
}, 400);

}else{
settingsCard.style.display= 'none';
controlsWrapper.style.display= 'flex';

syncWithCloud();
initMQTT();
}

}else{
setupUsernameInput.value = AIO_USERNAME;
setupKeyInput.value = AIO_KEY;

if(controlsWrapper.style.display!=='none' && controlsWrapper.offsetHeight > 0){
	controlsWrapper.classList.add('fade-out');
	setTimeout(() => {
		controlsWrapper.style.display='none';
		controlsWrapper.classList.remove('fade-out');
	settingsCard.style.display='flex';
	settingsCard.classList.add('fade-init');

	void settingsCard.offsetWidth;
	settingsCard.classList.remove('fade-init');
	document.documentElement.style.setProperty('--accent-glow', 'rgba(0, 0, 0, 0)');
}, 400);


}else{
controlsWrapper.style.display= 'none';
settingsCard.style.display='flex';
document.documentElement.style.setProperty('--accent-glow', 'rgba(0, 0, 0, 0)');
	}
}
}

saveSettingsBtn.addEventListener('click', () => {
const enteredUser = setupUsernameInput.value.trim();
const enteredKey = setupKeyInput.value.trim();

if (!enteredUser || !enteredKey) {
	alert("both fields are required twin");
	return;
}

//commit vars to local memory

localStorage.setItem('LAMP_AIO_USERNAME', enteredUser);
localStorage.setItem('LAMP_AIO_KEY', enteredKey);

AIO_USERNAME = enteredUser;
AIO_KEY = enteredKey;

checkCredentials();

});

if(gearBtn){
	gearBtn.addEventListener('click', () => {
	AIO_USERNAME = '';
	AIO_KEY = '';
	checkCredentials();
});
}

checkCredentials();

//timer logic

let sleepTimerInterval= null;
let selectedDurationMinutes = 15;
let targetEpochSeconds = 0;


const timerToggleBtn = document.getElementById('timer-toggle-btn');
const timerCountdownDisplay = document.getElementById('timer-countdown-display');


document.querySelectorAll('.timer-segment').forEach(pill => {
	pill.addEventListener('click', () => {
	if(sleepTimerInterval) return;

	document.querySelectorAll('.timer-segment').forEach(p => {
		p.style.background = "#2c2c2e";
			p.style.color = "#ffffff";
		});

	pill.style.background = "#ffffff";
	pill.style.color= "#000000";

	selectedDurationMinutes = parseInt(pill.getAttribute('data-value'), 10) || 15;
	console.log(`[UI] Timer duration target updated to: ${selectedDurationMinutes}m`);
});
});



function tickSynchronizedTimer() {
	const currentEpochSeconds= Math.floor(Date.now() / 1000);
	const secondsRemaining = targetEpochSeconds-currentEpochSeconds;

	if(secondsRemaining <= 0){
	handleTimerComplete();
	return;
}
	const mins = Math.floor(secondsRemaining/60);
	const secs= secondsRemaining % 60;
	timerCountdownDisplay.textContent = `Shutdown in: ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
	
function startLocalCountdown(targetTimestamp) {
targetEpochSeconds= parseInt(targetTimestamp, 10);

if(sleepTimerInterval) clearInterval(sleepTimerInterval);
	
	timerToggleBtn.textContent = "STOP";
	timerToggleBtn.style.backgroundColor = "#ff3b30";
	timerToggleBtn.style.color = "#ffffff";
	
	const countdownWrapper = document.getElementById('countdown-wrapper');
	if (countdownWrapper) countdownWrapper.style.setProperty('display', 'flex', 'important');
	timerCountdownDisplay.style.display = "inline";

	tickSynchronizedTimer();
	sleepTimerInterval = setInterval(tickSynchronizedTimer, 1000);
}

	function clearLocalCountdown() {
		if(sleepTimerInterval) {
			clearInterval(sleepTimerInterval);
			sleepTimerInterval = null;
}
		targetEpochSeconds = 0;
		
	timerToggleBtn.textContent= "START";
	timerToggleBtn.style.backgroundColor= "#ffffff";
	timerToggleBtn.style.color= "#000000";

	const countdownWrapper = document.getElementById('countdown-wrapper');
	if (countdownWrapper) countdownWrapper.style.setProperty('display', 'none', 'important');
	timerCountdownDisplay.style.display = "none";
	
	document.querySelectorAll('.timer-segment').forEach((p, idx) => {
		p.style.background = idx ===0? "#ffffff" : "#2c2c2e";
		p.style.color = idx ===0? "#000000" : "#ffffff";
});
selectedDurationMinutes= 15;

}

		


function handleTimerComplete() {
	console.log("[Timer] Synced countdown at zero. Shutting down...");
	
	sendToLamp(BRIGHTNESS_FEED, 0);

	isPowerOn = false;

	clearLocalCountdown();
	
	if(powerBtn) {
		powerBtn.textContent= "ON";
		powerBtn.style.backgroundColor = "#000000";
		powerBtn.style.color = "#ffffff";
}
	if(brightnessSlider) {
		brightnessSlider.value = 0;
		updateBrightnessLabel(0);
}

	document.querySelectorAll('.color-macro').forEach(btn => btn.classList.remove('active'));
	resetModes();

	ambientGlow(currentActiveMode !== '' ? currentActiveMode : colorPicker.color.hexString);	

}


	
	

	if (timerToggleBtn) {
	timerToggleBtn.addEventListener('click', () => {
	if(!isPowerOn) {
		alert("please turn on the lamp before setting a timer thank you i appreciate you");
		return;
}

	if(sleepTimerInterval) {
		console.log("[Timer] Cancelling timer sequence...");
		sendToLamp(TIMER_FEED, 0);
		clearLocalCountdown();
		return;
}


	const runtimeSeconds= selectedDurationMinutes * 60;

	console.log(`[Timer] Publishing target timestamp ${runtimeSeconds} to feed...`);
	sendToLamp(TIMER_FEED, runtimeSeconds);
	
	const localVisualTarget = Math.floor(Date.now() / 1000) + runtimeSeconds;

	startLocalCountdown(localVisualTarget);
});
}


window.addEventListener('pointerdown', (event) => {

if (navigator.vibrate) {
	navigator.vibrate(15);
}

const ripple= document.createElement('div');
ripple.classList.add('touch-ripple');

ripple.style.left = `${event.clientX}px`;
ripple.style.top = `${event.clientY}px`;

if (isPowerOn && currentActiveMode === '') {
	ripple.classList.add('touch-ripple-accent');
}

document.body.appendChild(ripple);

setTimeout(() => {
	ripple.remove();
	}, 450);

});

document.getElementById('resetESPBtn').addEventListener('click', () => {

if(confirm("Reboot lamp (we did not do it joe)")) {
	console.log("[System] Rebooting...");

sendToLamp("lamp-reset", "REBOOT"); 

	} 
});

function initMQTT() {
if(mqttClient && mqttClient.connected) return;

console.log("[MQTT] Connecting webSocket...");

const brokerUrl = 'wss://io.adafruit.com/mqtt';
const options = {
	username: AIO_USERNAME,
	password: AIO_KEY,
	clientId: 'lamp_ui_'+Math.random().toString(16).substr(2,8),
	protocol: 'wss',
	rejectUnauthorized: true
};

mqttClient = mqtt.connect(brokerUrl, options);

mqttClient.on('connect', () => {
	console.log("[MQTT] webSocket connected.");
	
	mqttClient.subscribe(`${AIO_USERNAME}/feeds/${COLOR_FEED}`);
	mqttClient.subscribe(`${AIO_USERNAME}/feeds/${BRIGHTNESS_FEED}`);
	mqttClient.subscribe(`${AIO_USERNAME}/feeds/${TIMER_FEED}`);
});

mqttClient.on('error',(err) => {
	console.error("[MQTT] webSocket connection error!");

});

mqttClient.on('message', (topic, message) => {
	const payload= message.toString();
	const feedKey = topic.split('/').pop();

console.log(`[MQTT Stream] Active payload discovered! ${feedKey} -> "${payload}"`);

if(feedKey === BRIGHTNESS_FEED){
	const numericBrightness = parseInt(payload, 10);
	const currentSliderVal = parseInt(brightnessSlider.value, 10);

if(numericBrightness === currentSliderVal && numericBrightness !== 0) return;

if(numericBrightness === 0){
	isPowerOn = false;
	powerBtn.textContent = "ON";
	powerBtn.style.backgroundColor = "#000000";
	powerBtn.style.color = "#ffffff";
	brightnessSlider.value = 0;
	updateBrightnessLabel(0);
	ambientGlow(currentActiveMode !== '' ? currentActiveMode : colorPicker.color.hexString);


}else{
	isPowerOn= true;
	powerBtn.textContent = "OFF";
	powerBtn.style.backgroundColor = "#ffffff";
	powerBtn.style.color = "#000000";
	brightnessSlider.value = numericBrightness;
	rememberedBrightness = numericBrightness;
	updateBrightnessLabel(numericBrightness);


	if(currentActiveMode === '') {
		ambientGlow(colorPicker.color.hexString);


}else{
	ambientGlow(currentActiveMode);
		}
	}
}

if(feedKey === COLOR_FEED) {
	if(payload === '#BREATHE'){
		currentActiveMode='BREATHE';
		resetModes();
		if(breatheBtn) {
			breatheBtn.style.background = "linear-gradient(to bottom right, #00FF00 0%, #FF007F 100%)";
			breatheBtn.style.color = "#000000";
		
		}
				ambientGlow(payload);

}else if(payload === '#RAINBOW') {
	currentActiveMode='RAINBOW';
	resetModes();
	if(rainbowBtn) {
		rainbowBtn.style.backgroundColor = "#ffffff";
		rainbowBtn.style.color= "#000000";
		}
	if(rainbowBtn) rainbowBtn.style.backgroundColor = "#ffffff";
	ambientGlow(payload);


}else if(presetColorMap[payload]) {
	currentActiveMode='';
	const UIHex = presetColorMap[payload];

	lastSelectedHex = UIHex;
	lastSelectedFeedValue = payload;

	document.querySelectorAll('.color-macro').forEach(btn => {
		if(btn.getAttribute('data-hex') === payload) {
			btn.classList.add('active');
	}else{
			btn.classList.remove('active');
	}
});

	isCloudUpdate=true;
	if(colorPicker){
		colorPicker.color.hexString = UIHex;
		if(colorPicker.color.value < 100) {
			colorPicker.color.value = 100;
	}
}

isCloudUpdate=false;
	
	resetModes();
	ambientGlow(UIHex);

}else if(payload.startsWith("#")){
	currentActiveMode='';
	
	document.querySelectorAll('.color-macro').forEach(btn => btn.classList.remove('active'));

	isCloudUpdate= true;		

	if(colorPicker) {
		colorPicker.color.hexString = payload;
	if(colorPicker.color.value < 100) {
		colorPicker.color.value = 100;
		}
	}
	isCloudUpdate = false;
	resetModes();
	ambientGlow(payload);
	}
}

if(feedKey === TIMER_FEED) {
	if(payload && payload !=="0") {
			const liveSecondsRemaining = parseInt(payload, 10);
	
	if(liveSecondsRemaining > 0){
		const localVisualTarget = Math.floor(Date.now() / 1000) + liveSecondsRemaining;

			if(Math.abs(targetEpochSeconds - localVisualTarget) > 5) {
			console.log("[MQTT] Live countdown from Feed");
			startLocalCountdown(localVisualTarget);
		}
}else{
	clearLocalCountdown();
	}
}else{
	clearLocalCountdown();
			}
		}
	});

}

if('Notification' in window && 'serviceWorker' in navigator) {
	Notification.requestPermission().then(permission => {
		if(permission === 'granted') {
	console.log('[PWA] Notification permission granted.');
		}
	});
}

// sound mode

let audioCtx = null;
let analyser = null;
let micStream = null;
let micAnimationLoop = null;
let isMicActive = false;
let lastSentBrightness = -1;
let lastSendTimestamp = 0;

const micToggleBtn = document.getElementById('mic-toggle-btn');
const micLevelBar = document.getElementById('mic-level-bar');

async function startAudioProcessing() {
try {
	micStream = await navigator.mediaDevices.getUserMedia({audio: true, video: false});

	audioCtx = new (window.AudioContext || window.webkitAudioContext) ();
	analyser = audioCtx.createAnalyser();
	analyser.fftSize = 64;

	const source = audioCtx.createMediaStreamSource(micStream);
	source.connect(analyser);

	isMicActive = true;
	micToggleBtn.textContent = "STOP MIC ";
	micToggleBtn.style.backgroundColor = "#ff3b30";
	micToggleBtn.style.color = "#ffffff";
	
	processAudioFrame();
}catch (err) {
	console.error("[Audio Error] Mic access denied or unsupported:", err );
	alert("please give me access to your microphone i promise not to do anything ominous");
	}
}

function stopAudioProcessing() {
	isMicActive = false;

	if (micAnimationLoop) cancelAnimationFrame (micAnimationLoop);
	if (micStream) micStream.getTracks().forEach(track => track.stop());
	if (audioCtx) audioCtx.close();
	
	if(micToggleBtn) {
		micToggleBtn.textContent = "START MIC";
		micToggleBtn.style.backgroundColor = "#ffffff";
		micToggleBtn.style.color = "#000000";
	}
	if(micLevelBar) micLevelBar.style.width = "0%";
}

function processAudioFrame () {
	if(!isMicActive) return;

	const dataArray = new Uint8Array(analyser.frequencyBinCount);
	analyser.getByteFrequencyData(dataArray);

	let sum= 0;
	for (let i = 0; i < dataArray.length; i++) {
		sum += dataArray[i];
	}
	const averageVolume = sum / dataArray.length;

	const volumePct = Math.round((averageVolume / 255) * 100);
	if (micLevelBar) micLevelBar.style.width = `${volumePct}%`;

	const targetBrightness = Math.max(30, Math.min(255, Math.round((averageVolume / 180)*255)));

	const now = Date.now();
	if(now - lastSendTimestamp > 2500) {
		if(Math.abs(targetBrightness - lastSentBrightness) > 10) {
			brightnessSlider.value = targetBrightness;
			updateBrightnessLabel(targetBrightness);

			ambientGlow(currentActiveMode !== '' ? currentActiveMode : colorPicker.color.hexString);
			
			sendToLamp(BRIGHTNESS_FEED, targetBrightness);

			lastSentBrightness = targetBrightness;
			lastSendTimestamp = now;
	}
}
	micAnimationLoop = requestAnimationFrame(processAudioFrame);
}

if(micToggleBtn) {
	micToggleBtn.addEventListener ('click', () => {
		if(!isPowerOn) {
			alert("oh say (we can't see 💔)");
			return;
		}
	if(currentActiveMode !== '') {
		alert("sound mode only works with the color wheel!");
		return;
	}

	if(isMicActive) {
		stopAudioProcessing();
	}else{
		startAudioProcessing();
		}
	});
}







