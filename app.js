let isPowerOn = false;
let currentActiveMode= '';
let lastSelectedHex= '#ffffff';


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
]
});



//function to do brightness math

function updateBrightnessLabel(rawValue) {
const percentage = Math.round((rawValue/255)*100);
brightnessPct.textContent = `${percentage}%`;
}

function ambientGlow(hexColor){
if(!isPowerOn){
document.documentElement.style.setProperty('--accent-glow', 'rgba(0, 0, 0, 0)');
return;
}

requestAnimationFrame(() => {

const currentRawBrightness= parseInt(brightnessSlider.value, 10) || 0;
const dynamicOpacity = (currentRawBrightness/ 255).toFixed(2);

if(hexColor && hexColor.startsWith('#')){
let fullHex= hexColor;
if(hexColor.length === 4){
fullHex = "#" + hexColor[1] + hexColor[1] + hexColor[2] + hexColor[2] + hexColor[3] + hexColor[3];
}
const r = parseInt(fullHex.slice(1, 3), 16);
const g = parseInt(fullHex.slice(3, 5), 16);
const b = parseInt(fullHex.slice(5, 7), 16);

document.documentElement.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, ${dynamicOpacity})`);


}else if(hexColor=== '#BREATHE'){
document.documentElement.style.setProperty('--accent-glow', 'rgba(255, 255, 255, 0.5)');
}else if(hexColor=== '#RAINBOW'){
document.documentElement.style.setProperty('--accent-glow', 'rgba(255, 255, 255, 0.5)');
	}
	});
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

//request most recent data
fetch(brightnessUrl, {
	method: "GET",
	headers: {"X-AIO-Key": AIO_KEY}

})
.then(response => {
	if(!response.ok) throw new Error("Could not pull last brightness");
	return response.json();
})

.then(data => {
if(data.value !== undefined){
const currentBrightness = parseInt(data.value, 10);
console.log(`[Sync] Found last saved brightness: ${currentBrightness}`);
brightnessSlider.value = currentBrightness;

updateBrightnessLabel(currentBrightness);

if(currentBrightness === 0) {
isPowerOn = false;
powerBtn.textContent="ON"
powerBtn.style.backgroundColor = "#000000";
powerBtn.style.color = "#ffffff";

}else{
isPowerOn = true;
powerBtn.textContent="OFF"
powerBtn.style.backgroundColor= "#ffffff";
powerBtn.style.color = "#000000";
	}
}
})
.catch(error => console.error("[Brightness Sync Error]:", error));


//request most recent data
fetch(colorUrl, {
	method: "GET",
	headers: {"X-AIO-Key": AIO_KEY}

})
.then(response => {
	if(!response.ok) throw new Error("Could not pull last color");
	return response.json();
})
.then(data => {
	if (data.value) {
	console.log(`[Sync] Found last color: ${data.value}`);
	
	if(data.value === '#BREATHE'){
		currentActiveMode='BREATHE';
	if(breatheBtn){
		breatheBtn.style.backgroundColor = "#ffffff";
		breatheBtn.style.color = "#000000"
	}

	ambientGlow(data.value);
	}else if(data.value === '#RAINBOW'){
	currentActiveMode ='RAINBOW';
	if(rainbowBtn){
	rainbowBtn.style.backgroundColor= "#ffffff";
	rainbowBtn.style.color= "#000000";
	}
	ambientGlow(data.value);
	

	} else if (data.value.startsWith('#')){
	currentActiveMode='';
	lastSelectedHex= data.value;
	
	if(colorPicker) {
		colorPicker.color.hexString = data.value;
	}
ambientGlow(data.value);
}
}
})
.catch(error => console.error("[Sync Error]:", error))
}

const timerUrl= `https://io.adafruit.com/api/v2/${AIO_USERNAME}/feeds/${TIMER_FEED}/data/last`;

fetch(timerUrl, {
	method: "GET",
	headers: {"X-AIO-Key": AIO_KEY}
})
.then(response => {
	if(!response.ok) throw new Error("Could not pull last timer data");
	return response.json();
	
})

.then(data => {
	if(data.value && data.value !=="0") {
	const cloudTarget = parseInt(data.value, 10);
	const currentEpoch= Math.floor(Date.now() / 1000);
	
	if(cloudTarget > currentEpoch) {
	console.log(`[Sync] Active cloud timer discovered! Syncing countdown...`);
	startLocalCountdown(cloudTarget);
	
}else{
	clearLocalCountdown();
}


}else{
	clearLocalCountdown();
}
})
.catch(error => console.error("[Timer Sync Error]:", error));
	
	
	
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

//restore light
const numericBrightness = parseInt(brightnessSlider.value, 10);
sendToLamp(BRIGHTNESS_FEED, numericBrightness);
ambientGlow(colorPicker.color.hexString);

}else{
powerBtn.textContent = "ON";
powerBtn.style.backgroundColor= "#000000";
powerBtn.style.color= "#ffffff";
sendToLamp(BRIGHTNESS_FEED, 0);
ambientGlow('rgba(0,0,0,0)');
}

});

