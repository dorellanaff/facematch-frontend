import { Component, OnInit } from '@angular/core';
import { WebcamFaceComponent } from '../components/webcam-face/webcam-face.component';
import { CommonModule } from '@angular/common';
import { HomeButtonsComponent } from "../components/home-buttons/home-buttons.component";
import { ActivatedRoute } from '@angular/router';
import { FacematchService } from '../../core/services/facematch.service';

@Component({
    selector: 'app-home',
    standalone: true,
    templateUrl: './home.component.html',
    styleUrl: './home.component.scss',
    imports: [WebcamFaceComponent, CommonModule, HomeButtonsComponent]
})
export class HomeComponent implements OnInit {
  public isModalOpen: boolean = false;
  public idFace: string | null = null;

  public csrfToken: string = ''; // cambiar por cookies

  public showButton: boolean = false;

  constructor(
    private facematchService: FacematchService,
    private route: ActivatedRoute
  ){}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      this.idFace = params.get('idFace');
      
      if (this.idFace != null){

        this.facematchService.validateIdFace(this.idFace).subscribe({
          next: (data: any) => {
            this.csrfToken = data.csrf_token;

            this.showButton = true;
  
          }, 
          error: (error: any) => {
            console.log(error.error.detail ?? 'Error al validar ID Face');
              
          }
        });
        
      }
      else{
        console.log('ID Face no detectado');
      }

    });
  }

  public listButtons = [
    {
      "id": 1,
      "title": "Buena iluminación",
      "icon": "photo_camera",
      "text": "Contar con buena iluminación para que el resto este visible."
    },
    {
      "id": 2,
      "title": "Sin objetos en el rostro",
      "icon": "compare",
      "text": "Retirarse elementos como gafas, gorra, audifonos, o cualquier otro objeto que impida ver el rostro."
    },
    {
      "id": 3,
      "title": "Centrar el rostro",
      "icon": "center_focus_strong",
      "text": "Asegurese de ubicar correctamente el rostro dentro del circulo marcado."
    }
  ]

  openModal() {
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

}