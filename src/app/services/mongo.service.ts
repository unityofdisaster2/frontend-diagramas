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
    const arreglo = new Array<any>();
    this.filterTree(estructura, arreglo);
    let externo;
    const filteredObject = {
      parentObjects: {},
      processes: {}
    };
    for (const child of arreglo.entries()) {
      for (const cell of child[1].cells.entries()) {
        
        if (cell[1].type === 'opm.Object') {
          if (cell[1].isParent) {
            filteredObject.parentObjects[cell[1].id] = {};
            filteredObject.parentObjects[cell[1].id].inputs = cell[1].inputs;
            filteredObject.parentObjects[cell[1].id].outputs = cell[1].outputs;
            filteredObject.parentObjects[cell[1].id].staticParams = cell[1].staticParams;
            filteredObject.parentObjects[cell[1].id].parametros = cell[1].parametros;

          } else if (cell[1].staticParams) {
            if (cell[1].staticParams.objectSubtype === 'externo') {
              externo = cell[1];
            }
          }
        } else if (cell[1].type === 'opm.Process') {
          filteredObject.processes[cell[1].id] = {};
          filteredObject.processes[cell[1].id].inputs = cell[1].inputs;
          filteredObject.processes[cell[1].id].outputs = cell[1].outputs;
          filteredObject.processes[cell[1].id].reqs = cell[1].reqs;
          filteredObject.processes[cell[1].id].parametros = cell[1].parametros;

        }
      }

      // encontrar entradas 

      for (const objeto of Object.entries(filteredObject.parentObjects)) {
        
        for (const ins of Object.entries(objeto[1]['inputs'])) {
          for (const from of Object.entries(ins[1]['from'])) {
            if (from['value'] === 0) {
            } else {
            }
          }
        }
      }


      console.log(externo);
      for (const objeto of Object.entries(filteredObject.processes)) {
        for (const ins of Object.entries(objeto[1]['inputs'])) {
          if(ins[1]['value'] === 0) {
            ins[1]['value'] = externo.parametros[0];
          } else {
          }
        }
      }
      console.log(filteredObject);


    }
    // const objeto = this.preprocessJSON(estructura);
    //return null;
    return this.http.post<any>(url, filteredObject);
  }

  filterTree(tree: OPDNode[], arr: any[]) {
    for (const element of tree) {
      if (element.jsonGraph) {
        arr.push(element.jsonGraph);
      }
      if (element.children) {
        return this.filterTree(element.children, arr);
      }
    }
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
