import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

const url = environment.MAIN_URL;	
const url_reco_liveness = `${environment.MAIN_URL}${environment.URL_RECO_LIVENESS}`;
const url_reco_match = `${environment.MAIN_URL}${environment.URL_RECO_MATCH}`;

@Injectable({
  providedIn: 'root'
})
export class FacematchService {

  constructor(private http: HttpClient) { }

  checkLiveness(imageBase64: string): Observable<any> {
    // Convert base64 string to File object
    const imageBlob = this.base64ToBlob(imageBase64, 'image/png');

    const formData = new FormData();
    formData.append('file', imageBlob, 'image.png');
    const headers = new HttpHeaders({
      'Accept': '*/*',
      'Content-Type': 'multipart/form-data',
      //'Authorization': `Bearer ${this.bearerToken}`
    });
  
    return this.http.post(url_reco_liveness, formData);
  }

  matchFace(imageBase64: string, idFace: string): Observable<any> {
    // Convert base64 string to File object
    const imageBlob = this.base64ToBlob(imageBase64, 'image/png');

    const formData = new FormData();
    formData.append('file', imageBlob, 'image.png');
    formData.append('id_face', idFace)
    const headers = new HttpHeaders({
      'Accept': '*/*',
      'Content-Type': 'multipart/form-data',
      //'Authorization': `Bearer ${this.bearerToken}`
    });
  
    return this.http.post(url_reco_match, formData);
  }
  
  // Helper function to convert base64 string to Blob object
  base64ToBlob(base64: string, contentType: string): Blob {
    // Asegúrate de extraer solo la parte base64
    const base64Data = base64.split(',')[1];
    const byteCharacters = atob(base64Data.replace(/\s/g, '')); // Asegúrate de eliminar espacios
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  }
  
}