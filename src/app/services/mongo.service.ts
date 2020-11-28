import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { OPDNode } from '../utils/rappid-opm-utils';


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

  insertGraph(grafo: OPDNode[], image: any, group: string, name: string) {
    const url = 'http://localhost:3000/api/insertGraph';
    const auxJson = {
      grafo,
      image,
      group,
      name
    };

    return this.http.post<any>(url, auxJson);
  }

  connectToMatlab(estructura: any) {
    const url = 'http://localhost:3000/api/tcpMessage';
    // const objeto = this.preprocessJSON(estructura);
    //return null;
    //return this.http.post<any>(url, objeto);
  }

  preprocessJSON(jsonObject: any) {
    let obj: any = {};
    console.log(jsonObject[0].jsonGraph);
    for(const element of jsonObject[0].jsonGraph.cells.entries()) {
      console.log(element[1]);
      obj[element[1].attrs['.label'].text] = {};
      obj[element[1].attrs['.label'].text].parametros = element[1].parametros;
      obj[element[1].attrs['.label'].text].staticParams = element[1].staticParams;
    }
    console.log(obj);
    return obj;
  }
}
