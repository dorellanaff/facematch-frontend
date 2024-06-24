import { Component } from '@angular/core';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {

  // Este método se llama cuando se hace clic en la imagen
  public reloadWindow() {
    window.location.reload();
  }
}
