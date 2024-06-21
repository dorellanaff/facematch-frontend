importScripts('../../../assets/js/faceEnvWorkerPatch.js'); 
importScripts('../../../assets/js/face-api.min.js'); 

let model;
var detector_options;

let selected_face_detector = 'tiny_face_detector'; //'ssd_mobilenetv1';
let inputSize = 512
let scoreThreshold = 0.5
const minConfidence = 0.05; // expression


var loaded_models = [];
var selected_use = 'face'; // can be changed with a command from the main script.

faceapi_worker_loaded = false;
beauty_worker_loaded = false;
ethnicity_worker_loaded = false;


async function load_mobile_net() {
    try{
        await faceapi.nets.ssdMobilenetv1.load('../weights/');
        console.log("loaded mobilenet face detection");
		detector_options = getFaceDetectorOptions();
    }
    catch(e){console.log(e);}
}


async function load_tiny_net() {
    try{
        await faceapi.nets.tinyFaceDetector.load('../weights/');
        console.log("loaded tiny face detection");
		detector_options = getFaceDetectorOptions();
    }
    catch(e){console.log(e);}
	postMessage({'loaded':'tiny'});
}


async function load_age_and_gender() {
    try{
        await faceapi.nets.ageGenderNet.load('../weights/'); // gender
        console.log("loaded age and gender detection model");
    }
    catch(e){console.log(e);}
}


async function load_landmarks() {
    try{
        await faceapi.loadFaceLandmarkModel('../weights/'); // landmarks
        console.log("loaded landmark detection model");
    }
    catch(e){console.log(e);}
}


async function load_expression() {
    try{
        await faceapi.loadFaceExpressionModel('../weights/'); // expression
        console.log("loaded expression detection model");
    }
    catch(e){console.log(e);}    
}


async function load_recognition() {
    try{
        await faceapi.loadFaceRecognitionModel('../weights/') // face vectors
        console.log("loaded face recognition detection model");
    }
    catch(e){console.log(e);}     
}

function getCurrentFaceDetectionNet() {
  if (selected_face_detector === SSD_MOBILENETV1) {
    return faceapi.nets.ssdMobilenetv1
  }
  if (selected_face_detector === TINY_FACE_DETECTOR) {
    return faceapi.nets.tinyFaceDetector
  }
}

function getFaceDetectorOptions() {
    //new faceapi.SsdMobilenetv1Options({ minConfidence });
	if(selected_face_detector == 'tiny_face_detector'){
    	return new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold });
	}
	else{
		return new faceapi.SsdMobilenetv1Options({ minConfidence });
	}
}


onmessage = function(incoming) {
 	//console.log('Message received from main script:');
  	//console.log(incoming.data);
	
  	var return_message = '';
	
	if(incoming.data.type == 'frame'){
		//console.log("worker: incoming frame");
		use(selected_use, incoming.data)
	}
	//else if(Array.isArray(incoming.data)){
	else {	
		
		//console.log("worker: incoming init message");
		
		if(incoming.data.net !== undefined){
			if(incoming.data.net == 'tiny'){
				selected_face_detector = 'tiny_face_detector';
				load_tiny_net();
				console.log("worker: loading tiny face net");
			}
			else if(incoming.data.net == 'mobilenet'){
				selected_face_detector = 'ssd_mobilenetv1';
				load_mobile_net();
				console.log("worker: loading mobile face net");
			}
			//postMessage('net loaded');
		}
		
		if(incoming.data.load !== undefined){
			incoming.data.load.forEach(function (item, index) {
			  //console.log("loading model:");
			  //console.log(index, item);
			  if(item == 'age_and_gender'){ 
				  load_age_and_gender(); 
				  console.log('loading age and gender model');
			  }
			  if(item == 'expression'){ 
				  load_expression(); 
				  console.log('loading expression model');
			  }
			  if(item == 'recognition'){ 
				  load_recognition(); 
				  console.log('loading face recognition model');
			  }
			  if(item == 'landmarks'){ 
				  load_landmarks(); 
				  console.log('loading landmarks model');
			  }
			  //console.log('loading ' + item);
			  //postMessage("loaded");
			});
		}
		
		
		if(incoming.data.use !== undefined){
			selected_use = incoming.data.use;
			console.log("selected_use is now set to " + selected_use);
			
		}
		
	}
}



async function use(use_case, image_data){

	//console.log("in worker USE. use_case = " + use_case + ", imagedata:");
	console.log(image_data);
	// props is the message from the main thread
	const imgData = new ImageData(
	   new Uint8ClampedArray(image_data.data),
	    image_data.width,
	    image_data.height
	);

	console.log(imgData);

	// Create a canvas from our rgbaBuffer
	const img = faceapi.createCanvasFromMedia(imgData);

	//const results = await faceapi.detectAllFaces(img, this.faceDetectorOptions)

	var result = {};
	if(use_case == 'face'){ 
		result = await faceapi.detectSingleFace(img, detector_options);
	}
	else if(use_case == 'landmarks'){
		result = await faceapi.detectSingleFace(img, detector_options).withFaceLandmarks();
		
		try {
			const jawOutline = result.landmarks.getJawOutline();
			const nose = result.landmarks.getNose();
			const mouth = result.landmarks.getMouth();
			const leftEye = result.landmarks.getLeftEye();
			const rightEye = result.landmarks.getRightEye();
			const leftEyeBrow = result.landmarks.getLeftEyeBrow();
			const rightEyeBrow = result.landmarks.getRightEyeBrow();
			postMessage({
				"landmarks":result.landmarks.positions,
				"jawOutline":jawOutline,
				"nose":nose,
				"mouth":mouth,
				"leftEye":leftEye,
				"rightEye":rightEye,
				"leftEyeBrow":leftEyeBrow,
				"rightEyeBrow":rightEyeBrow,
				"faceparts":true
			});
		}
		catch (e) {
			postMessage({"faceparts":false});
		}
		
	}
	else if(use_case == 'age_and_gender'){
		result = await faceapi.detectSingleFace(img, detector_options).withFaceLandmarks().withAgeAndGender();
	}
	else if(use_case == 'expression'){
		result = await faceapi.detectSingleFace(img, detector_options).withFaceLandmarks().withFaceExpressions()
	}
	else if(use_case == 'recognition'){
		result = await faceapi.detectSingleFace(img, detector_options).withFaceLandmarks().withFaceDescriptor();
	}
	else if(use_case == 'all'){
		result = await faceapi.detectSingleFace(img, detector_options).withFaceLandmarks().withFaceExpressions().withAgeAndGender().withFaceDescriptor();
		console.log("use case all result was: ");
		console.log(result);
	}
	else{
		console.log("Error: no fitting use case provided");
		postMessage({"error":"selected use does not exist"});
	}
	
	if( result === undefined){
		result = {'error':'result undefined'};
	}
	postMessage(result);
}