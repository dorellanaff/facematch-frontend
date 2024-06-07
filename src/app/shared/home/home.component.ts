import { Component } from '@angular/core';
import { WebcamFaceComponent } from '../components/webcam-face/webcam-face.component';
import { CommonModule } from '@angular/common';
import { HomeButtonsComponent } from "../components/home-buttons/home-buttons.component";

@Component({
    selector: 'app-home',
    standalone: true,
    templateUrl: './home.component.html',
    styleUrl: './home.component.scss',
    imports: [WebcamFaceComponent, CommonModule, HomeButtonsComponent]
})
export class HomeComponent {
  isModalOpen = false;

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