//brightness slider
brightnessSlider.addEventListener('input', () => {
updateBrightnessLabel(brightnessSlider.value);
if(currentActiveMode !==''){
	ambientGlow(currentActiveMode);
}else{
	ambientGlow(colorPicker.color.hexString);
}
});


brightnessSlider.addEventListener('change', () => {

if(isPowerOn){
const currentVal= parseInt(brightnessSlider.value, 10);
console.log(`[UI] Brightness slider updated to: ${currentVal}`);

//send it

sendToLamp(BRIGHTNESS_FEED, currentVal);
}else{
console.log("[UI] Ignored slider update: Power is off");
}
}); 

//color.macro buttons and listeners for color wheel

document.querySelectorAll('.color-macro').forEach(button => {
	button.addEventListener('click', () => {
//send hex from specific hardcoded button
	const hexColor = button.getAttribute('data-hex');
	console.log(`[UI] Color preset: ${hexColor}`)
	lastSelectedHex=hexColor;
	currentActiveMode='';
	sendToLamp(COLOR_FEED, hexColor);
	colorPicker.color.hexString = hexColor;
	resetModes();
	ambientGlow(hexColor);
	});


});

const breatheBtn = document.getElementById('breathe');
const rainbowBtn = document.getElementById('rainbow');

if(breatheBtn) {
breatheBtn.addEventListener('click', () => {

if(currentActiveMode === 'BREATHE'){
console.log("[UI]: Turning BREATHE off while active");
	currentActiveMode='';
	sendToLamp(COLOR_FEED, lastSelectedHex);
	colorPicker.color.hexString= lastSelectedHex;
	resetModes();
	ambientGlow(lastSelectedHex);
}else{
	
console.log("[UI] Mode clicked: PEAK");
currentActiveMode='BREATHE';
sendToLamp(COLOR_FEED, "#BREATHE");
breatheBtn.style.backgroundColor= "#ffffff";
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
if(currentActiveMode === 'RAINBOW'){
console.log("[UI]: Turning RAINBOW off while active");
	currentActiveMode='';
	sendToLamp(COLOR_FEED, lastSelectedHex);
	colorPicker.color.hexString= lastSelectedHex;
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
	const selectedHex = color.hexString;
	console.log(`[UI] Color sent: ${selectedHex}`);
	lastSelectedHex= selectedHex;
	currentActiveMode= '';
	
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
}, 400);

}else{
settingsCard.style.display= 'none';
controlsWrapper.style.display= 'flex';
syncWithCloud();
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
	timerCountdownDisplay.style.display = "block";
	

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
	timerCountdownDisplay.style.display= "none";
	
	document.querySelectorAll('.timer-segment').forEach((p, idx) => {
		p.style.background = idx ===0? "#ffffff" : "#2c2c2e";
		p.style.color = idx ===0? "#000000" : "#ffffff";
});
selectedDurationMinutes= 15;

}

		


function handleTimerComplete() {
	console.log("[Timer] Synced countdown at zero. Shutting down...");
	clearLocalCountdown();
	
	isPowerOn= false;
	if(powerBtn) {
		powerBtn.textContent= "ON";
		powerBtn.style.backgroundColor = "#000000";
		powerBtn.style.color = "#ffffff";
}
	ambientGlow('rgba(0, 0, 0, 0)');
	
	if(targetEpochSeconds > 0) {
		sendToLamp(BRIGHTNESS_FEED, 0);
}
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


	const currentEpochSeconds = Math.floor(Date.now()/ 1000);
	const runtimeSeconds= selectedDurationMinutes * 60;
	const finalTargetTime = currentEpochSeconds+runtimeSeconds;

	console.log(`[Timer] Publishing target timestamp ${finalTargetTime} to feed...`);
	sendToLamp(TIMER_FEED, finalTargetTime);
	startLocalCountdown(finalTargetTime);
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



