import * as faceapi from 'face-api.js';
import { Component, Output, EventEmitter, OnChanges, AfterViewInit, ElementRef, ViewChild, HostListener, OnInit, input, Input, SimpleChanges, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FacematchService } from '../../../core/services/facematch.service';
import { DeviceDetectorService } from 'ngx-device-detector';
import { ActivatedRoute } from '@angular/router';
import { FaceDetectionWorkerService } from '../../../core/services/face-detection-worker.service'
import { Any } from '@tensorflow/tfjs-core';

@Component({
  selector: 'app-webcam-face',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './webcam-face.component.html',
  styleUrl: './webcam-face.component.scss'
})
export class WebcamFaceComponent implements OnInit, AfterViewInit { //AfterViewInit
  @Input() isModalOpen: boolean = false;
  @Output() close = new EventEmitter<void>();
  @ViewChild('canvas') canvasElement!: ElementRef;
  @ViewChild('video') videoElement!: ElementRef;
  @ViewChild('videoContainer') videoContainerElement!: ElementRef<HTMLDivElement>;

  private worker!: Worker;

  // Define un margen de tolerancia para la posición y la inclinación de la cara
  tamañoRelativoXHistorial: number[] = [];
  tamañoRelativoYHistorial: number[] = [];
  ventanaTamaño: number = 5;
  inclinacionMaxima: number = 10; // Ángulo máximo de inclinación permitido en grados
  isMobile: boolean = false;
  color: string = 'red';
  message: string = 'Cara no detectada';
  position: string = '';

  private videoStream!: MediaStream | null;
  private listPhotos: string[] = [];
  private interval: any;
  private isProcessing: boolean = false;
  private context!: CanvasRenderingContext2D;
  
  isTakingPhoto: boolean = false;
  colorCanvas: string = '#FF0000'; // Color del círculo
  backgroundColorCanvas: string = '#FFFFFF'; // Color del fondo fuera del círculo

  private displaySize: { width: number, height: number } = { width: 0, height: 0 };

  public resultCheck: boolean = false;
  public resultMessageLiveness: string = '';
  public resultMessageMatchFace: string = '';

  public videoLoaded: boolean = false;
  public photoTaken: boolean = false;
  public idFace: string | null = null;

  private animationFrameId!: number;

