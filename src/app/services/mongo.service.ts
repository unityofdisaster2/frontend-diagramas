import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { OPDNode, InOutStructure } from '../utils/rappid-opm-utils';
import { cloneDeep } from 'lodash';
import { Observable } from 'rxjs';




export interface ProcessStructure {
  id: string;
  name: string;
  inputs: {
    from: Array<InOutStructure>,
    values: Array<any>,

  };
  outputs: {
    to: Array<InOutStructure>,
    values: Array<any>,
  };
  parametros: {
    tipo: string,
    reference: string
  };
  reqs: Array<any>;
}

export interface ObjectStructure {
  id: string;
  name: string;
  inputs: any;
  outputs: any;
  parametros: Array<any>;
  staticParams: {
    modelName: string,
    modelType: string,
    objectSubtype: string
  };
  procesos?: Array<ProcessStructure>;
}



@Injectable({
  providedIn: 'root'
})
export class MongoService {

  constructor(private http: HttpClient) { }

  private baseURL = 'http://localhost:3000';
  getRegistros() {
    const url = `${this.baseURL}/api/graphs`;
    return this.http.get(url,
      {
        headers: new HttpHeaders({
          'Content-Type': 'application/json'
        })
      });
  }

  insertGraph(grafo: OPDNode[], image: any, group: string, name: string) {
    const url = `${this.baseURL}/api/graphs`;
    const auxJson = {
      grafo,
      image,
      group,
      name
    };

    return this.http.post<any>(url, auxJson);
  }

