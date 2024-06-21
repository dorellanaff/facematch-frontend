/// <reference lib="webworker" />

import { Any } from '@tensorflow/tfjs-core';
import * as faceapi from 'face-api.js';

import '../../../assets/js/faceEnvWorkerPatch.js';




addEventListener('message', async ({ data }) => {
  const { action } = data;

  const data_process = {
    action: 'error', error: 'Error', data: {}
  }

  if (action === 'detectFaces') {
    const { action, detections, width, height, isMobile, ventanaTamaño, inclinacionMaxima, tamañoRelativoXHistorial, tamañoRelativoYHistorial } = data;

    try {

      data_process.data = await handleFaceDetection(detections, width, height, isMobile, ventanaTamaño, inclinacionMaxima, tamañoRelativoXHistorial, tamañoRelativoYHistorial);
      data_process.action = 'faceDetectionResult';

    } catch (error) {
      let errorMessage = "Failed to do something exceptional";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      data_process.error = errorMessage;

    } finally {
      postMessage({ data: data_process});
    }

  }

});

async function handleFaceDetection(detections: any, width: number, height: number, isMobile: boolean, ventanaTamaño: number, inclinacionMaxima: number, tamañoRelativoXHistorial: number[], tamañoRelativoYHistorial: number[]) {
  
  let color = 'red';

  let data_process = {
  }
  
  if (detections) {
    const detection = detections;

    const landmarks = detection.landmarks._positions;
    const inclinacion = calcularInclinacionOjos(landmarks);

    const menorDimension = Math.min(width, height);
    const tamañoRelativoX = detection.detection._box._width / menorDimension;
    const tamañoRelativoY = detection.detection._box._height / menorDimension;

    tamañoRelativoXHistorial.push(tamañoRelativoX);
    tamañoRelativoYHistorial.push(tamañoRelativoY);

    let extra = isMobile ? 0.20 : 0;

    const tamañoMinimoUmbralX = 0.42 + extra;
    const tamañoMaximoUmbralX = 0.55 + extra;
    const tamañoMinimoUmbralY = 0.42 + extra;
    const tamañoMaximoUmbralY = 0.55 + extra;

    if (tamañoRelativoXHistorial.length > ventanaTamaño) {
      tamañoRelativoXHistorial.shift();
    }
    if (tamañoRelativoYHistorial.length > ventanaTamaño) {
      tamañoRelativoYHistorial.shift();
    }

    const promedioTamañoRelativoX = tamañoRelativoXHistorial.reduce((a, b) => a + b, 0) / tamañoRelativoXHistorial.length;
    const promedioTamañoRelativoY = tamañoRelativoYHistorial.reduce((a, b) => a + b, 0) / tamañoRelativoYHistorial.length;

    // console.log(promedioTamañoRelativoX, promedioTamañoRelativoY);

    let message = '';

    if (inclinacion >= inclinacionMaxima) {
      message = 'Cara no recta';
    } else {
      if (promedioTamañoRelativoX < tamañoMinimoUmbralX || promedioTamañoRelativoY < tamañoMinimoUmbralY) {
        message = 'Acerquese';
      } else if (promedioTamañoRelativoX > tamañoMaximoUmbralX || promedioTamañoRelativoY > tamañoMaximoUmbralY) {
        message = 'Alejese';
      } else {
        message = 'No se mueva';
        color = 'green';
      }
    }

    data_process = { message: message, color: color };

  } else {
    data_process = { message: 'Cara no detectada', color: color };
  }
  
  return data_process;
}

function calcularInclinacionOjos(landmarks: any) {
  const leftEyeBrow = landmarks.slice(17, 22); // Puntos 17 a 21 para la ceja izquierda
  const rightEyeBrow = landmarks.slice(22, 27); // Puntos 22 a 26 para la ceja derecha

  const deltaX = rightEyeBrow[0]._x - leftEyeBrow[0]._x;
  const deltaY = rightEyeBrow[0]._y - leftEyeBrow[0]._y;

  const inclinacionRad = Math.atan2(deltaY, deltaX);
  const inclinacionGrados = Math.abs((inclinacionRad * 180) / Math.PI);

  return inclinacionGrados;
}