  constructor(
    private facematchService: FacematchService,
    private deviceService: DeviceDetectorService,
    private route: ActivatedRoute,
    private faceDetectionWorkerService: FaceDetectionWorkerService
  ) { 
    this.isMobile = this.deviceService.isMobile();
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker(new URL('../../../core/workers/face-detection.worker', import.meta.url));
      
      this.worker.onmessage = ({ data }) => {
        this.handleWorkerMessage(data);
      };

    } else {
      console.log('Web Workers are not supported in this environment.');
    }

  }
  
  // Load the models
  async loadModels() {
    //await faceapi.nets.tinyFaceDetector.loadFromUri('assets/weights');
    //await faceapi.nets.faceLandmark68Net.loadFromUri('assets/weights');
    //await faceapi.nets.faceRecognitionNet.loadFromUri('assets/weights');
    
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('assets/weights'),
      faceapi.nets.faceLandmark68Net.loadFromUri('assets/weights'),
      faceapi.nets.faceRecognitionNet.loadFromUri('assets/weights'),
      //faceapi.nets.faceExpressionNet.loadFromUri('../../assets/models')
    ]).then(() => this.startVideo());
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      this.idFace = params.get('idFace');
      // console.log('idFace:', this.idFace);
    });

    this.loadModels();
    
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.animationFrameId);

    if (this.worker) {
      this.worker.terminate();
    }
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  async ngAfterViewInit(): Promise<void> {
    this.context = this.canvasElement.nativeElement.getContext('2d') as CanvasRenderingContext2D;

    this.startVideo();
  }

  @HostListener('window:resize')
  onResize() {
    //console.log('onResize');

    let videoHeight = this.videoElement.nativeElement.height + 20;
    this.videoContainerElement.nativeElement.style.maxHeight = `${videoHeight}px`;

    this.resizeCanvas();
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

  async startVideo() {
    const video = this.videoElement.nativeElement;
  
    try {
      
      // Establecer las restricciones de video con la resolución máxima
      const constraints = {
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };
      
      // Solicitar el stream de video con las restricciones de resolución máxima
      this.videoStream = await navigator.mediaDevices.getUserMedia(constraints);
      
    } catch (error) {
      console.error('Error accessing the webcam:', error);

      // Obtener el stream de video sin restricciones
      this.videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
    }
    finally {

      if (this.videoStream){
        video.srcObject = this.videoStream;
        video.addEventListener('loadeddata', () => this.onVideoLoaded());
      }
      
    }
  }
  
  private onVideoLoaded() {
        
    this.resizeCanvas();
    this.canvasElement.nativeElement.hidden = false;

    this.videoElement.nativeElement.play();

    this.startAnimation();
    this.interval = setInterval(() => this.detectFaces(), 1000);

  }

  private async detectFaces() {
    if (this.isProcessing) {
      return;
    }
    
    const video = this.videoElement.nativeElement;
    const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();

    this.isProcessing = true;
    
    this.worker.postMessage({
      action: 'detectFaces',
      detections: detections,
      width: video.videoWidth,
      height: video.videoHeight,
      isMobile: this.isMobile,
      ventanaTamaño: this.ventanaTamaño,
      inclinacionMaxima: this.inclinacionMaxima,
      tamañoRelativoXHistorial: this.tamañoRelativoXHistorial,
      tamañoRelativoYHistorial: this.tamañoRelativoYHistorial
    });
    
  }

  private handleWorkerMessage(event: MessageEvent) {
    this.isProcessing = false;
    const data = event.data;

    if (data.action === 'faceDetectionResult') {
      const { message, color } = data.data;

      this.processDetections(message, color);

    } else if (data.action === 'error') {
      console.error(data.error);
    }

  }

  private processDetections(message: string, color: string) {
    this.color = color;
    this.message = message;

    console.log(color, message);

  }

  private isFaceInsideCircle(detection: any, circleX: number, circleY: number, radius: number): boolean {
    const box = detection.detection.box;
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    const distance = Math.sqrt(Math.pow(centerX - circleX, 2) + Math.pow(centerY - circleY, 2));

    return distance <= radius;
  }

  // Anoter functions

  private resizeCanvas() {
    const video = this.videoElement.nativeElement!;
    const videoWidth = video.offsetWidth;
    const videoHeight = video.offsetHeight;
    
    this.canvasElement.nativeElement.width = videoWidth+1;
    this.canvasElement.nativeElement.height = videoHeight+1;

    let videoContaineHeight = videoHeight + 100;
    this.videoContainerElement.nativeElement.style.maxHeight = `${videoContaineHeight}px`;
  }

  public takePhoto() {

    // pruebas
    return;

    if (this.color === 'green'){
      if (this.interval) {
        clearInterval(this.interval); // Stop face detection interval
      }

      cancelAnimationFrame(this.animationFrameId);

      this.listPhotos.shift();
      this.getPhoto();
      
      const url = 'https://192.168.4.123:8080/predict/'
  
      this.checkLiveness(url, this.listPhotos[0]);
  
      // Detiene la reproducción del video
      // this.videoElement.nativeElement.pause();
      this.animateCircleColor();
    }
    
  }

  private checkLiveness(url: string, image: string) {
    this.facematchService.checkLiveness(url, image)
      .subscribe(
        response => {
          console.log('Imagen subida exitosamente:', response);
          let message = `Liveness - ${response.message} - ${response.threshold}`
          this.resultCheck = true;
          this.resultMessageLiveness = message;

          
          const url = 'https://192.168.4.123:8081/validate/'
      
          this.matchFace(url, this.listPhotos[0])

        },
        error => {
          console.error('Error al subir la imagen:', error);
          let message = `Liveness - ${error.error.message ?? 'Error al subir la imagen'} - ${error.error.threshold ?? 0}`
          this.resultCheck = true;
          this.resultMessageLiveness = message;
        }
      );
  }

  private matchFace(url: string, image: string) {
    if (this.idFace == null){
      return;
    }

    this.facematchService.matchFace(url, image, this.idFace)
      .subscribe(
        response => {
          console.log('Imagen subida exitosamente:', response);
          let message = `Match Face - ${response.message} - ${response.threshold}`
          this.resultCheck = true;
          this.resultMessageMatchFace = message;

        },
        error => {
          console.error('Error al subir la imagen:', error);
          let message = `Match Face - ${error.error.message ?? 'Error al subir la imagen'} - ${error.error.threshold ?? 0}`
          this.resultCheck = true;
          this.resultMessageMatchFace = message;
        }
      );
  }

  private getPhoto(){
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
    
    //this.appendImageToBody(imgData);
    
  }

  public closeModal() {
    console.log('closeModal');
    if (this.interval) {
      clearInterval(this.interval); // Stop face detection interval
    }
    this.stopVideo();
    this.close.emit();
  }

  private stopVideo() {
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
    const lineWidth = 14; // Ancho del borde del círculo

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

        }
    }, 1000 / framesPerSecond);
  }

  public onVideoLoad() {
    this.videoLoaded = true;
  }

  private startAnimation() {
    const draw = () => {
      
      const canvas = this.canvasElement.nativeElement;
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      const lineWidth = 8;
      const circleRadius = (Math.min(canvasWidth, canvasHeight) - lineWidth) / 2;
      const circleX = canvasWidth / 2;
      const circleY = canvasHeight / 2;

      // Fill the background with white color
      this.context.fillStyle = this.backgroundColorCanvas;
      this.context.fillRect(0, 0, canvasWidth, canvasHeight);

      // Create a circular clipping path
      this.context.save();
      this.context.beginPath();
      this.context.arc(circleX, circleY, circleRadius, 0, 2 * Math.PI);
      this.context.clip();

      // Clear the interior of the circle to make it transparent
      this.context.clearRect(circleX - circleRadius, circleY - circleRadius, circleRadius * 2, circleRadius * 2);
      this.context.restore();

      // Draw the circle with red border and transparent fill
      this.context.beginPath();
      this.context.arc(circleX, circleY, circleRadius, 0, 2 * Math.PI);
      this.context.lineWidth = lineWidth;

      this.context.strokeStyle = this.color;
      this.context.stroke();

      this.animationFrameId = requestAnimationFrame(draw);
    };

    const toggleColor = () => {
      //this.color = this.color === 'red' ? 'green' : 'red';
      setTimeout(toggleColor, 100);
    };

    draw();
    toggleColor();
  }

}