  connectToMatlab(estructura: any) {
    const url = `${this.baseURL}/api/graphs/matlabConnection`;
    let arreglo = null;
    arreglo = new Array<any>();
    this.filterTree(estructura, arreglo);


    // se puede enviar el contenido de dos formas, como un arreglo o como un objeto
    let filteredObjects: { [name: string]: ObjectStructure };
    filteredObjects = {};
    let objectArray = null;
    let externObjects = {};
    objectArray = new Array<ObjectStructure>();


    // -----------------------------------------------------------------------------------------
    // -----------------------------------------------------------------------------------------
    // ------------------------------Extraccion de valores importantes -------------------------
    // -----------------------------------------------------------------------------------------
    // -----------------------------------------------------------------------------------------

    // primero se guardan los objetos externos para 
    for (const child of arreglo.entries()) {
      // se itera sobre las celdas de cada uno de los grafos encontrados
      for (const cell of child[1].cells.entries()) {
        if (cell[1].type === 'opm.Object') {
          if (cell[1].staticParams) {
            if (cell[1].staticParams.objectSubtype === 'externo') {
              console.log('si encuentra externos');
              externObjects[cell[1].id] = {
                value: cell[1].parametros[0].value
              }
            }
          }
        }
      }
    }


    for (const child of arreglo.entries()) {
      // se itera sobre las celdas de cada uno de los grafos encontrados
      for (const cell of child[1].cells.entries()) {

        if (cell[1].type === 'opm.Object') {
          if (cell[1].isParent) {


            // se guardan los datos mas importantes de la celda en el objeto
            filteredObjects[cell[1].id] = {
              id: cell[1].id,
              name: cell[1].attrs['.label'].text,
              staticParams: (cell[1].staticParams ? cell[1].staticParams : null),
              inputs: cell[1].inputs,
              outputs: cell[1].outputs,
              parametros: cell[1].parametros
            }

          }
        } else if (cell[1].type === 'opm.ChildObject') {

          // se itera sobre los inputs del objeto hijo y se asocian con los del padre
          for (const entrada of Object.entries(cell[1].inputs)) {
            // el indice 0 de entrada contiene nombre de puerto
            // el indice 1 contiene el objeto ligado al puerto
            if (entrada[1]['from'].length > 0) {
              // se usa operador spread ... para insertar todos los valores de entrada
              filteredObjects[cell[1].parentID].inputs[entrada[0]].from.push(...entrada[1]['from']);
            }
            if (entrada[1]['to'].length > 0) {

              filteredObjects[cell[1].parentID].inputs[entrada[0]].to.push(...entrada[1]['to']);
            }

          }

          // se itera sobre los outputs del objeto hijo y se asocian con los del padre
          for (const salida of Object.entries(cell[1].outputs)) {
            if (salida[1]['from'].length > 0) {
              filteredObjects[cell[1].parentID].outputs[salida[0]].from.push(...salida[1]['from']);
            }
            if (salida[1]['to'].length > 0) {
              filteredObjects[cell[1].parentID].outputs[salida[0]].to.push(...salida[1]['to']);
            }

          }
        }
        else if (cell[1].type === 'opm.Process') {
          // se crea estructura de proceso con los datos mas importantes de la celda
          // obtener los ultimos requerimientos agregados al objeto padre

          const newReqs = [];
          for (const r of cell[1].reqs.entries()) {
            const tempReq = filteredObjects[cell[1].parentID].parametros.filter(val => val.name === r[1].name).pop();

            if (tempReq) {
              newReqs.push(tempReq);
            }
          }
          const proceso: ProcessStructure = {
            id: cell[1].id,
            name: cell[1].attrs['.label'].text,
            inputs: cell[1].inputs,
            outputs: cell[1].outputs,
            reqs: newReqs,
            parametros: cell[1].parametros,
          };



          if (!filteredObjects[cell[1].parentID].procesos) {
            filteredObjects[cell[1].parentID].procesos = new Array<ProcessStructure>();
          }

          // se guarda elemento en los procesos del objeto padre
          filteredObjects[cell[1].parentID].procesos.push(proceso);
        }
      }

    }

    // -----------------------------------------------------------------------------------------
    // -----------------------------------------------------------------------------------------
    // -----------------------------------------------------------------------------------------
    // -----------------------------------------------------------------------------------------
    // -----------------------------------------------------------------------------------------
    // -----------------------------------------------------------------------------------------


    // --------------------------Asociacion previa de entradas y salidas con valores -----------
    // -----------------------------------------------------------------------------------------
    // se itera sobre los objetos 
    let contadorValue;
    for (const objeto of Object.entries<ObjectStructure>(filteredObjects)) {

      if (objeto[1].inputs) {

        for (const port of Object.entries<{ from: Array<InOutStructure>, values: Array<any> }>(objeto[1].inputs)) {
          if (port[1].from.length === port[1].values.length) {
            contadorValue = 0;
            for (const fromRef of port[1].from.entries()) {
              if (fromRef[1].type === 'externo') {
                console.log('si entra: ', externObjects);
                objeto[1].inputs[port[0]].values[contadorValue] = externObjects[fromRef[1].elementID].value;
              }
              contadorValue += 1;
            }

          } if (port[1].values.length === 0 && port[1].from.length > 0) {

            for (const fromRef of port[1].from.entries()) {

              this.objectFindFrom(filteredObjects, fromRef[1], port[0], objeto[1]);
              contadorValue += 1;
            }

          }

        }
      }


      if (objeto[1].procesos) {
        for (const proceso of objeto[1].procesos.entries()) {
          // se buscan las referencias de entrada a los procesos
          for (const fromRef of proceso[1].inputs.from.entries()) {
            this.processFindFrom(filteredObjects, fromRef[1], proceso[1]);
          }
        }
      }

    }



    console.log(filteredObjects);

    const testObject = {};
    for (const llave of Object.keys(filteredObjects).reverse()) {

      testObject[llave] = cloneDeep(filteredObjects[llave]);
    }
    console.log(testObject);
    // return null;
    return this.http.post<any>(url, testObject);
    // return this.http.post<any>(url, filteredObjects);
  }

