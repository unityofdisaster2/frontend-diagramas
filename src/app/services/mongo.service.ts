import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';


@Injectable({
  providedIn: 'root'
})
export class MongoService {

  constructor(private http: HttpClient) { }

  getQuery(query: string){
    const url = `http://localhost:3000/api/${query}`;
    return this.http.get(url,
      {
        headers: new HttpHeaders({
          'Content-Type': 'application/json'
        })
      });
  }

  insertGraph(grafo: JSON){
    const url = `localhost:3000/persona`;
    this.http.post(url, grafo,
      {
        headers: new HttpHeaders({
          'Content-Type': 'application/json'
        })
      });
  }
}
