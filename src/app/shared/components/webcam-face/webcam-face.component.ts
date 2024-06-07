import * as faceapi from 'face-api.js';
import { Component, Output, EventEmitter, OnChanges, AfterViewInit, ElementRef, ViewChild, HostListener, OnInit, input, Input, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FacematchService } from '../../../core/services/facematch.service';

@Component({
  selector: 'app-webcam-face',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './webcam-face.component.html',
  styleUrl: './webcam-face.component.scss'
})
export class WebcamFaceComponent implements OnChanges, AfterViewInit { //AfterViewInit
  @Input() isModalOpen: boolean = false;
  @Output() close = new EventEmitter<void>();
  @ViewChild('canvas') canvasElement!: ElementRef;
  @ViewChild('video') videoElement!: ElementRef;
  @ViewChild('videoContainer') videoContainerElement!: ElementRef<HTMLDivElement>;
  private videoStream!: MediaStream | null;
  private listPhotos: string[] = [];

  // Define un margen de tolerancia para la posición y la inclinación de la cara
  centradoTolerancia = 0.1; // 10% de margen de error en la posición centrada
  inclinacionMaxima = 10; // Ángulo máximo de inclinación permitido en grados

  interval: any;
  isTakingPhoto: boolean = false;
  private context!: CanvasRenderingContext2D;
  private color: string = 'red';
  private message: string = '';
  private displaySize: { width: number, height: number } = { width: 0, height: 0 };

  videoLoaded: boolean = false;
  photoTaken: boolean = false;