  /**
   * Funcion utilizada para extraer todos los grafos contenidos en los 
   * nodos del arbol generado en el proyecto
   * @param tree 
   * @param arr 
   */
  filterTree(tree: OPDNode[], arr: any[]) {
    // se itera sobre los elementos del nodo actual
    for (const element of tree) {
      if (element.jsonGraph) {
        arr.push(cloneDeep(element.jsonGraph));
      }
      // si el elemento tiene hijos se ejecuta recursion
      if (element.children) {
        return this.filterTree(element.children, arr);
      }
    }
  }



  processFindFrom(fullObject: {}, fromRef: InOutStructure, proceso: ProcessStructure) {
    let currentObject;
    // como los outputs de procesos estan relacionados con su modelo, solo se toma en 
    // cuenta referencias a objetos
    if (fromRef.type === 'opm.ChildObject' || fromRef.type === 'opm.Object') {
      // referencia al objeto actual descrito en la referencia a from
      currentObject = fullObject[fromRef.elementID];
      if (fromRef.type === 'opm.ChildObject') {
        // se verifica si el input del puerto descrito en referencia tiene valores
        if (currentObject.inputs[fromRef.port].values.length > 0) {
          // se agregan valores a proceso
          proceso.inputs.values.push(
            ...currentObject.inputs[fromRef.port].values);

        } else {
          // si no hay valores en el input del puerto se itera sobre el from
          // del objeto y puerto actual para verificar si el objeto que se encuentra
          // conectado inmediatamente tiene algun valor que distribuir
          for (const inputFrom of currentObject.inputs[fromRef.port].from.entries()) {
            this.processFindFrom(fullObject, inputFrom[1], proceso);
          }

        }
      }
      // cuando el origen del from es un objeto normal se hacen los mismos pasos
      // pero tomando como referencia los outputs 
      else if (fromRef.type === 'opm.Object') {
        if (currentObject.outputs[fromRef.port].values.length > 0) {
          proceso.inputs.values.push(
            ...currentObject.outputs[fromRef.port].values);
        } else {
          for (const outputFrom of currentObject.outputs[fromRef.port].from.entries()) {
            this.processFindFrom(fullObject, outputFrom[1], proceso);
          }

        }
      }
    }


  }

  objectFindFrom(fullObject: {}, fromRef: InOutStructure, portName: string, objetoFijo: ObjectStructure) {
    let currentObject;
    // como los outputs de procesos estan relacionados con su modelo, solo se toma en 
    // cuenta referencias a objetos
    if (fromRef.type === 'opm.ChildObject' || fromRef.type === 'opm.Object') {
      // referencia al objeto actual descrito en from
      currentObject = fullObject[fromRef.elementID];
      if (fromRef.type === 'opm.ChildObject') {
        // se verifica si el input del puerto descrito en referencia tiene valores
        if (currentObject.inputs[fromRef.port].values.length > 0) {
          // se agregan valores a proceso
          objetoFijo.inputs[portName].values.push(
            ...currentObject.inputs[fromRef.port].values);

        } else {
          // si no hay valores en el input del puerto se itera sobre el from
          // del objeto y puerto actual para verificar si el objeto que se encuentra
          // conectado inmediatamente tiene algun valor que distribuir
          for (const inputFrom of currentObject.inputs[fromRef.port].from.entries()) {
            this.objectFindFrom(fullObject, inputFrom[1], portName, objetoFijo);
          }

        }
      }
      // cuando el origen del from es un objeto normal se hacen los mismos pasos
      // pero tomando como referencia los outputs 
      else if (fromRef.type === 'opm.Object') {
        if (currentObject.outputs[fromRef.port].values.length > 0) {
          objetoFijo.inputs[portName].values.push(
            ...currentObject.outputs[fromRef.port].values);
        } else {
          for (const outputFrom of currentObject.outputs[fromRef.port].from.entries()) {
            this.objectFindFrom(fullObject, outputFrom[1], portName, objetoFijo);
          }

        }
      }
    }
  }




}
