import { Component, Output, EventEmitter, OnChanges, AfterViewInit, ElementRef, ViewChild, HostListener, OnInit, input, Input, SimpleChanges, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FacematchService } from '../../../core/services/facematch.service';
import { DeviceDetectorService } from 'ngx-device-detector';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { environment } from '../../../../environments/environment';

const easeInOutQuad = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

@Component({
  selector: 'app-webcam-face',
  standalone: true,
  imports: [CommonModule, ToastModule],
  providers: [MessageService],
  templateUrl: './webcam-face.component.html',
  styleUrl: './webcam-face.component.scss'
})
export class WebcamFaceComponent implements OnInit, AfterViewInit { //AfterViewInit
  @Input() isModalOpen: boolean = false;
  @Input() idFace: string | null = null;
  @Input() csrfToken: string | null = null; // cambiar por cookies
  
  @Output() close = new EventEmitter<void>();

  @ViewChild('canvas') canvasElement!: ElementRef;
  @ViewChild('video') videoElement!: ElementRef;
  @ViewChild('videoContainer') videoContainerElement!: ElementRef<HTMLDivElement>;
  @ViewChild('downloadLink') downloadLink!: ElementRef;

  private worker!: Worker;

  // Define un margen de tolerancia para la posición y la inclinación de la cara
  tamañoRelativoXHistorial: number[] = [];
  tamañoRelativoYHistorial: number[] = [];
  ventanaTamaño: number = 5;
  inclinacionMaxima: number = 10; // Ángulo máximo de inclinación permitido en grados
  isMobile: boolean = false;
  color: string = 'white';
  message: string = 'Centre el rostro';
  public position: string = '';
  public debug: boolean = !environment.production;

  private videoStream!: MediaStream | null;
  public listPhotos: string[] = [];
  public meanTimeDetect: number = 500;

  private isProcessing: boolean = false;
  private context!: CanvasRenderingContext2D;
  
  colorCanvas: string = '#FF0000'; // Color del círculo
  backgroundColorCanvas: string = '#FFFFFF'; // Color del fondo fuera del círculo

  public resultCheck: boolean = false;
  public resultMessageLiveness: string = '';
  public resultMessageMatchFace: string = '';

  public videoLoaded: boolean = false;
  public photoTaken: boolean = false;

  public startValidation: boolean = false;
  private isAnimating: boolean = false;
  private startDetection: boolean = false;

  mediaRecorder: any;
  recordedChunks: any[] = [];

  constructor(
    private facematchService: FacematchService,
    private deviceService: DeviceDetectorService,
    private route: ActivatedRoute,
    private router: Router,
    private messageService: MessageService
  ) {

    if (typeof Worker !== 'undefined') {
      this.isMobile = this.deviceService.isMobile();

      //this.worker = new Worker(new URL('../../../core/workers/face-detection.worker', import.meta.url));
      this.worker = new Worker('assets/js/face-detection-worker.js');
      this.worker.postMessage({type: "loadModels"});

      this.worker.onmessage = ({ data }) => {
        this.handleWorkerMessage(data)
      };

    } else {
      console.log('Web Workers are not supported in this environment.');
    }

  }

  ngOnInit(): void {

    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Message Content' });

    const element = document.getElementById('sectionId');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }

    if (this.csrfToken === null){
      this.closeModal();
    }