  constructor(private facematchService: FacematchService) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isModalOpen'] && changes['isModalOpen'].currentValue === true) {
      this.initFace();
    }
  }

  async ngAfterViewInit(): Promise<void> {
    this.context = this.canvasElement.nativeElement.getContext('2d')!;
  }

  async initFace() {

    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('assets/weights/'),
      faceapi.nets.faceLandmark68Net.loadFromUri('assets/weights/'),
      faceapi.nets.faceRecognitionNet.loadFromUri('assets/weights/')
    ]);

    this.startVideo();
  }

  @HostListener('window:resize')
  onResize() {

    let videoHeight = this.videoElement.nativeElement.height + 20;
    this.videoContainerElement.nativeElement.style.maxHeight = `${videoHeight}px`;

    this.resizeCanvas();
    this.drawCircle();
    
  }

  private resizeCanvas() {
    const container = this.videoElement.nativeElement!;
    this.canvasElement.nativeElement.width = container.clientWidth;
    this.canvasElement.nativeElement.height = container.clientHeight;

    let videoHeight = container.clientHeight + 100;
    this.videoContainerElement.nativeElement.style.maxHeight = `${videoHeight}px`;
  }

  private drawCircle() {
    const canvas = this.canvasElement.nativeElement;
    const circleRadius = Math.min(canvas.width, canvas.height) / 2;
    const circleX = canvas.width / 2;
    const circleY = canvas.height / 2;
    this.context.clearRect(0, 0, canvas.width, canvas.height);
    this.context.beginPath();
    this.context.arc(circleX, circleY, circleRadius, 0, 2 * Math.PI);
    this.context.lineWidth = 20;
    this.context.strokeStyle = this.color;


    // Establecer el estilo de fuente y color
    this.context.font = '30px Arial';
    this.context.fillStyle = 'yellow';
    // Escribir texto en el canvas
    this.context.fillText(this.message, 240, 100);

    this.context.stroke();
  }
  
  async startVideo() {
    const video = this.videoElement.nativeElement;
    // const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
    this.videoStream = await navigator.mediaDevices.getUserMedia({ video: {} });
    video.srcObject = this.videoStream;

    video.addEventListener('loadeddata', () => this.onVideoLoaded());
  }

  private onVideoLoaded() {
        
    this.resizeCanvas();
    this.drawCircle();
    this.interval = setInterval(() => this.detectFaces(), 100);
  }

  private calcularInclinacionOjos(landmarks: faceapi.FaceLandmarks68) {
    const ojoIzquierdo = landmarks.getLeftEyeBrow();
    const ojoDerecho = landmarks.getRightEyeBrow();
  
    const deltaX = ojoDerecho[0].x - ojoIzquierdo[0].x;
    const deltaY = ojoDerecho[0].y - ojoIzquierdo[0].y;
  
    const inclinacionRad = Math.atan2(deltaY, deltaX);
    const inclinacionGrados = Math.abs((inclinacionRad * 180) / Math.PI);
  
    return inclinacionGrados;
  }
  
  private async detectFaces() {

    if ( true ){

      const video = this.videoElement.nativeElement;
      const canvas = this.canvasElement.nativeElement;
      this.displaySize = { width: video.videoWidth, height: video.videoHeight };

      faceapi.matchDimensions(canvas, this.displaySize);

      const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();
      //const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
      
      this.color = 'red';
      if (detections.length === 1) {
        const detection = detections[0];

        if (this.isFaceInsideCircle(detection, canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) / 2)){
          
          const landmarks = detection.landmarks;
          const inclinacion = this.calcularInclinacionOjos(landmarks);

          if (inclinacion >= this.inclinacionMaxima) {
            console.log('La cara no está recta.');
            this.message = 'Cara no recta';
          } else {

            // Calcular el tamaño relativo de la cara en el canvas
            const tamañoRelativoX = detection.detection.box.width / (canvas.width / 2);
            const tamañoRelativoY = detection.detection.box.height / (canvas.height / 2);

            // Definir los umbrales mínimo y máximo de tamaño para x e y
            const tamañoMinimoUmbralX = 0.70;
            const tamañoMaximoUmbralX = 0.95;
            const tamañoMinimoUmbralY = 0.85;
            const tamañoMaximoUmbralY = 1.20;

            // Verificar si el tamaño de la cara está dentro de los rangos adecuados
            if (tamañoRelativoX < tamañoMinimoUmbralX || tamañoRelativoY < tamañoMinimoUmbralY) {
              this.message = 'Acerquese';
            } else if (tamañoRelativoX > tamañoMaximoUmbralX || tamañoRelativoY > tamañoMaximoUmbralY) {
              this.message = 'Alejese';
            } else {
              this.message = 'No se mueva';
              this.color = 'green';
            }

          }

        }
        //this.getPhoto();
      } else if (detections.length > 1) {
        this.message = 'Muchas caras'
      } else {
        this.message = 'Cara no detectada';
      }
      this.drawCircle();
    
    }
    
  }

  private isFaceInsideCircle(detection: any, circleX: number, circleY: number, radius: number): boolean {
    const box = detection.detection.box;
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    const distance = Math.sqrt(Math.pow(centerX - circleX, 2) + Math.pow(centerY - circleY, 2));

    return distance <= radius;
  }

  takePhoto() {
    this.listPhotos.shift();
    this.getPhoto();

    // Detiene la reproducción del video
    // this.videoElement.nativeElement.pause();

    if (this.interval) {
      clearInterval(this.interval); // Stop face detection interval
    }

    const url = 'https://18.207.149.37:8080/predict'

    this.uploadImage(url, this.listPhotos[0])

    //if (this.color === 'green'){
    //  this.animateCircleColor();
    //}
    
  }

  uploadImage(url: string, image: string) {
    this.facematchService.uploadImage(url, image)
      .subscribe(
        response => {
          console.log('Imagen subida exitosamente:', response);
          alert(response.message);
        },
        error => {
          console.error('Error al subir la imagen:', error);
          alert(error.error.message ?? 'Error al subir la imagen')
        }
      );
  }

  getPhoto(){
    // Captura el fotograma actual del video
    const canvas = document.createElement('canvas');
    canvas.width = this.videoElement.nativeElement.videoWidth;
    canvas.height = this.videoElement.nativeElement.videoHeight;
    canvas.getContext('2d')!.drawImage(this.videoElement.nativeElement, 0, 0, canvas.width, canvas.height);
    const imgData = canvas.toDataURL('image/png');

    if (this.listPhotos.length > 2){
      this.listPhotos.shift()
    }
    this.listPhotos.push(imgData);
    
    this.appendImageToBody(imgData);
    
  }

  private appendImageToBody(imgData: string) {
      // Crear un elemento de imagen
      const imgElement = document.createElement('img');
      // Establecer el src de la imagen como la imagen capturada
      imgElement.src = imgData;
      // Agregar la imagen al final del body
      document.body.appendChild(imgElement);
  }

  closeModal() {
    if (this.interval) {
      clearInterval(this.interval); // Stop face detection interval
    }
    this.stopVideo();
    this.close.emit();
  }

  stopVideo() {
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null; // Liberar la referencia
    }
  }

  private animateCircleColor() {
    const canvas = this.canvasElement.nativeElement;
    const circleRadius = Math.min(canvas.width, canvas.height) / 2;
    const circleX = canvas.width / 2;
    const circleY = canvas.height / 2;
    const animationDuration = 5000; // Duración de la animación en milisegundos
    const framesPerSecond = 60; // Cuadros por segundo (FPS)
    const totalFrames = animationDuration / (1000 / framesPerSecond); // Número total de cuadros
    const purpleHue = 280; // Matiz de púrpura
    const lineWidth = 20; // Ancho del borde del círculo

    let currentFrame = 0;

    const colorAnimationInterval = setInterval(() => {
        // Calcula el ángulo actual basado en el número de cuadros
        const currentAngle = (360 / totalFrames) * currentFrame;

        // Limpia el lienzo
        this.context.clearRect(0, 0, canvas.width, canvas.height);

        // Dibuja el círculo con el color púrpura
        this.context.beginPath();
        this.context.arc(circleX, circleY, circleRadius, -Math.PI / 2, (currentAngle * Math.PI) / 180 - Math.PI / 2);
        this.context.lineWidth = lineWidth;
        this.context.strokeStyle = `hsl(${purpleHue}, 100%, 50%)`;
        this.context.stroke();

        currentFrame++;

        // Si la animación ha terminado, detén el intervalo
        if (currentFrame > totalFrames) {
          this.photoTaken = true;
          clearInterval(colorAnimationInterval);
          this.stopVideo();

          console.log(this.listPhotos);
        }
    }, 1000 / framesPerSecond);
  }

  onVideoLoad() {
    this.videoLoaded = true;
  }

  
}

