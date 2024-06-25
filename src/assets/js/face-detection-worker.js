importScripts('../../../assets/js/faceEnvWorkerPatch.js'); 
importScripts('../../../assets/js/face-api.min.js'); 

let model;

let selected_face_detector = 'tiny_face_detector'; //'ssd_mobilenetv1';
let scoreThreshold = 0.5;
const minConfidence = 0.05; // expression


var loaded_models = [];
var selected_use = 'face'; // can be changed with a command from the main script.

faceapi_worker_loaded = false;
beauty_worker_loaded = false;
ethnicity_worker_loaded = false;


onmessage = async function(incoming) {
	
	if(incoming.data.type === 'detect'){
		//console.log('worker>', 'detect');
		use(incoming.data)
	}
	else if(incoming.data.type === "loadModels"){

		await Promise.all([
			faceapi.nets.tinyFaceDetector.loadFromUri('../weights'),
			faceapi.nets.faceLandmark68Net.loadFromUri('../weights'),
			faceapi.nets.faceRecognitionNet.loadFromUri('../weights'),
		]).then(() => self.postMessage({ type: 'loadedComplete'}));

	}
}

async function use(data){
	//console.log('worker> use', data);

	try {
		// props is the message from the main thread
		const imgData = new ImageData(
			new Uint8ClampedArray(data.data),
			data.width,
			data.height
		);

		// Create a canvas from our rgbaBuffer
		const img = faceapi.createCanvasFromMedia(imgData);
		const inputSize = data.inputSize;
		
		//detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold })).withFaceLandmarks();
		detections = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold })).withFaceLandmarks();

		data_process = await handleFaceDetection(detections, data.width, data.height, data.isMobile, data.ventanaTamaño, data.inclinacionMaxima, data.tamañoRelativoXHistorial, data.tamañoRelativoYHistorial);
		
		postMessage({ type: 'faceDetectionResult', data: data_process, initTime: data.initTime });
	} catch (e){
		error = "Failed to do something exceptional";
		if (e instanceof Error) {
			error = e.message;
		}
		postMessage({ type: 'error', error: error });
	} finally {
		//console.log('worker> use - finishied');
	}
}

async function validateFaceInOval(faceX, faceY, faceWidth, faceHeight, canvasWidth, canvasHeight) {
	const lineWidth = 2;
	const desiredHeightReduction = 0.08;
	const baseVerticalRadius = (canvasHeight - lineWidth) / 2;
	const verticalRadius = baseVerticalRadius * (1 - desiredHeightReduction);
	const horizontalRadius = verticalRadius / 1.5;

	const centerX = canvasWidth / 2;
	const centerY = canvasHeight / 2;

    // Calculate the center of the face
    const faceCenterX = faceX + faceWidth / 2;
    const faceCenterY = faceY + faceHeight / 2;

    // Normalize the coordinates with respect to the ellipse
    const normalizedX = (faceCenterX - centerX) / horizontalRadius;
    const normalizedY = (faceCenterY - centerY) / verticalRadius;

    // Check if the normalized coordinates are within the unit circle
    const isWithinOval = (normalizedX * normalizedX) + (normalizedY * normalizedY) <= 1;

	return isWithinOval;
}

async function handleFaceDetection(detections, width, height, isMobile, ventanaTamaño, inclinacionMaxima, tamañoRelativoXHistorial, tamañoRelativoYHistorial) {
  
	let color = 'white';
	let message = 'Cara no detectada';
	let position = '';
  
	let data_process = {
	}
	
	if (detections){

		color = 'red';

		const detection = detections;
		const landmarks = detections.landmarks;

		const box = detection.alignedRect._box;

		const faceX= box._x;
		const faceY = box._y;
		const faceWidth = box._width;
		const faceHeight = box._height;

		const isInOval = await validateFaceInOval(faceX, faceY, faceWidth, faceHeight, width, height);

		if (!isInOval){
			message = 'Cara no centrada';
		} else {
			
			const inclinacion = calcularInclinacionOjos(landmarks);

			const menorDimension = Math.min(width, height);
			const tamañoRelativoX = detection.detection._box._width / menorDimension;
			const tamañoRelativoY = detection.detection._box._height / menorDimension;

			tamañoRelativoXHistorial.push(tamañoRelativoX);
			tamañoRelativoYHistorial.push(tamañoRelativoY);

			let extra = isMobile ? 0.25 : 0;

			const tamañoMinimoUmbralX = 0.45 + extra;
			const tamañoMaximoUmbralX = 0.57 + extra;
			const tamañoMinimoUmbralY = 0.45 + extra;
			const tamañoMaximoUmbralY = 0.57 + extra;

			if (tamañoRelativoXHistorial.length > ventanaTamaño) {
			tamañoRelativoXHistorial.shift();
			}
			if (tamañoRelativoYHistorial.length > ventanaTamaño) {
			tamañoRelativoYHistorial.shift();
			}

			const promedioTamañoRelativoX = tamañoRelativoXHistorial.reduce((a, b) => a + b, 0) / tamañoRelativoXHistorial.length;
			const promedioTamañoRelativoY = tamañoRelativoYHistorial.reduce((a, b) => a + b, 0) / tamañoRelativoYHistorial.length;

			if (inclinacion >= inclinacionMaxima) {
				message = 'Cara no recta';
			} else {

				position = `(${tamañoRelativoX}, ${tamañoRelativoY})`;

				if (promedioTamañoRelativoX < tamañoMinimoUmbralX && promedioTamañoRelativoY < tamañoMinimoUmbralY) {
					message = 'Acerquese';
				} else if (promedioTamañoRelativoX > tamañoMaximoUmbralX && promedioTamañoRelativoY > tamañoMaximoUmbralY) {
					message = 'Alejese';
				} else {
					message = 'No se mueva';
					color = 'green';
				}
			}
			
		}

	}
	
	data_process = { message: message, color: color, position: position };
	
	
	return data_process;
  }
  
  function calcularInclinacionOjos(landmarks) {
	const leftEyeBrow = landmarks.getLeftEyeBrow(); // Puntos 17 a 21 para la ceja izquierda
	const rightEyeBrow = landmarks.getRightEyeBrow(); // Puntos 22 a 26 para la ceja derecha
  
	const deltaX = rightEyeBrow[0]._x - leftEyeBrow[0]._x;
	const deltaY = rightEyeBrow[0]._y - leftEyeBrow[0]._y;
  
	const inclinacionRad = Math.atan2(deltaY, deltaX);
	const inclinacionGrados = Math.abs((inclinacionRad * 180) / Math.PI);
  
	return inclinacionGrados;
  }
  