    console.log('csrfToken', this.csrfToken);

  }

  ngOnDestroy() {

    this.stopVideo();
    if (this.worker) {
      this.worker.terminate();
    }
    
  }

  async ngAfterViewInit(): Promise<void> {
    this.context = this.canvasElement.nativeElement.getContext('2d') as CanvasRenderingContext2D;
  }

  @HostListener('window:resize')
  onResize() {
    let videoHeight = this.videoElement.nativeElement.height + 20;
    this.videoContainerElement.nativeElement.style.maxHeight = `${videoHeight}px`;

    this.resizeCanvas();
  }

  async setupVideo() {
    const video = this.videoElement.nativeElement;
  
    try {
      
      // Establecer las restricciones de video con la resolución máxima
      const constraints = {
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      if (this.isMobile){
        // Obtener el stream de video sin restricciones
        this.videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        
      } else {
        // Solicitar el stream de video con las restricciones de resolución máxima
        this.videoStream = await navigator.mediaDevices.getUserMedia(constraints);
      }
      
      
    } catch (error) {
      console.error('Error accessing the webcam:', error);

    }
    finally {
      if (this.videoStream){
        video.srcObject = this.videoStream;
        video.addEventListener('loadeddata', () => this.onVideoLoaded());
      }
      
    }
  }
  
  private onVideoLoaded() {
    this.videoLoaded = true;

    this.resizeCanvas();
    const canvas = this.canvasElement.nativeElement;
    canvas.hidden = false;
    
    this.videoElement.nativeElement.play();

    this.startDetection = true;
    this.detectFaces();

  }

  private detectingFaces(){
    const video = this.videoElement.nativeElement;
  
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    if (canvas && ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { height, width, data } = imageData;

      const initTime = Date.now();

      this.worker.postMessage({
        type: "detect",
        inputSize: this.isMobile ? 128 : 416,
        initTime: initTime,
        width: width,
        height: height,
        isMobile: this.isMobile,
        ventanaTamaño: this.ventanaTamaño,
        inclinacionMaxima: this.inclinacionMaxima,
        tamañoRelativoXHistorial: this.tamañoRelativoXHistorial,
        tamañoRelativoYHistorial: this.tamañoRelativoYHistorial,
        data: data.buffer,
      }, [data.buffer]); // Transferir el buffer de datos al worker
    }
  }

  private async detectFaces() {
    //console.log('detectFaces() - this.isProcessing', this.isProcessing, ' - this.startDetection', this.startDetection);
    
    if (!this.startDetection) {
      //console.log('Detección de caras detenida.');
      return; // Detener el proceso si this.startDetection es false
    }
  
    if (this.isProcessing) {
      //console.log('Esperando a que termine el procesamiento actual.');
      requestAnimationFrame(() => this.detectFaces()); // Esperar hasta que el procesamiento termine
      return;
    }
  
    this.isProcessing = true; // Indicar que estamos procesando
  
    try {
      this.detectingFaces();
      
    } catch (error) {
      console.error('Error detectando rostros:', error);
    } finally {
      // Llamar a detectFaces de nuevo para iniciar el siguiente ciclo
      requestAnimationFrame(() => {
        
        setTimeout(() => {
          this.detectFaces();
        }, 1000);
        
        /*if (!this.startDetection) {
          setTimeout(() => {
            this.detectingFaces();
          }, this.meanTimeDetect);
        }*/

      });
    }
  }
  
  private async handleWorkerMessage(event: MessageEvent) {

    if ('type' in event){

      if (event.type === 'faceDetectionResult' && !this.startValidation) {
        this.isProcessing = false;

        const { message, color, position } = event.data;
        this.message = message;
        this.color = color;
        this.position = position;
        
        if ('initTime' in event){
          const initTime = event.initTime as number;
          const meanTime = Date.now() - initTime;
          //if (meanTime > 650 && meanTime < 1500 ){
            this.meanTimeDetect = meanTime;
          //}
        }

        if (color === 'green'){
          // Audit photo
          if (this.videoStream && this.isAnimating === false){
            this.getPhoto();            
          }
        }

        if (this.color === 'red' && this.isAnimating === true){
          this.isAnimating = false;
          this.startDetection = true;
          this.drawSegmentedSquare();

        } else if (this.color === 'green' && this.isAnimating === false && this.startDetection === true && this.listPhotos.length >= 3) {
          this.animateOvalColor();
          
        }

      } else if (event.type === 'loadedComplete') {
        
        setTimeout(() => {
          this.setupVideo();
        }, 2000);

      } else if (event.type === 'error') {
        this.isProcessing = false;
        console.error(event);
      }

    }

  }

  private resizeCanvas() {
    const video = this.videoElement.nativeElement!;
    const videoWidth = video.offsetWidth;
    const videoHeight = video.offsetHeight;
    
    this.canvasElement.nativeElement.width = videoWidth+1;
    this.canvasElement.nativeElement.height = videoHeight+1;

    let videoContaineHeight = videoHeight + 100;
    this.videoContainerElement.nativeElement.style.maxHeight = `${videoContaineHeight}px`;
    
    //this.drawOval();
    this.drawSegmentedSquare();
  }

  public startRecording(){

    const stream = this.videoElement.nativeElement.srcObject as MediaStream;

    // Verificar que el stream contiene pistas de video
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) {
      console.error('No video tracks available');
      return;
    }

    const options = { mimeType: 'video/webm; codecs=vp8' };
    this.mediaRecorder = new MediaRecorder(stream, options);

    this.mediaRecorder.ondataavailable = (event: { data: { size: number; }; }) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      } else {
        console.warn('Empty data chunk');
      }
    };

    this.mediaRecorder.onstop = () => {
      if (this.recordedChunks.length > 0) {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        this.downloadLink.nativeElement.href = url;
        this.downloadLink.nativeElement.download = 'recording.webm';
        this.downloadLink.nativeElement.style.display = 'block';
      } else {
        console.warn('No recorded chunks available');
      }
    };

    this.mediaRecorder.start();

    // Detener la grabación después de 4 segundos
    setTimeout(() => {
      this.mediaRecorder.stop();
    }, 4000);
  }

  public stopRecording() {
    this.mediaRecorder.stop();
  }

  public async validatePhoto() {
    this.startDetection = false;

    //this.listPhotos.shift();
    await this.getPhoto();

    this.checkLiveness(this.listPhotos); // .slice(-1)[0]
    
  }

  private checkLiveness(images: string[]) {
    this.startValidation = true;

    this.facematchService.checkLiveness(images).subscribe({
      next: (data: any) => {
        let message = `Liveness - ${data.message} - ${data.threshold}`
        this.resultMessageLiveness = message;

        this.matchFace();

      }, 
      error: (error: any) => {
        let message = `Liveness - ${error.error.message ?? 'Error al subir la imagen'} - ${error.error.threshold ?? 0}`
        this.resultCheck = true;
        this.resultMessageLiveness = message;
          
      }
    });

  }

  private matchFace() {
    if (this.idFace == null || this.csrfToken == null){
      return;
    }

    this.facematchService.matchFace(this.listPhotos.slice(-1)[0], this.idFace, this.csrfToken).subscribe({
      next: (data: any) => {
        let message = `Match Face - ${data.message} - ${data.threshold}`
        this.resultCheck = true;
        this.resultMessageMatchFace = message;

      }, 
      error: (error: any) => {
          let message = `Match Face - ${error.error.message ?? 'Error al subir la imagen'} - ${error.error.threshold ?? 0}`
          this.resultCheck = true;
          this.resultMessageMatchFace = message;
          
      }
    });

  }

  private async getPhoto(){
    // Captura el fotograma actual del video
    const canvas = document.createElement('canvas');
    canvas.width = this.videoElement.nativeElement.videoWidth;
    canvas.height = this.videoElement.nativeElement.videoHeight;
    canvas.getContext('2d')!.drawImage(this.videoElement.nativeElement, 0, 0, canvas.width, canvas.height);
    const imgData = canvas.toDataURL('image/png');

    if (this.listPhotos.length >= 3){
      this.listPhotos.shift()
    }

    this.listPhotos.push(imgData);
    
  }

  public closeModal() {

    this.startValidation = false;
    this.startDetection = false;
    this.isAnimating = false;
    
    this.close.emit();
  }

  private stopVideo() {

    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null; // Liberar la referencia
      this.photoTaken = true;
    }
    
  }

  private drawOval() {
    const canvas = this.canvasElement.nativeElement;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
  
    const lineWidth = 2;

    // Define vertical radius and adjust it based on desired height reduction
    const desiredHeightReduction = 0.08; // Adjust this value between 0 and 1
  
    const baseVerticalRadius = (canvasHeight - lineWidth) / 2;
    let verticalRadius = baseVerticalRadius * (1 - desiredHeightReduction);
    let horizontalRadius = verticalRadius / 2; // Or any desired ratio for width vs. height
  
    const centerX = (canvasWidth) / 2;
    const centerY = (canvasHeight) / 2;
  
    // Fill the background with white color
    //this.context.fillStyle = this.backgroundColorCanvas;
    //this.context.fillRect(0, 0, canvasWidth, canvasHeight);
  
    // Create an elliptical clipping path
    this.context.save();
    this.context.beginPath();
    this.context.ellipse(centerX, centerY, horizontalRadius, verticalRadius, 0, 0, 2 * Math.PI);
    this.context.clip();
  
    // Clear the interior of the ellipse to make it transparent
    this.context.clearRect(centerX - horizontalRadius, centerY - verticalRadius, horizontalRadius * 2, verticalRadius * 2);
    this.context.restore();
  
    /*
    // Draw the ellipse with black border and transparent fill
    this.context.beginPath();
    this.context.ellipse(centerX, centerY, horizontalRadius, verticalRadius, 0, 0, 2 * Math.PI);
    this.context.lineWidth = lineWidth;
    this.context.strokeStyle = 'black';
    this.context.stroke();
    */
  }

  private drawSegmentedSquare() {
    const canvas = this.canvasElement.nativeElement;
    const context = canvas.getContext('2d');
    const video = this.videoElement.nativeElement;
    const sizeFactor = this.isMobile ? 0.8 : 0.45; // Factor para el tamaño del cuadrado (50% del ancho del canvas)
    const segments = 4; // Número de segmentos por borde

    video.addEventListener('play', () => {
      const draw = () => {
        if (video.paused || video.ended) return;

        context.clearRect(0, 0, canvas.width, canvas.height);

        const size = canvas.width * sizeFactor;
        const segmentLength = size / segments;
        const xCenter = canvas.width / 2;
        const yCenter = canvas.height / 2;

        context.strokeStyle = this.color;
        context.lineWidth = 6;
        // Esquinas superiores
        // Esquina superior izquierda
        context.moveTo(xCenter - size / 2, yCenter - size / 2);
        context.lineTo(xCenter - size / 2 + segmentLength, yCenter - size / 2);
        context.moveTo(xCenter - size / 2, yCenter - size / 2);
        context.lineTo(xCenter - size / 2, yCenter - size / 2 + segmentLength);

        // Esquina superior derecha
        context.moveTo(xCenter + size / 2, yCenter - size / 2);
        context.lineTo(xCenter + size / 2 - segmentLength, yCenter - size / 2);
        context.moveTo(xCenter + size / 2, yCenter - size / 2);
        context.lineTo(xCenter + size / 2, yCenter - size / 2 + segmentLength);

        // Esquinas inferiores
        // Esquina inferior izquierda
        context.moveTo(xCenter - size / 2, yCenter + size / 2);
        context.lineTo(xCenter - size / 2 + segmentLength, yCenter + size / 2);
        context.moveTo(xCenter - size / 2, yCenter + size / 2);
        context.lineTo(xCenter - size / 2, yCenter + size / 2 - segmentLength);

        // Esquina inferior derecha
        context.moveTo(xCenter + size / 2, yCenter + size / 2);
        context.lineTo(xCenter + size / 2 - segmentLength, yCenter + size / 2);
        context.moveTo(xCenter + size / 2, yCenter + size / 2);
        context.lineTo(xCenter + size / 2, yCenter + size / 2 - segmentLength);


        context.stroke();
        requestAnimationFrame(draw);
      };
      draw();
    });
  }
  
  private animateOvalColor() {
    const canvas = this.canvasElement.nativeElement;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const animationDuration = 6000; // Duración de la animación en milisegundos
    const framesPerSecond = 60; // Cuadros por segundo (FPS)
    const totalFrames = Math.round(animationDuration / (1000 / framesPerSecond)); // Número total de cuadros
    const purpleHue = 280; // Matiz de púrpura
    const lineWidth = 6; // Ancho del borde del óvalo
  
    const desiredHeightReduction = 0.08;
    const baseVerticalRadius = (canvasHeight - lineWidth) / 2;
    const verticalRadius = baseVerticalRadius * (1 - desiredHeightReduction);
    const horizontalRadius = verticalRadius / 2;
  
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
  
    let startTime: number | null = null;
  
    const drawFrame = (timestamp: number) => {
      if (!this.isAnimating) {
        return; // Detener la animación si la bandera se ha desactivado
      }
  
      if (!startTime) {
        startTime = timestamp;
      }
  
      const elapsed = timestamp - startTime;
      const progress = elapsed / animationDuration;
      const easedProgress = easeInOutQuad(Math.min(1, progress));
  
      // Limpia el área externa del óvalo y dibuja el fondo blanco
      this.context.clearRect(0, 0, canvasWidth, canvasHeight);
      this.context.fillStyle = 'white';
      this.context.fillRect(0, 0, canvasWidth, canvasHeight);
  
      // Recorta el área del óvalo para mantenerla transparente
      this.context.save();
      this.context.beginPath();
      this.context.ellipse(centerX, centerY, horizontalRadius, verticalRadius, 0, 0, 2 * Math.PI);
      this.context.clip();
      this.context.clearRect(0, 0, canvasWidth, canvasHeight);
      this.context.restore();
  
      // Calcula el ángulo actual utilizando la función de interpolación
      const currentAngle = (2 * Math.PI) * easedProgress;
  
      // Dibuja el borde del óvalo con el color púrpura
      this.context.beginPath();
      this.context.ellipse(centerX, centerY, horizontalRadius, verticalRadius, 0, -Math.PI / 2, currentAngle - Math.PI / 2);
      this.context.lineWidth = lineWidth;
      this.context.strokeStyle = `hsl(${purpleHue}, 100%, 50%)`;
      this.context.stroke();

      if (elapsed > (animationDuration / 2)){
        if (this.startDetection){
          this.validatePhoto();

        }
      }
  
      if (elapsed <= animationDuration) {
        requestAnimationFrame(drawFrame);
      } else {
        this.isAnimating = false;
        this.startDetection = false;
        this.stopVideo();
      }
    };
  
    // Inicia la animación
    this.isAnimating = true;
    requestAnimationFrame(drawFrame);
  }
  
}

