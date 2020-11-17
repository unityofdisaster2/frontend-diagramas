import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';


@Injectable({
  providedIn: 'root'
})
export class MongoService {

  constructor(private http: HttpClient) { }


  getRegistros() {
    const url = 'http://localhost:3000/api/registros';
    return this.http.get(url,
      {
        headers: new HttpHeaders({
          'Content-Type': 'application/json'
        })
      });
  }

  insertGraph(grafo: JSON, image: any, group: string, name: string) {
    const url = 'http://localhost:3000/api/insertGraph';
    const auxJson = {
      grafo,
      image,
      group,
      name
    };

    return this.http.post<any>(url, auxJson);
  }
}
