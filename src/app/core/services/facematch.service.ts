import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FacematchService {

  bearerToken: string = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2Nsb3VkLmdvb2dsZS5jb20vd29ya3N0YXRpb25zIiwiYXVkIjoiaWR4LWZhY2VtYXRjaC1iYWNrZW5kLTE3MTc3MjE1MzgxMzQuY2x1c3Rlci1tN3RwejNibWdqZ29xcmt0bHZkNHlrcmMybS5jbG91ZHdvcmtzdGF0aW9ucy5kZXYiLCJpYXQiOjE3MTc3Mjc5OTUsImV4cCI6MTcxNzczMTU5NX0.tcaLMkfDsiR_yLhKoJzxPMJOqtPfJNKeBOb10W1qHE-dq-X30KUPRED123BSwz2NZ9bBfL26J5A3oghxGPE-w7buTiZgOWvCzuRumEz4AEwOEZkNKfN9rlO2Sy3GS5Tz-EpQojP44UcvGqEw1AI_AfDBwtW53LH5O4NF_8Ypsk0CFkr3-mTTOGPVhUsV-gttT77zMTAKB2l8-MEQ70rkXwqlvvK2ODwy1vpYJ5goqVWdQehDuewwfIu9HM7WzhDLj5XrqcLbFTa7fP3XS45uahSomr7eWDbU7fdxUsK4w1dpxKDnjLm6dqd6waqu_7Y1mLjeUL6baBVbk4JQGg983Q';

  constructor(private http: HttpClient) { }

  uploadImage(url: string, imageBase64: string): Observable<any> {
    // Convert base64 string to File object
    const imageBlob = this.base64ToBlob(imageBase64, 'image/png');

    const formData = new FormData();
    formData.append('image', imageBlob, 'image.png');
    const headers = new HttpHeaders({
      'Accept': '*/*',
      'Content-Type': 'multipart/form-data',
      //'Authorization': `Bearer ${this.bearerToken}`
    });
  
    return this.http.post(url, formData);
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