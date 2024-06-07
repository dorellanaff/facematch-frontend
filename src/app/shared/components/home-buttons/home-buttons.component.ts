import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-home-buttons',
  standalone: true,
  imports: [],
  templateUrl: './home-buttons.component.html',
  styleUrl: './home-buttons.component.scss'
})
export class HomeButtonsComponent {
  @Input() public listButtons: any[] = [];

}
